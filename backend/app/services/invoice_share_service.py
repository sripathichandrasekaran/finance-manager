"""Invoice share links — signed, accountless invoice viewing for clients."""

import hmac
import hashlib

from html import escape
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.company import Company
from app.models.invoice import Invoice, InvoiceEvent
from app.models.project import Project
from app.repositories.business_profile_repository import BusinessProfileRepository
from app.repositories.invoice_repository import InvoiceRepository


def _sign(invoice_id: int, secret: str) -> str:
    sig = hmac.new(secret.encode("utf-8"), str(invoice_id).encode("utf-8"), hashlib.sha256).hexdigest()
    return f"{invoice_id}.{sig}"


def _verify(token: str, secret: str):
    try:
        inv_id_str, sig = token.rsplit(".", 1)
        invoice_id = int(inv_id_str)
    except (ValueError, AttributeError):
        return None
    expected = _sign(invoice_id, secret)
    if not hmac.compare_digest(expected, token):
        return None
    return invoice_id


def make_token(invoice_id: int) -> str:
    return _sign(invoice_id, settings.SESSION_SECRET)


def parse_token(token: str):
    return _verify(token, settings.SESSION_SECRET)


def log_share(db: Session, invoice_id: int) -> None:
    db.add(InvoiceEvent(
        invoice_id=invoice_id,
        event_type="share",
        description="Invoice share link created",
    ))
    db.commit()


