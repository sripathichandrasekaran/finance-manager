from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse, Response
from fastapi import Query
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER
from io import BytesIO
from sqlalchemy.orm import Session

from app.core.timezone import today as ist_today
from app.db.session import get_db
from app.repositories.invoice_repository import InvoiceRepository
from app.models.company import Company
from app.models.project import Project
from app.models.invoice import Invoice, InvoicePayment, InvoiceEvent
from app.schemas.invoice import (
    InvoiceCreate,
    InvoiceUpdate,
    InvoiceRead,
    InvoiceLineItemRead,
    InvoiceStatusUpdate,
    InvoicePaymentCreate,
    InvoicePaymentRead,
    InvoiceEventRead,
)

router = APIRouter()


def _norm_date(v):
    if v is None:
        return None
    if isinstance(v, date):
        return v
    return datetime.fromisoformat(str(v)).date()


def _to_read(db: Session, inv: Invoice) -> InvoiceRead:
    company = db.query(Company).filter(Company.id == inv.company_id).first()
    project = None
    if inv.project_id:
        project = db.query(Project).filter(Project.id == inv.project_id).first()
    totals = InvoiceRepository.totals(inv)
    gst_totals = InvoiceRepository.gst_totals(inv)
    items = [
        InvoiceLineItemRead(
            id=it.id,
            invoice_id=it.invoice_id,
            description=it.description,
            quantity=it.quantity,
            unit_price=it.unit_price,
            total=round((it.quantity or 0) * (it.unit_price or 0), 2),
            hsn_sac=it.hsn_sac,
            tax_rate=it.tax_rate,
            cgst_rate=it.cgst_rate,
            sgst_rate=it.sgst_rate,
            igst_rate=it.igst_rate,
            cgst_amount=round((it.quantity or 0) * (it.unit_price or 0) * (it.cgst_rate or 0) / 100.0, 2),
            sgst_amount=round((it.quantity or 0) * (it.unit_price or 0) * (it.sgst_rate or 0) / 100.0, 2),
            igst_amount=round((it.quantity or 0) * (it.unit_price or 0) * (it.igst_rate or 0) / 100.0, 2),
        )
        for it in inv.items
    ]
    return InvoiceRead(
        id=inv.id,
        invoice_number=inv.invoice_number,
        sequence_number=inv.sequence_number,
        company_id=inv.company_id,
        company_name=company.name if company else None,
        project_id=inv.project_id,
        project_name=project.name if project else None,
        issue_date=inv.issue_date,
        due_date=inv.due_date,
        status=inv.status,
        tax_rate=inv.tax_rate,
        paid_amount=inv.paid_amount,
        notes=inv.notes,
        active=inv.active,
        place_of_supply=inv.place_of_supply,
        tax_type=inv.tax_type,
        items=items,
        subtotal=totals["subtotal"],
        tax=totals["tax"],
        total=totals["total"],
        balance_due=totals["balance_due"],
        cgst_total=gst_totals["cgst_total"],
        sgst_total=gst_totals["sgst_total"],
        igst_total=gst_totals["igst_total"],
    )


def _item_field(it, name):
    return it.get(name) if isinstance(it, dict) else getattr(it, name)


def _items_payload(items):
    return [
        {
            "description": _item_field(it, "description"),
            "quantity": _item_field(it, "quantity"),
            "unit_price": _item_field(it, "unit_price"),
            "hsn_sac": _item_field(it, "hsn_sac"),
            "tax_rate": _item_field(it, "tax_rate"),
            "cgst_rate": _item_field(it, "cgst_rate"),
            "sgst_rate": _item_field(it, "sgst_rate"),
            "igst_rate": _item_field(it, "igst_rate"),
        }
        for it in items
    ]


def _apply_gst_split(items, tax_type):
    """Fill cgst/sgst/igst rates from a plain tax_rate, mirroring the GST design."""
    for it in items:
        if (it.get("cgst_rate") or 0) + (it.get("sgst_rate") or 0) + (it.get("igst_rate") or 0) == 0:
            rate = it.get("tax_rate") or 0.0
            if rate > 0:
                if tax_type == "igst":
                    it["igst_rate"] = rate
                else:
                    half = rate / 2.0
                    it["cgst_rate"] = half
                    it["sgst_rate"] = half
    return items


