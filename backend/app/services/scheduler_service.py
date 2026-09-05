import threading
import time
from datetime import timedelta

from app.core.timezone import today as ist_today, now as ist_now
from app.db.session import SessionLocal
from app.models.notification import NotificationType
from app.models.reminder import ReminderType, ReminderStatus
from app.repositories.subscription_repository import SubscriptionRepository
from app.repositories.reminder_repository import ReminderRepository
from app.repositories.transaction_repository import TransactionRepository
from app.repositories.budget_repository import BudgetRepository
from app.repositories.recurring_invoice_repository import RecurringInvoiceRepository
from app.services.notification_service import notify, broadcast_system
from app.repositories.notification_repository import NotificationRepository

_INTERVAL_SECONDS = 60  # check every minute for timely notifications
_stop = threading.Event()


def _generate_subscription_reminders() -> None:
    """Create a reminder for each subscription whose reminder window lands on
    today. Idempotent — never duplicates a reminder for the same day."""
    db = SessionLocal()
    try:
        today = ist_today()
        sub_repo = SubscriptionRepository(db)
        rem_repo = ReminderRepository(db)
        for sub in sub_repo.list(active_only=True):
            reminder_day = sub.next_billing - timedelta(days=sub.reminder_days_before)
            if reminder_day == today:
                if not rem_repo.exists_today(ReminderType.SUBSCRIPTION, sub.id, today):
                    rem = rem_repo.create(
                        title=f"Payment due: {sub.name}",
                        message=f"Your {sub.name} subscription of ${sub.amount:.2f} is due on {sub.next_billing}.",
                        trigger_date=today,
                        type_=ReminderType.SUBSCRIPTION,
                        related_id=sub.id,
                    )
                    notify(
                        db,
                        title=rem.title,
                        message=rem.message,
                        type_=NotificationType.REMINDER,
                        link="/subscriptions",
                    )
    finally:
        db.close()


def _generate_daily_summary() -> None:
    db = SessionLocal()
    try:
        today = ist_today()
        tx_repo = TransactionRepository(db)
        rem_repo = ReminderRepository(db)
        summary = tx_repo.daily_summary(today)
        if rem_repo.exists_today(ReminderType.SUMMARY, 0, today):
            return
        rem = rem_repo.create(
            title="Daily spending summary",
            message=f"Spent ${summary['total_debit']:.2f}, received ${summary['total_credit']:.2f} today.",
            trigger_date=today,
            type_=ReminderType.SUMMARY,
            related_id=0,
        )
        notify(
            db,
            title=rem.title,
            message=rem.message,
            type_=NotificationType.REMINDER,
            link="/reports",
        )
    finally:
        db.close()


def _check_budget_alerts() -> None:
    """Notify when a monthly category budget reaches its threshold. Idempotent
    per day — never duplicates the same alert across scheduler ticks."""
    db = SessionLocal()
    try:
        today = ist_today()
        repo = BudgetRepository(db)
        notif_repo = NotificationRepository(db)
        budgets = repo.list(year=today.year, month=today.month)
        for budget in budgets:
            limit = budget.amount or 0.0
            if limit <= 0:
                continue
            spent = repo.get_spent(budget.category_id, today.year, today.month)
            category_name = budget.category.name if budget.category else f"Category #{budget.category_id}"
            pct = spent / limit
            if pct >= 1.0:
                title = f"Budget exceeded: {category_name}"
                message = f"{category_name}: ${spent:.2f} spent of ${limit:.2f} ({(pct * 100):.0f}%)."
            elif pct >= 0.8:
                title = f"Budget near limit: {category_name}"
                message = f"{category_name}: ${spent:.2f} of ${limit:.2f} used ({(pct * 100):.0f}%)."
            else:
                continue
            if notif_repo.exists_recent(title):
                continue
            notify(db, title=title, message=message,
                   type_=NotificationType.BUDGET, link="/budget")
    finally:
        db.close()


def _process_custom_reminders() -> None:
    """Fire user-created (CUSTOM) reminders once their date (and optional time)
    has arrived, then mark them SENT. A reminder with no time fires as soon as
    its trigger date is reached; with a time it fires once the current time is
    past that time on the trigger date (or for a date already in the past)."""
    db = SessionLocal()
    try:
        now = ist_now()
        today = ist_today()
        current_time = now.time().replace(microsecond=0)
        rem_repo = ReminderRepository(db)
        for rem in rem_repo.pending_custom_due(before=today):
            due = False
            if rem.trigger_date < today:
                due = True
            elif rem.trigger_date == today:
                if rem.trigger_time is None or current_time >= rem.trigger_time:
                    due = True
            if not due:
                continue
            notify(
                db,
                title=rem.title,
                message=rem.message or f"Reminder for {rem.trigger_date}.",
                type_=NotificationType.REMINDER,
                link="/reminders",
            )
            rem_repo.set_status(rem.id, ReminderStatus.SENT)
    finally:
        db.close()


def _generate_recurring_invoices() -> None:
    """Generate invoices from recurring templates that are due today."""
    db = SessionLocal()
    try:
        today = ist_today()
        repo = RecurringInvoiceRepository(db)
        for ri in repo.get_due_today(today):
            if not ri.active:
                continue
            # Create the invoice
            from app.repositories.invoice_repository import InvoiceRepository
            inv_repo = InvoiceRepository(db)
            inv = inv_repo.create(
                company_id=ri.company_id,
                project_id=ri.project_id,
                issue_date=today,
                due_date=today,
                status="draft",
                tax_rate=ri.tax_rate,
                paid_amount=0.0,
                notes=ri.notes,
                items=[{
                    "description": it.description,
                    "quantity": it.quantity,
                    "unit_price": it.unit_price,
                } for it in ri.items],
            )
            # Advance next generation date
            repo.advance_next_generation(ri, ri.billing_cycle)
            # Notify if auto_send is enabled
            if ri.auto_send:
                from app.services.notification_service import notify
                inv_totals = InvoiceRepository.totals(inv)
                notify(
                    db,
                    title=f"Invoice generated: {ri.name}",
                    message=f"Recurring invoice {ri.name} generated for {ri.company.name if ri.company else 'company'} (₹{inv_totals['total']:,.2f}).",
                    type_=NotificationType.REMINDER,
                    link=f"/invoices/{inv.id}",
                )
    finally:
        db.close()


def _run_tick() -> None:
    _generate_daily_summary()
    _generate_subscription_reminders()
    _check_budget_alerts()
    _process_custom_reminders()
    _generate_recurring_invoices()


def _loop() -> None:
    # Run an initial tick shortly after startup, then on the interval.
    while not _stop.is_set():
        try:
            _run_tick()
        except Exception as exc:  # noqa: BLE001
            print(f"[Scheduler] tick failed: {exc}")
        _stop.wait(_INTERVAL_SECONDS)


def start_scheduler() -> None:
    t = threading.Thread(target=_loop, daemon=True)
    t.start()
    print("[Scheduler] notification scheduler started")