def build_invoice_public_html(invoice_id: int, db: Session) -> str:
    """Render a clean, accountless invoice page for the client — fully
    self-contained inline CSS, safe to open in any browser, print-friendly."""

    def fmt(v):
        return f"\u20b9{v:,.2f}"

    def dstr(v):
        return v.isoformat() if v else "\u2014"

    def esc(v):
        return escape(str(v) if v is not None else "")

    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(404, "Invoice not found")
    if inv.status == "draft":
        raise HTTPException(404, "This invoice is not ready to share yet")

    company = db.query(Company).filter(Company.id == inv.company_id).first()
    seller = BusinessProfileRepository(db).get()
    project = db.query(Project).filter(Project.id == inv.project_id).first() if inv.project_id else None

    totals = InvoiceRepository.totals(inv)
    gst = InvoiceRepository.gst_totals(inv)

    seller_name = esc((seller.business_name if seller and seller.business_name else "") or "Finance Manager")
    seller_lines = []
    if seller:
        if seller.owner_name:
            seller_lines.append(esc(seller.owner_name))
        if seller.phone:
            seller_lines.append(f"Phone: {esc(seller.phone)}")
        if seller.email:
            seller_lines.append(f"Email: {esc(seller.email)}")
        if seller.gstin:
            seller_lines.append(f"GSTIN: {esc(seller.gstin)}")

    bill_lines = []
    if company:
        bill_lines.append(esc(company.name))
        if company.billing_address:
            bill_lines.append(esc(company.billing_address))
        loc = ", ".join(x for x in (company.city or "", company.state or "") if x)
        if company.pincode:
            loc = f"{loc} {company.pincode}" if loc else company.pincode
        if loc:
            bill_lines.append(esc(loc))
        if company.contact_email:
            bill_lines.append(f"Email: {esc(company.contact_email)}")
        if company.contact_phone:
            bill_lines.append(f"Phone: {esc(company.contact_phone)}")
        if company.gstin:
            bill_lines.append(f"GSTIN: {esc(company.gstin)}")

    has_hsn = any(it.hsn_sac for it in inv.items)

    def row(it):
        cells = f'<td>{esc(it.description)}</td>'
        if has_hsn:
            cells += f'<td class="muted">{esc(it.hsn_sac) if it.hsn_sac else "\u2014"}</td>'
        cells += (
            f'<td class="num">{it.quantity:g}</td>'
            f'<td class="num">{fmt(it.unit_price or 0)}</td>'
            f'<td class="num strong">{fmt((it.quantity or 0) * (it.unit_price or 0))}</td>'
        )
        return f"<tr>{cells}</tr>"

    rows = "".join(row(it) for it in (inv.items or []))
    if not rows:
        rows = f'<tr><td colspan="{5 if has_hsn else 4}" class="muted">No line items</td></tr>'

    head_cells = "<th>Description</th>"
    if has_hsn:
        head_cells += '<th class="muted">HSN/SAC</th>'
    head_cells += '<th class="num">Qty</th><th class="num">Rate</th><th class="num">Amount</th>'

    money_rows = ""
    if (inv.tax_rate or 0) > 0 and gst["tax_total"] <= 0:
        money_rows += f'<div class="mrow"><span>Tax ({esc(f"{inv.tax_rate:g}")}%)</span><span>{fmt(totals["tax"])}</span></div>'
    if gst["cgst_total"] > 0:
        money_rows += f'<div class="mrow"><span>CGST</span><span>{fmt(gst["cgst_total"])}</span></div>'
    if gst["sgst_total"] > 0:
        money_rows += f'<div class="mrow"><span>SGST</span><span>{fmt(gst["sgst_total"])}</span></div>'
    if gst["igst_total"] > 0:
        money_rows += f'<div class="mrow"><span>IGST</span><span>{fmt(gst["igst_total"])}</span></div>'

    status = esc((inv.status or "sent").replace("_", " ").title())
    badge_color = {
        "paid": "#15803d",
        "overdue": "#b91c1c",
    }.get(inv.status or "", "#1d4ed8")

    paid_row = ""
    if totals["balance_due"] > 0:
        paid_row = (
            f'<div class="mrow"><span>Paid</span><span>{fmt(inv.paid_amount or 0)}</span></div>'
            f'<div class="mrow total"><span>Balance due</span><span>{fmt(totals["balance_due"])}</span></div>'
        )
        total_line = fmt(totals["balance_due"])
    else:
        paid_row = f'<div class="mrow total"><span>Total</span><span>{fmt(totals["total"])}</span></div>'
        total_line = fmt(totals["total"])

    seller_blk = f'<strong class="brand">{seller_name}</strong>' + (
        f'<br>{"<br>".join(seller_lines)}' if seller_lines else ""
    )
    bill_blk = "<br>".join(bill_lines) or esc(company.name if company else "Client")

    project_note = ""
    if project and project.name:
        project_note = f'<div class="note">Project: {esc(project.name)}</div>'

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(inv.invoice_number)} — {esc(company.name if company else 'Invoice')}</title>
<style>
  * {{ box-sizing: border-box; }}
  body {{ font-family: Arial, Helvetica, sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; padding: 24px; }}
  .page {{ max-width: 760px; margin: 0 auto; background: #ffffff; color: #1e293b; border-radius: 14px; overflow: hidden; }}
  .inner {{ padding: 28px 30px 20px; }}
  .head {{ display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; flex-wrap: wrap; }}
  .brand {{ font-size: 22px; font-weight: 800; letter-spacing: -0.4px; color: #4f46e5; }}
  .invno {{ font-size: 18px; font-weight: 700; text-align: right; }}
  .meta {{ font-size: 12.5px; color: #64748b; margin-top: 3px; text-align: right; }}
  .block {{ margin-top: 22px; font-size: 13px; line-height: 1.55; }}
  .block b.title {{ font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: #94a3b8; display: block; margin-bottom: 4px; }}
  .badge {{ display: inline-block; background: {badge_color}; color: #fff; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 999px; margin-top: 8px; text-transform: uppercase; letter-spacing: .04em; }}
  table {{ width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px; }}
  th {{ text-align: left; padding: 8px; border-bottom: 2px solid #e2e8f0; color: #64748b; font-size: 11.5px; text-transform: uppercase; letter-spacing: .05em; }}
  td {{ padding: 8px; border-bottom: 1px solid #eef2f7; vertical-align: top; }}
  .num {{ text-align: right; white-space: nowrap; }}
  .strong {{ font-weight: 600; }}
  .muted {{ color: #94a3b8; }}
  .sums {{ width: 260px; margin: 16px 0 0 auto; font-size: 13px; }}
  .mrow {{ display: flex; justify-content: space-between; padding: 4px 0; color: #475569; }}
  .mrow.total {{ font-weight: 800; color: #0f172a; font-size: 14.5px; border-top: 1px solid #e2e8f0; margin-top: 6px; padding-top: 8px; }}
  .note {{ font-size: 12px; color: #64748b; margin-top: 10px; }}
  .foot {{ border-top: 1px solid #eef2f7; padding: 12px 30px 14px; font-size: 11.5px; color: #94a3b8; display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap; }}
</style>
</head>
<body>
<div class="page">
  <div class="inner">
    <div class="head">
      <div>{seller_blk}</div>
      <div><span class="invno">{esc(inv.invoice_number)}</span>
        <div class="meta">Issued {dstr(inv.issue_date)}<br>Due {dstr(inv.due_date)}</div>
        <span class="badge">{status}</span>
      </div>
    </div>
    <div class="block">
      <b class="title">Billed to</b>
      {bill_blk}
      {project_note}
    </div>
    <table>
      <thead><tr>{head_cells}</tr></thead>
      <tbody>{rows}</tbody>
    </table>
    <div class="sums">
      <div class="mrow"><span>Subtotal</span><span>{fmt(totals["subtotal"])}</span></div>
      {money_rows}
      {paid_row}
    </div>
    <div class="note">This is an official invoice from a freelance business. For payment queries, please reply directly to the sender.</div>
  </div>
  <div class="foot">
    <span>{esc(inv.invoice_number)} · generated {dstr(inv.issue_date)}</span>
    <span>Total {total_line}</span>
  </div>
</div>
</body>
</html>"""