@router.get("", response_model=list[InvoiceRead])
def list_invoices(
    company_id: int | None = None,
    status: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=2000),
    response: Response = None,
    db: Session = Depends(get_db),
):
    from app.core.pagination import apply_sequence_pagination, set_pagination_headers
    rows = InvoiceRepository(db).list(company_id=company_id, status=status)
    page_rows, total = apply_sequence_pagination(rows, page, page_size)
    set_pagination_headers(response, total, page, page_size)
    return [_to_read(db, r) for r in page_rows]


@router.post("", response_model=InvoiceRead, status_code=201)
def create_invoice(payload: InvoiceCreate, db: Session = Depends(get_db)):
    from app.repositories.business_profile_repository import BusinessProfileRepository
    company = db.query(Company).filter(Company.id == payload.company_id).first()
    if not company:
        raise HTTPException(404, "Company not found")
    if payload.project_id:
        project = db.query(Project).filter(Project.id == payload.project_id).first()
        if not project:
            raise HTTPException(404, "Project not found")

    # GST defaults: place of supply follows the client's state; tax type is
    # CGST+SGST when buyer and seller are in the same state, else IGST.
    seller = BusinessProfileRepository(db).get()
    place_of_supply = payload.place_of_supply or company.state
    tax_type = payload.tax_type
    if not tax_type:
        if (
            seller and company
            and seller.state_code and company.state_code
            and seller.state_code != company.state_code
        ):
            tax_type = "igst"
        else:
            tax_type = "gst"

    repo = InvoiceRepository(db)
    inv = repo.create(
        company_id=payload.company_id,
        project_id=payload.project_id,
        issue_date=_norm_date(payload.issue_date),
        due_date=_norm_date(payload.due_date),
        status=payload.status,
        tax_rate=payload.tax_rate or 0.0,
        paid_amount=payload.paid_amount or 0.0,
        notes=payload.notes,
        items=_apply_gst_split(_items_payload(payload.items), tax_type),
        invoice_number=payload.invoice_number,
        place_of_supply=place_of_supply,
        tax_type=tax_type,
    )
    return _to_read(db, inv)


@router.get("/{invoice_id}", response_model=InvoiceRead)
def get_invoice(invoice_id: int, db: Session = Depends(get_db)):
    inv = InvoiceRepository(db).get(invoice_id)
    if not inv:
        raise HTTPException(404, "Invoice not found")
    return _to_read(db, inv)


@router.patch("/{invoice_id}", response_model=InvoiceRead)
def update_invoice(invoice_id: int, payload: InvoiceUpdate, db: Session = Depends(get_db)):
    repo = InvoiceRepository(db)
    inv = repo.get(invoice_id)
    if not inv:
        raise HTTPException(404, "Invoice not found")
    fields = payload.model_dump(exclude_unset=True)
    if "invoice_number" in fields and fields["invoice_number"] is None:
        raise HTTPException(422, "invoice_number cannot be null")
    if "issue_date" in fields:
        fields["issue_date"] = _norm_date(fields["issue_date"])
    if "due_date" in fields:
        fields["due_date"] = _norm_date(fields["due_date"])
    if "items" in fields and fields["items"] is not None:
        tax_type = fields.get("tax_type") or inv.tax_type
        fields["items"] = _apply_gst_split(_items_payload(fields["items"]), tax_type)
    inv = repo.update(invoice_id, fields)
    return _to_read(db, inv)


@router.delete("/{invoice_id}")
def delete_invoice(invoice_id: int, db: Session = Depends(get_db)):
    if not InvoiceRepository(db).delete(invoice_id):
        raise HTTPException(404, "Invoice not found")
    return {"success": True}


@router.post("/{invoice_id}/status", response_model=InvoiceRead)
def update_invoice_status(invoice_id: int, payload: InvoiceStatusUpdate,
                          db: Session = Depends(get_db)):
    repo = InvoiceRepository(db)
    inv = repo.get(invoice_id)
    if not inv:
        raise HTTPException(404, "Invoice not found")
    update_fields = {"status": payload.status}
    if payload.paid_amount is not None:
        update_fields["paid_amount"] = payload.paid_amount
    inv = repo.update(invoice_id, update_fields)
    return _to_read(db, inv)


