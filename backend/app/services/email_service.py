"""Email service for sending invoices and notifications."""
from __future__ import annotations

import os
import ssl
from email.message import EmailMessage
from typing import Optional

import aiosmtplib

from app.core.config import settings


class EmailService:
    def __init__(self):
        self.smtp_host = getattr(settings, "SMTP_HOST", None)
        self.smtp_port = getattr(settings, "SMTP_PORT", 587)
        self.smtp_user = getattr(settings, "SMTP_USER", None)
        self.smtp_password = getattr(settings, "SMTP_PASSWORD", None)
        self.smtp_tls = getattr(settings, "SMTP_TLS", True)
        self.from_email = getattr(settings, "EMAIL_FROM", "noreply@financemanager.local")
        self.from_name = getattr(settings, "EMAIL_FROM_NAME", "Finance Manager")

    def is_configured(self) -> bool:
        return bool(self.smtp_host and self.smtp_user and self.smtp_password)

    async def send(
        self,
        to_email: str,
        subject: str,
        html_body: str,
        text_body: Optional[str] = None,
        attachments: Optional[list[tuple[str, bytes, str]]] = None,
    ) -> bool:
        """Send an email. Returns True on success."""
        if not self.is_configured():
            return False

        msg = EmailMessage()
        msg["From"] = f"{self.from_name} <{self.from_email}>"
        msg["To"] = to_email
        msg["Subject"] = subject

        if text_body:
            msg.set_content(text_body)
        msg.add_alternative(html_body, subtype="html")

        if attachments:
            for filename, content, mime_type in attachments:
                msg.add_attachment(
                    content,
                    maintype=mime_type.split("/")[0],
                    subtype=mime_type.split("/")[1],
                    filename=filename,
                )

        try:
            if self.smtp_tls:
                tls_context = ssl.create_default_context()
                await aiosmtplib.send(
                    msg,
                    hostname=self.smtp_host,
                    port=self.smtp_port,
                    username=self.smtp_user,
                    password=self.smtp_password,
                    start_tls=True,
                    tls_context=tls_context,
                )
            else:
                await aiosmtplib.send(
                    msg,
                    hostname=self.smtp_host,
                    port=self.smtp_port,
                    username=self.smtp_user,
                    password=self.smtp_password,
                )
            return True
        except Exception:
            return False


email_service = EmailService()