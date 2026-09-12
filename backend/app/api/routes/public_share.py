"""Public, accountless endpoint that renders a shared invoice.

Mounted under /api/public on purpose: in the production topology nginx only
proxies /api to the backend, so a link like
    https://finance.pilotmessenger.com/api/public/inv/<token>
works for clients in any browser or WhatsApp with zero infra changes, while
the token itself carries no secrets (signed HMAC)."""

import logging

from fastapi import APIRouter, Depends
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.services.invoice_share_service import parse_token, build_invoice_public_html

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/inv/{token}", response_class=HTMLResponse)
def view_shared_invoice(token: str, db: Session = Depends(get_db)):
    invoice_id = parse_token(token)
    if invoice_id is None:
        return HTMLResponse(
            _error_page("This invoice link is not valid."),
            status_code=404,
        )
    try:
        return build_invoice_public_html(invoice_id, db)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Share view failed for invoice %s: %s", invoice_id, exc)
        return HTMLResponse(
            _error_page("This invoice could not be displayed."),
            status_code=404,
        )


def _error_page(message: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Invoice</title>
<style>
  body {{ font-family: Arial, Helvetica, sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; }}
  .wrap {{ max-width: 440px; margin: 12vh auto; padding: 24px; text-align: center; }}
  .box {{ background: #1e293b; border: 1px solid #334155; border-radius: 14px; padding: 32px; }}
  h1 {{ font-size: 18px; margin: 0 0 10px; }}
  p {{ color: #94a3b8; font-size: 14px; margin: 0; }}
</style></head>
<body>
  <div class="wrap"><div class="box"><h1>Invoice</h1><p>{message}</p></div></div>
</body></html>"""