@router.get("/{invoice_id}/print", response_class=HTMLResponse)
def print_invoice(invoice_id: int, db: Session = Depends(get_db)):
    """Render a printable, print-request-ready HTML invoice."""
    from html import escape
    from app.repositories.business_profile_repository import BusinessProfileRepository
    inv = InvoiceRepository(db).get(invoice_id)
    if not inv:
        raise HTTPException(404, "Invoice not found")
    company = db.query(Company).filter(Company.id == inv.company_id).first()
    seller = BusinessProfileRepository(db).get()
    project = None
    if inv.project_id:
        project = db.query(Project).filter(Project.id == inv.project_id).first()
    totals = InvoiceRepository.totals(inv)
    gst_totals = InvoiceRepository.gst_totals(inv)

    def fmt(v):
        return f"₹{v:,.2f}"

    def dstr(v):
        return v.isoformat() if v else "\u2014"

    def esc_noop(v):
        return escape(str(v) if v is not None else "")

    def loc_line(city, state, pincode):
        base = ", ".join(x for x in (city, state) if x)
        if pincode:
            base = f"{base} {pincode}" if base else pincode
        return escape(base or "")

    def address_block(rec, name=None):
        lines = []
        if name:
            lines.append(escape(name))
        addr = escape(rec.billing_address or "") if rec else ""
        if addr:
            lines.append(addr)
        loc = loc_line(getattr(rec, "city", None), getattr(rec, "state", None), getattr(rec, "pincode", None))
        if loc:
            lines.append(loc)
        gstin = getattr(rec, "gstin", None)
        if gstin:
            lines.append(f"GSTIN: {escape(gstin)}")
        email = getattr(rec, "contact_email", None)
        if email:
            lines.append(escape(email))
        return "<br>".join(lines)

    seller_name = (seller.business_name if seller and seller.business_name else "Finance Manager") if seller else "Finance Manager"
    seller_lines = []
    if seller:
        if seller.owner_name:
            seller_lines.append(escape(seller.owner_name))
        if seller.address:
            seller_lines.append(escape(seller.address))
        loc = loc_line(seller.city, seller.state, seller.pincode)
        if loc:
            seller_lines.append(loc)
        if seller.gstin:
            seller_lines.append(f"GSTIN: {escape(seller.gstin)}")
        if seller.phone:
            seller_lines.append(f"Phone: {escape(seller.phone)}")
        if seller.email:
            seller_lines.append(f"Email: {escape(seller.email)}")

    seller_block = f"<strong>{escape(seller_name)}</strong>" + (f"<br>{'<br>'.join(seller_lines)}" if seller_lines else "")
    bill_block = f"<strong>{escape(company.name) if company else 'Unknown company'}</strong>"
    bill_addr = address_block(company)
    if bill_addr:
        bill_block += f"<br>{bill_addr}"
    if company and company.industry:
        bill_block += f"<br>{escape(company.industry)}"

    has_hsn = any(it.hsn_sac for it in inv.items)
    total_cols = 5 if has_hsn else 4

    def item_row(it):
        cells = f'<td>{esc_noop(it.description)}</td>'
        if has_hsn:
            cells += f'<td>{esc_noop(it.hsn_sac) if it.hsn_sac else "\u2014"}</td>'
        cells += (
            f'<td>{it.quantity:g}</td>'
            f'<td>{fmt(it.unit_price or 0)}</td>'
            f'<td class="num">{fmt((it.quantity or 0) * (it.unit_price or 0))}</td>'
        )
        return f"<tr>{cells}</tr>"

    rows = "".join(item_row(it) for it in inv.items)
    if not rows:
        rows = f'<tr><td colspan="{total_cols}" class="empty">No line items</td></tr>'

    if has_hsn:
        header_cells = '<th>Description</th><th>HSN/SAC</th><th>Qty</th><th>Rate</th><th class="num">Amount</th>'
    else:
        header_cells = '<th>Description</th><th>Qty</th><th>Rate</th><th class="num">Amount</th>'

    status_badge = inv.status or "draft"
    tax_label = "CGST + SGST" if inv.tax_type == "gst" else "IGST"

    tax_block = ""
    gst_rows = ""
    if gst_totals["cgst_total"] > 0:
        gst_rows += f'<div class="row"><span>CGST</span><span>{fmt(gst_totals["cgst_total"])}</span></div>'
    if gst_totals["sgst_total"] > 0:
        gst_rows += f'<div class="row"><span>SGST</span><span>{fmt(gst_totals["sgst_total"])}</span></div>'
    if gst_totals["igst_total"] > 0:
        gst_rows += f'<div class="row"><span>IGST</span><span>{fmt(gst_totals["igst_total"])}</span></div>'
    if gst_rows:
        tax_block = gst_rows
    elif (inv.tax_rate or 0) > 0:
        tax_block = f'<div class="row"><span>Tax ({inv.tax_rate:g}%)</span><span>{fmt(totals["tax"])}</span></div>'

    html = f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<title>{esc_noop(inv.invoice_number)}</title>
