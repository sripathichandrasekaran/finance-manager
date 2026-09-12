"""Gig Radar orchestration.

`collect_all()` runs every configured interval (or manually via
`POST /api/opportunities/refresh`) — it pulls raw opportunities from the
no-key collectors, normalizes them, scores them against the user's service
profile, dedupes by source key and persists new ones. It also holds the two
hand-written transformations: AI proposal drafting (Claude) and "mark won",
which turns a won opportunity into a real Company + Project so the rest of
Finance Manager (invoices, tracking) keeps working.

Collection is guarded by a thread lock and a time gate so the scheduler thread
and a manual refresh can never double-fire.
"""

from __future__ import annotations

import logging
import threading
from typing import Optional
import time

from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.notification import NotificationType
from app.repositories.opportunity_repository import OpportunityRepository
from app.services.notification_service import notify, broadcast_system
from app.services.gig_radar import collectors, scorer

logger = logging.getLogger(__name__)

_lock = threading.Lock()
_last_collect_at: Optional[float] = None  # unix seconds


# --------------------------------------------------------------------------- #
# Collection
# --------------------------------------------------------------------------- #

def _upsert(repo: OpportunityRepository, raw: dict) -> Optional[str]:
    """Persist one raw opportunity if new; refresh untouched ones. Returns
    'added' | 'updated' | None."""
    existing = repo.get_by_source_key(raw["source_key"])
    if existing is None:
        score, hits, neg = scorer.score_opportunity(
            raw["title"], raw.get("description") or "", raw.get("skills") or ""
        )
        raw["skills"] = ", ".join(hits) if hits else raw.get("skills")
        raw["score"] = score
        raw["fit_reason"] = scorer.build_fit_reason(hits, neg)
        repo.create(**raw)
        return "added"
    if existing.status == "new":
        score, hits, neg = scorer.score_opportunity(
            raw["title"], raw.get("description") or "", raw.get("skills") or ""
        )
        fields = dict(raw)
        fields["skills"] = ", ".join(hits) if hits else raw.get("skills")
        fields["score"] = score
        fields["fit_reason"] = scorer.build_fit_reason(hits, neg)
        repo.refresh_fields(existing.id, fields)
        return "updated"
    return None


def _prune_stale(repo: OpportunityRepository) -> int:
    """Delete lingering 'new' rows that no longer pass the current role
    filter. Won/applied/drafted/archived rows are never touched, so user
    progress is preserved when the filter tightens over time."""
    removed = 0
    for opp in repo.list(page=1, page_size=10000):
        if opp.status != "new":
            continue
        title = opp.title or ""
        if opp.source in ("remotive", "remoteok", "rss"):
            ok = collectors._is_web_job_title(title)
        elif opp.source in ("reddit", "freelancer", "truelancer"):
            ok = collectors._is_web_role(title)
        else:
            ok = True
        if not ok:
            repo.delete(opp.id)
            removed += 1
    return removed


def collect_all() -> dict:
    """Run every enabled collector and upsert results. Not thread-safe by
    design — always call through collect_all_guarded() with the lock."""
    db = SessionLocal()
    try:
        repo = OpportunityRepository(db)
        added = 0
        updated = 0
        errored: list[str] = []

        if settings.RADAR_ENABLED:
            subreddits = [s.strip() for s in settings.RADAR_SUBREDDITS.split(",") if s.strip()]
            if subreddits:
                try:
                    for raw in collectors.collect_reddit(
                        subreddits,
                        settings.RADAR_REDDIT_CLIENT_ID,
                        settings.RADAR_REDDIT_CLIENT_SECRET,
                    ):
                        outcome = _upsert(repo, raw)
                        if outcome == "added":
                            added += 1
                        elif outcome == "updated":
                            updated += 1
                except Exception as exc:  # noqa: BLE001
                    logger.exception("GigRadar: Reddit collection failed")
                    errored.append(f"reddit: {exc}")

            collectors_list = [
                ("truelancer", collectors.collect_truelancer),
                ("remotive", collectors.collect_remotive),
                ("remoteok", collectors.collect_remoteok),
                ("weworkremotely", collectors.collect_weworkremotely),
            ]
            if settings.RADAR_FREELANCER_API_KEY:
                collectors_list.insert(
                    0,
                    ("freelancer", lambda: collectors.collect_freelancer(
                        settings.RADAR_FREELANCER_API_KEY
                    )),
                )

            for name, collector in collectors_list:
                try:
                    for raw in collector():
                        outcome = _upsert(repo, raw)
                        if outcome == "added":
                            added += 1
                        elif outcome == "updated":
                            updated += 1
                except Exception as exc:  # noqa: BLE001
                    logger.exception("GigRadar: %s collection failed", name)
                    errored.append(f"{name}: {exc}")

        pruned = 0
        if settings.RADAR_ENABLED:
            try:
                pruned = _prune_stale(repo)
            except Exception:  # noqa: BLE001
                logger.exception("GigRadar: stale-row prune failed")

        if added or pruned:
            notify(
                db,
                title=(f"Gig Radar: {added} new opportunity{'ies' if added != 1 else 'y'}"
                       f"{' + ' + str(pruned) + ' cleaned' if pruned else ''}"),
                message=(f"{added} new gig{'s' if added != 1 else ''} captured"
                         f"{f', {pruned} outdated removed' if pruned else ''}."),
                type_=NotificationType.SYSTEM,
                link="/radar",
            )
        elif updated:
            broadcast_system("Gig Radar refreshed", "Sources checked — no new opportunities.")
        return {"added": added, "updated": updated, "pruned": pruned, "errored": errored}
    finally:
        db.close()


