from datetime import date
from typing import Optional

from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.invoice import Invoice, InvoiceLineItem
from app.models.company import Company


class InvoiceRepository:
    """Data-access layer for invoices."""

    def __init__(self, db: Session):
        self.db = db

    def _generate_invoice_number(self, company_id: int) -> tuple[str, int]:
        """Generate the next sequential invoice number for a company.
        Returns (invoice_number, sequence_number)."""
        company = self.db.query(Company).filter(Company.id == company_id).first()
        if not company:
            # Fallback if company not found
            seq = 1
            return f"INV-{seq:04d}", seq

        prefix = company.invoice_prefix or "INV"
        digits = company.invoice_digits or 4
        next_num = company.invoice_next_number or 1

        invoice_number = f"{prefix}-{next_num:0{digits}d}"

        # Increment for next time
        company.invoice_next_number = next_num + 1
        self.db.commit()

        return invoice_number, next_num

    def create(self, company_id: int, project_id: Optional[int] = None,
               issue_date: Optional[date] = None, due_date: Optional[date] = None,
               status: Optional[str] = "draft", tax_rate: float = 0.0,
               paid_amount: float = 0.0, notes: Optional[str] = None,
               items: Optional[list[dict]] = None, active: bool = True,
               invoice_number: Optional[str] = None,
               place_of_supply: Optional[str] = None,
               tax_type: Optional[str] = "gst") -> Invoice:
        # Generate invoice number if not provided
        if not invoice_number:
            invoice_number, seq = self._generate_invoice_number(company_id)
        else:
            seq = None

        inv = Invoice(
            invoice_number=invoice_number,
            company_id=company_id,
            sequence_number=seq,
            project_id=project_id,
            issue_date=issue_date,
            due_date=due_date,
            status=status or "draft",
            tax_rate=tax_rate or 0.0,
            paid_amount=paid_amount or 0.0,
            notes=notes,
            active=active,
            place_of_supply=place_of_supply,
            tax_type=tax_type,
        )
        self.db.add(inv)
        self.db.flush()
        for it in items or []:
            self.db.add(InvoiceLineItem(
                invoice_id=inv.id,
                description=it.get("description"),
                quantity=it.get("quantity") or 1.0,
                unit_price=it.get("unit_price") or 0.0,
                hsn_sac=it.get("hsn_sac"),
                tax_rate=it.get("tax_rate") or 0.0,
                cgst_rate=it.get("cgst_rate") or 0.0,
                sgst_rate=it.get("sgst_rate") or 0.0,
                igst_rate=it.get("igst_rate") or 0.0,
            ))
        self.db.commit()
        self.db.refresh(inv)
        return inv

    def get(self, invoice_id: int) -> Optional[Invoice]:
        return self.db.query(Invoice).filter(Invoice.id == invoice_id).first()

    def list(self, company_id: Optional[int] = None, status: Optional[str] = None) -> list[Invoice]:
        q = self.db.query(Invoice)
        if company_id:
            q = q.filter(Invoice.company_id == company_id)
        if status:
            q = q.filter(Invoice.status == status)
        return q.order_by(Invoice.id.desc()).all()

    def update(self, invoice_id: int, fields: dict) -> Optional[Invoice]:
        inv = self.get(invoice_id)
        if not inv:
            return None
        for key, value in fields.items():
            if value is None or key in ("id", "items"):
                continue
            if hasattr(inv, key):
                setattr(inv, key, value)
        if "items" in fields and fields["items"] is not None:
            new_items = fields["items"]
            # Clear the old line items and re-add.
            self.db.query(InvoiceLineItem).filter(
                InvoiceLineItem.invoice_id == invoice_id).delete()
            for it in new_items:
                self.db.add(InvoiceLineItem(
                    invoice_id=invoice_id,
                    description=it.get("description"),
                    quantity=it.get("quantity") or 1.0,
                    unit_price=it.get("unit_price") or 0.0,
                    hsn_sac=it.get("hsn_sac"),
                    tax_rate=it.get("tax_rate") or 0.0,
                    cgst_rate=it.get("cgst_rate") or 0.0,
                    sgst_rate=it.get("sgst_rate") or 0.0,
                    igst_rate=it.get("igst_rate") or 0.0,
                ))
            self.db.flush()
        self.db.commit()
        self.db.refresh(inv)
        return inv

    def delete(self, invoice_id: int) -> bool:
        inv = self.get(invoice_id)
        if not inv:
            return False
        self.db.delete(inv)
        self.db.commit()
        return True

    @staticmethod
    def subtotal(items: list[InvoiceLineItem]) -> float:
        return round(sum((i.quantity or 0) * (i.unit_price or 0) for i in items), 2)

    @staticmethod
    def totals(inv: Invoice) -> dict:
        subtotal = InvoiceRepository.subtotal(inv.items)
        tax = round(subtotal * (inv.tax_rate or 0.0) / 100.0, 2)
        total = round(subtotal + tax, 2)
        paid = inv.paid_amount or 0.0
        return {
            "subtotal": subtotal,
            "tax": tax,
            "total": total,
            "balance_due": round(total - paid, 2),
        }

    @staticmethod
    def gst_totals(inv: Invoice) -> dict:
        """Calculate GST breakdown (CGST, SGST, IGST) per line item and aggregate."""
        cgst_total = 0.0
        sgst_total = 0.0
        igst_total = 0.0
        for item in inv.items:
            line_total = round((item.quantity or 0) * (item.unit_price or 0), 2)
            if inv.tax_type == "igst":
                igst = round(line_total * (item.igst_rate or 0.0) / 100.0, 2)
                igst_total += igst
            else:
                cgst = round(line_total * (item.cgst_rate or 0.0) / 100.0, 2)
                sgst = round(line_total * (item.sgst_rate or 0.0) / 100.0, 2)
                cgst_total += cgst
                sgst_total += sgst
        tax_total = round(cgst_total + sgst_total + igst_total, 2)
        return {
            "cgst_total": round(cgst_total, 2),
            "sgst_total": round(sgst_total, 2),
            "igst_total": round(igst_total, 2),
            "tax_total": tax_total,
        }