<style>
  body {{ font-family: Arial, Helvetica, sans-serif; color: #1E293B; margin: 0; padding: 40px; }}
  .head {{ display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; flex-wrap: wrap; }}
  .brand {{ font-size: 26px; font-weight: 800; letter-spacing: -0.5px; color: #5B4BD4; }}
  .brand small {{ display: block; font-size: 12px; font-weight: 600; color: #94A3B8; letter-spacing: 0; }}
  .meta {{ text-align: right; font-size: 13px; color: #475569; line-height: 1.6; }}
  .meta .no {{ font-weight: 700; font-size: 15px; color: #1E293B; }}
  .accent {{ height: 3px; background: #5B4BD4; border-radius: 2px; margin: 16px 0 20px; }}
  .parties {{ display: flex; gap: 40px; font-size: 13px; line-height: 1.7; }}
  .party {{ flex: 1; }}
  .party .title {{ display: block; font-weight: 700; margin-bottom: 4px; }}
  table {{ width: 100%; border-collapse: collapse; margin-top: 26px; border: 1px solid #E2E8F0; border-radius: 10px; overflow: hidden; }}
  thead th {{ background: #F0EEFB; font-weight: 700; font-size: 12px; }}
  th, td {{ padding: 9px 12px; text-align: left; font-size: 12.5px; border-bottom: 1px solid #E2E8F0; }}
  tbody tr:last-child td {{ border-bottom: none; }}
  td.num {{ text-align: right; }}
  td.empty {{ text-align: center; color: #94A3B8; padding: 20px; }}
  .totals {{ margin-top: 18px; width: 320px; margin-left: auto; font-size: 13px; }}
  .totals .row {{ display: flex; justify-content: space-between; padding: 5px 0; }}
  .totals .grand {{ font-weight: 700; font-size: 15px; border-top: 2px solid #1E293B; padding-top: 8px; margin-top: 4px; }}
  .totals .paid {{ color: #16A36A; }}
  .totals .bal {{ font-weight: 700; }}
  .badge {{ display: inline-block; padding: 2px 12px; border-radius: 999px; background: #F0EEFB; color: #5B4BD4; font-weight: 700; text-transform: uppercase; font-size: 11px; margin-bottom: 6px; }}
  .notes {{ margin-top: 22px; font-size: 13px; }}
  .notes .t {{ font-weight: 700; }}
  .footer {{ margin-top: 28px; padding-top: 12px; border-top: 1px solid #E5E7EB; text-align: center; font-size: 12px; color: #94A3B8; }}
  @media print {{ body {{ padding: 24px; }} }}
</style></head><body>
  <div class="head">
    <div class="brand">{esc_noop(seller_name)} <small>Invoice</small></div>
    <div class="meta">
      <div class="no">{esc_noop(inv.invoice_number)}</div>
      <span class="badge">{esc_noop(status_badge)}</span>
      <div>Issued: {dstr(inv.issue_date)}</div>
      <div>Due: {dstr(inv.due_date)}</div>
      {f'<div>Place of supply: {esc_noop(inv.place_of_supply)}</div>' if inv.place_of_supply else ""}
      {f'<div>Tax type: {esc_noop(tax_label)}</div>' if inv.tax_type else ""}
    </div>
  </div>

  <div class="accent"></div>

  <div class="parties">
    <div class="party"><span class="title">From</span>{seller_block}</div>
    <div class="party"><span class="title">Bill to</span>{bill_block}</div>
  </div>

  {f'<div style="margin-top:14px;font-size:13px;"><strong>Project:</strong> {esc_noop(project.name)}</div>' if project else ""}

  <table>
    <thead><tr>{header_cells}</tr></thead>
    <tbody>{rows}</tbody>
  </table>

  <div class="totals">
    <div class="row"><span>Subtotal</span><span>{fmt(totals['subtotal'])}</span></div>
    {tax_block}
    <div class="row grand"><span>Total</span><span>{fmt(totals['total'])}</span></div>
    <div class="row paid"><span>Paid</span><span>{fmt(inv.paid_amount or 0)}</span></div>
    <div class="row bal"><span>Balance due</span><span>{fmt(totals['balance_due'])}</span></div>
  </div>

  {f'<div class="notes"><span class="t">Notes</span><br>{esc_noop(inv.notes)}</div>' if inv.notes else ""}

  <div class="footer">Generated by {esc_noop(seller_name)} &middot; Thank you for your business!</div>

  <script>window.onload = function () {{ setTimeout(function () {{ window.print(); }}, 300); }};</script>
</body></html>"""
    return HTMLResponse(content=html)


@router.get("/{invoice_id}/pdf")
def pdf_invoice(invoice_id: int, db: Session = Depends(get_db)):
    """Generate a professional flat-design PDF invoice using ReportLab."""
    from app.repositories.business_profile_repository import BusinessProfileRepository
    inv = InvoiceRepository(db).get(invoice_id)
    if not inv:
        raise HTTPException(404, "Invoice not found")
    company = db.query(Company).filter(Company.id == inv.company_id).first()
    seller = BusinessProfileRepository(db).get()
    project = None
    if inv.project_id:
        project = db.query(Project).filter(Project.id == inv.project_id).first()
    totals = InvoiceRepository.totals(inv)
    gst_totals = InvoiceRepository.gst_totals(inv)

    def esc(v):
        return str(v) if v is not None else ""

    def loc_line(city, state, pincode):
        base = ", ".join(x for x in (city, state) if x)
        if pincode:
            base = f"{base} {pincode}" if base else pincode
        return base

    seller_brand = (seller.business_name if seller and seller.business_name else "Finance Manager")
    seller_lines = [f"<b>{esc(seller_brand)}</b>"]
    if seller:
        if seller.owner_name:
            seller_lines.append(esc(seller.owner_name))
        if seller.address:
            seller_lines.append(esc(seller.address))
        seller_loc = loc_line(seller.city, seller.state, seller.pincode)
        if seller_loc:
            seller_lines.append(esc(seller_loc))
        if seller.gstin:
            seller_lines.append(f"GSTIN: {esc(seller.gstin)}")
        if seller.phone:
            seller_lines.append(f"Phone: {esc(seller.phone)}")
        if seller.email:
            seller_lines.append(f"Email: {esc(seller.email)}")

    bill_lines = []
    if company:
        bill_lines.append(f"<b>{esc(company.name)}</b>")
        if company.billing_address:
            bill_lines.append(esc(company.billing_address))
        company_loc = loc_line(company.city, company.state, company.pincode)
        if company_loc:
            bill_lines.append(esc(company_loc))
        if company.gstin:
            bill_lines.append(f"GSTIN: {esc(company.gstin)}")
        if company.contact_email:
            bill_lines.append(esc(company.contact_email))
    else:
        bill_lines.append("<b>Unknown Company</b>")

    meta_lines = []
    if project:
        meta_lines.append(f"<b>Project:</b> {esc(project.name)}")
    if inv.place_of_supply:
        meta_lines.append(f"<b>Place of Supply:</b> {esc(inv.place_of_supply)}")
    if inv.tax_type:
        tax_label = "CGST + SGST" if inv.tax_type == "gst" else "IGST"
        meta_lines.append(f"<b>Tax Type:</b> {tax_label}")

    # Flat design color palette
    BRAND_COLOR = colors.HexColor("#5B4BD4")
    BRAND_DARK = colors.HexColor("#4A3BAF")
    TEXT_DARK = colors.HexColor("#1E293B")
    TEXT_MEDIUM = colors.HexColor("#475569")
    TEXT_LIGHT = colors.HexColor("#94A3B8")
    BG_LIGHT = colors.HexColor("#F8FAFC")
    BORDER_COLOR = colors.HexColor("#E2E8F0")
    SUCCESS_COLOR = colors.HexColor("#10B981")
    WHITE = colors.white

    def fmt(v):
        return f"₹{v:,.2f}"

    def dstr(v):
        return v.isoformat() if v else "—"

    # Build PDF in memory
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=25 * mm,
        leftMargin=25 * mm,
        topMargin=25 * mm,
        bottomMargin=25 * mm,
    )

    styles = getSampleStyleSheet()
    style_normal = ParagraphStyle(
        "NormalFlat", parent=styles["Normal"],
        fontName="Helvetica", fontSize=9, leading=13,
        textColor=TEXT_DARK,
    )
    style_bold = ParagraphStyle("BoldFlat", parent=style_normal, fontName="Helvetica-Bold")
    style_right = ParagraphStyle("RightFlat", parent=style_normal, alignment=TA_RIGHT)
    style_center = ParagraphStyle("CenterFlat", parent=style_normal, alignment=TA_CENTER)
    style_small = ParagraphStyle("SmallFlat", parent=style_normal, fontSize=8, textColor=TEXT_LIGHT)

    # Brand styles
    style_brand = ParagraphStyle(
        "BrandFlat", parent=style_normal,
        fontName="Helvetica-Bold", fontSize=22,
        textColor=BRAND_COLOR, spaceAfter=2,
    )
    style_brand_sub = ParagraphStyle(
        "BrandSubFlat", parent=style_normal,
        fontSize=9, textColor=TEXT_LIGHT, spaceAfter=10,
    )
    style_heading = ParagraphStyle(
        "HeadingFlat", parent=style_bold,
        fontSize=11, textColor=TEXT_DARK, spaceBefore=14, spaceAfter=6,
    )
    style_label = ParagraphStyle(
        "LabelFlat", parent=style_bold,
        fontSize=9, textColor=TEXT_MEDIUM,
    )
    style_amount = ParagraphStyle(
        "AmountFlat", parent=style_bold,
        fontSize=10, textColor=TEXT_DARK, alignment=TA_RIGHT,
    )

    elements = []

    # ==================== HEADER SECTION ====================
    # Brand + Invoice meta in a two-column layout
    header_data = [
        [
            Paragraph(f"{esc(seller_brand)}<br/><font size=8 color='#64748B'>Invoice</font>", ParagraphStyle(
                "BrandTemp", parent=style_brand, leading=28,
            )),
            Paragraph(
                f"<b>{inv.invoice_number}</b><br/>"
                f"<font size=9 color='#5B4BD4'>{(inv.status or 'draft').upper()}</font><br/>"
                f"Issued: {dstr(inv.issue_date)}<br/>"
                f"Due: {dstr(inv.due_date)}",
                style_right,
            ),
        ]
    ]
    header_table = Table(header_data, colWidths=[105 * mm, 75 * mm])
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 14),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
    ]))
    elements.append(header_table)

    # Thin brand accent line
    accent_line = Table([[""]], colWidths=[180 * mm])
    accent_line.setStyle(TableStyle([
        ("LINEBELOW", (0, 0), (-1, -1), 3, BRAND_COLOR),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    elements.append(accent_line)

    # ==================== FROM / BILL TO / GST ====================
    from_block = Paragraph("<b>From</b><br/>" + "<br/>".join(seller_lines), style_normal)
    bill_block = "<b>Bill To</b><br/>" + "<br/>".join(bill_lines)
    if meta_lines:
        bill_block += "<br/><br/>" + "<br/>".join(meta_lines)

    parties_data = [
        [from_block, Paragraph(bill_block, style_normal)],
    ]
    parties_table = Table(parties_data, colWidths=[90 * mm, 90 * mm])
    parties_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(parties_table)
    elements.append(Spacer(1, 6 * mm))

    # ==================== LINE ITEMS TABLE ====================
    table_data = [
        [
            Paragraph("<b>Description</b>", style_bold),
            Paragraph("<b>HSN/SAC</b>", style_center),
            Paragraph("<b>Qty</b>", style_center),
            Paragraph("<b>Rate</b>", style_right),
            Paragraph("<b>Tax%</b>", style_center),
            Paragraph("<b>CGST</b>", style_right),
            Paragraph("<b>SGST</b>", style_right),
            Paragraph("<b>IGST</b>", style_right),
            Paragraph("<b>Amount</b>", style_right),
        ]
    ]

    for it in inv.items:
        line_total = round((it.quantity or 0) * (it.unit_price or 0), 2)
        cgst_amt = round(line_total * (it.cgst_rate or 0) / 100.0, 2)
        sgst_amt = round(line_total * (it.sgst_rate or 0) / 100.0, 2)
        igst_amt = round(line_total * (it.igst_rate or 0) / 100.0, 2)
        table_data.append([
            Paragraph(it.description or "", style_normal),
            Paragraph(it.hsn_sac or "—", style_center),
            Paragraph(f"{it.quantity:g}", style_center),
            Paragraph(fmt(it.unit_price or 0), style_right),
            Paragraph(f"{(it.tax_rate or 0):g}%", style_center),
            Paragraph(fmt(cgst_amt) if cgst_amt else "—", style_right),
            Paragraph(fmt(sgst_amt) if sgst_amt else "—", style_right),
            Paragraph(fmt(igst_amt) if igst_amt else "—", style_right),
            Paragraph(fmt(line_total), style_amount),
        ])

    if len(table_data) == 1:
        table_data.append([
            Paragraph("No line items", style_small),
            "", "", "", "", "", "", "", ""
        ])

    col_widths = [55 * mm, 16 * mm, 12 * mm, 20 * mm, 14 * mm, 18 * mm, 18 * mm, 18 * mm, 27 * mm]
    items_table = Table(table_data, colWidths=col_widths, repeatRows=1)

    items_table.setStyle(TableStyle([
        # Header row
        ("BACKGROUND", (0, 0), (-1, 0), BRAND_COLOR),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 8),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 8),
        ("TOPPADDING", (0, 0), (-1, 0), 8),
        # Body
        ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 1), (-1, -1), 8),
        ("TOPPADDING", (0, 1), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 5),
        # Grid - flat, subtle
        ("GRID", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        # Alternating rows - very subtle
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, BG_LIGHT]),
        # Rounded corners via inner grid
        ("BOX", (0, 0), (-1, -1), 1, BORDER_COLOR),
    ]))

    elements.append(items_table)
    elements.append(Spacer(1, 6 * mm))

    # ==================== TOTALS SECTION ====================
    totals_data = [
        [Paragraph("Subtotal", style_bold), Paragraph(fmt(totals["subtotal"]), style_right)],
        [Paragraph("CGST", style_label), Paragraph(fmt(gst_totals["cgst_total"]), style_right)],
        [Paragraph("SGST", style_label), Paragraph(fmt(gst_totals["sgst_total"]), style_right)],
        [Paragraph("IGST", style_label), Paragraph(fmt(gst_totals["igst_total"]), style_right)],
        [Paragraph("Total Tax", style_bold), Paragraph(fmt(gst_totals["tax_total"]), style_right)],
        [Paragraph("Total", style_bold), Paragraph(f"<b>{fmt(totals['total'])}</b>", style_amount)],
        [Paragraph("Paid", style_label), Paragraph(fmt(inv.paid_amount or 0), style_right)],
        [Paragraph("<b>Balance Due</b>", style_heading), Paragraph(f"<b>{fmt(totals['balance_due'])}</b>", style_amount)],
    ]
    totals_table = Table(totals_data, colWidths=[110 * mm, 40 * mm])
    totals_table.setStyle(TableStyle([
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LINEABOVE", (0, -1), (-1, -1), 2, TEXT_DARK),
        ("LINEBELOW", (0, -4), (-1, -4), 1, BORDER_COLOR),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    elements.append(totals_table)
    elements.append(Spacer(1, 8 * mm))

    # ==================== NOTES ====================
    if inv.notes:
        elements.append(Paragraph("<b>Notes</b>", style_heading))
        elements.append(Paragraph(inv.notes, style_normal))
        elements.append(Spacer(1, 4 * mm))

    # ==================== FOOTER ====================
    elements.append(Spacer(1, 12 * mm))
    footer_data = [
        [
            Paragraph(
                f"Generated by {esc(seller_brand)}<br/>Thank you for your business!",
                ParagraphStyle("FooterFlat", parent=style_center, fontSize=8, textColor=TEXT_LIGHT, leading=12)
            ),
        ]
    ]
    footer_table = Table(footer_data, colWidths=[180 * mm])
    footer_table.setStyle(TableStyle([
        ("LINEABOVE", (0, 0), (-1, -1), 1, BORDER_COLOR),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
    ]))
    elements.append(footer_table)

    # Build PDF
    doc.build(elements)
    pdf_bytes = buffer.getvalue()
    buffer.close()

    filename = f"{inv.invoice_number}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ==================== Payment History ====================

@router.post("/{invoice_id}/payments", response_model=InvoicePaymentRead, status_code=201)
def add_payment(invoice_id: int, payload: InvoicePaymentCreate, db: Session = Depends(get_db)):
    from app.models.invoice import InvoicePayment
    inv = InvoiceRepository(db).get(invoice_id)
    if not inv:
        raise HTTPException(404, "Invoice not found")
    payment_date = _norm_date(payload.payment_date) or ist_today()
    payment = InvoicePayment(
        invoice_id=invoice_id,
        amount=payload.amount,
        payment_date=payment_date,
        payment_method=payload.payment_method,
        reference=payload.reference,
        notes=payload.notes,
    )
    db.add(payment)
    # Update invoice paid_amount
    inv.paid_amount = (inv.paid_amount or 0.0) + payload.amount
    # Update status if fully paid
    totals = InvoiceRepository.totals(inv)
    if inv.paid_amount >= totals["total"]:
        inv.status = "paid"
    # Record event
    from app.models.invoice import InvoiceEvent
    event = InvoiceEvent(
        invoice_id=invoice_id,
        event_type="payment",
        old_value=str(inv.paid_amount - payload.amount),
        new_value=str(inv.paid_amount),
        description=f"Payment of ₹{payload.amount:,.2f} received via {payload.payment_method or 'unknown'}",
    )
    db.add(event)
    db.commit()
    db.refresh(payment)
    return payment


@router.get("/{invoice_id}/payments", response_model=list[InvoicePaymentRead])
def list_payments(
    invoice_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=2000),
    response: Response = None,
    db: Session = Depends(get_db),
):
    from app.models.invoice import InvoicePayment
    from app.core.pagination import apply_sequence_pagination, set_pagination_headers
    inv = InvoiceRepository(db).get(invoice_id)
    if not inv:
        raise HTTPException(404, "Invoice not found")
    payments = db.query(InvoicePayment).filter(InvoicePayment.invoice_id == invoice_id).order_by(InvoicePayment.payment_date.desc()).all()
    page_rows, total = apply_sequence_pagination(payments, page, page_size)
    set_pagination_headers(response, total, page, page_size)
    return page_rows


@router.delete("/{invoice_id}/payments/{payment_id}")
def delete_payment(invoice_id: int, payment_id: int, db: Session = Depends(get_db)):
    from app.models.invoice import InvoicePayment, InvoiceEvent
    payment = db.query(InvoicePayment).filter(InvoicePayment.id == payment_id, InvoicePayment.invoice_id == invoice_id).first()
    if not payment:
        raise HTTPException(404, "Payment not found")
    # Reverse the paid amount
    inv = InvoiceRepository(db).get(invoice_id)
    if inv:
        inv.paid_amount = max(0, (inv.paid_amount or 0) - payment.amount)
        if inv.paid_amount < (InvoiceRepository.totals(inv)["total"] or 0):
            inv.status = "sent" if inv.status == "paid" else inv.status
        # Record event
        event = InvoiceEvent(
            invoice_id=invoice_id,
            event_type="payment_deleted",
            old_value=str(payment.amount),
            new_value="0",
            description=f"Payment of ₹{payment.amount:,.2f} deleted",
        )
        db.add(event)
    db.delete(payment)
    db.commit()
    return {"success": True}


# ==================== Event History / Audit Trail ====================

@router.get("/{invoice_id}/events", response_model=list[InvoiceEventRead])
def list_events(
    invoice_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=2000),
    response: Response = None,
    db: Session = Depends(get_db),
):
    from app.models.invoice import InvoiceEvent
    from app.core.pagination import apply_sequence_pagination, set_pagination_headers
    inv = InvoiceRepository(db).get(invoice_id)
    if not inv:
        raise HTTPException(404, "Invoice not found")
    events = db.query(InvoiceEvent).filter(InvoiceEvent.invoice_id == invoice_id).order_by(InvoiceEvent.created_at.desc()).all()
    page_rows, total = apply_sequence_pagination(events, page, page_size)
    set_pagination_headers(response, total, page, page_size)
    return page_rows