def _collect_all_guarded(force: bool = False) -> Optional[dict]:
    global _last_collect_at
    with _lock:
        now = time.time()
        if not force and _last_collect_at is not None:
            if now - _last_collect_at < max(settings.RADAR_INTERVAL_MINUTES, 1) * 60:
                return None
        result = collect_all()
        _last_collect_at = time.time()
        return result


def refresh_now() -> dict:
    """Force a collection pass (called by the manual refresh endpoint)."""
    return _collect_all_guarded(force=True) or {"added": 0, "updated": 0, "pruned": 0, "errored": []}


def maybe_collect() -> Optional[dict]:
    """Scheduler hook — only runs when the interval has elapsed."""
    return _collect_all_guarded(force=False)


# --------------------------------------------------------------------------- #
# AI proposal draft
# --------------------------------------------------------------------------- #

def draft_proposal(db: Session, opp) -> Optional[str]:
    """Generate a tailored, outbound-style proposal with Claude. Runtime
    enough for a short message the user copies into Reddit chat/DM or email."""
    if not settings.ANTHROPIC_API_KEY:
        return None
    try:
        from anthropic import Anthropic

        client = Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        system = (
            "You write short, specific freelance proposals for a frontend "
            "developer, Sripathi Chandrasekaran (Tamil Nadu, India, remote). "
            "His services: landing pages (React, Tailwind, Framer), business "
            "websites (WordPress, Elementor, Wix, Squarespace, Shopify), "
            "custom React frontends/dashboards (TypeScript, MUI, Redux), and "
            "bug fixes/redesigns. Typical delivery 3-7 days, 7-day post-launch "
            "support, responsive mobile-first builds. No placeholders, no "
            "robotic filler — sound human and confident."
        )
        prompt = (
            "Write a proposal for this opportunity. Keep it under 130 words.\n"
            "Match the specific ask: if it mentions WordPress/shopify/React, "
            "lead with that exact skill.\n"
            "Include: who you are (Sripathi — frontend developer), a concrete "
            "reason you fit THIS post, and a tiny trust signal (fast turnaround, "
            "7-day support). Do not include placeholders in [brackets].\n\n"
            f"Opportunity title:\n{opp.title}\n\n"
            f"Description:\n{(opp.description or '')[:2500]}"
        )
        resp = client.messages.create(
            model=settings.ANTHROPIC_MODEL,
            max_tokens=400,
            system=system,
            messages=[{"role": "user", "content": prompt}],
        )
        text = "".join(
            b.text for b in resp.content if getattr(b, "type", "") == "text"
        )
        return text.strip()
    except Exception as exc:  # noqa: BLE001
        logger.exception("GigRadar: proposal draft failed")
        raise RuntimeError(f"Proposal draft failed: {exc}") from exc


# --------------------------------------------------------------------------- #
# Won flow
# --------------------------------------------------------------------------- #

def mark_won(
    db: Session,
    opp,
    company_name: Optional[str] = None,
    project_name: Optional[str] = None,
    amount: Optional[float] = None,
    notes: Optional[str] = None,
) -> dict:
    """Convert a won opportunity into a Company + Project so the finance side
    (invoices, profits, time tracking) keeps working on it."""
    from app.repositories.company_repository import CompanyRepository
    from app.repositories.project_repository import ProjectRepository

    name = (company_name or opp.title or "New Client").strip()[:120]
    company = CompanyRepository(db).create(
        name=name,
        notes=(f"Client from {opp.source_label} ({opp.url})" if opp.url else
               f"Client from {opp.source_label or 'Gig Radar'}"),
    )
    project = ProjectRepository(db).create(
        company_id=company.id,
        name=(project_name or opp.title or "New Project").strip()[:160],
        service_sector="Freelance",
        pricing_type="fixed",
        fixed_price=amount,
        status="active",
        notes=notes,
    )
    repo = OpportunityRepository(db)
    repo.update(opp.id, {"status": "won", "company_id": company.id, "project_id": project.id})
    notify(
        db,
        title=f"Project started: {project.name}",
        message=f"Won from {opp.source_label}. Company '{company.name}' and project created.",
        type_=NotificationType.SYSTEM,
        link=f"/projects",
    )
    return {"company_id": company.id, "project_id": project.id}