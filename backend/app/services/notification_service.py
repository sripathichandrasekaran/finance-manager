"""Realtime notification service.

Bridges the sync scheduler (which runs in a `threading.Thread`) with FastAPI's
asyncio WebSocket connections. Notifications are persisted to the database so
they survive a reload, then pushed live over WebSocket to every connected
client (the in-app bell + browser notifications).

The hub captures the running asyncio loop from the first WebSocket connection
and uses `run_coroutine_threadsafe` so the scheduler thread can broadcast
without owning the loop.
"""

from __future__ import annotations

import asyncio
import threading
from typing import Optional

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.timezone import iso as _iso
from app.models.notification import NotificationType
from app.repositories.notification_repository import NotificationRepository


class NotificationHub:
    def __init__(self) -> None:
        self._queues: set[asyncio.Queue] = set()
        self._lock = threading.Lock()
        self._loop: Optional[asyncio.AbstractEventLoop] = None

    def attach_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        """Record the asyncio loop that owns WebSocket connections so sync
        threads (scheduler) can schedule broadcasts onto it."""
        self._loop = loop

    async def handle(self, websocket) -> None:
        """Serve a single WebSocket client: register it and relay events."""
        q: asyncio.Queue = asyncio.Queue(maxsize=500)
        with self._lock:
            self._queues.add(q)
        try:
            # Keep the connection open and the client registered. The client
            # may disconnect at any time — we just stop relaying.
            while True:
                event = await q.get()
                try:
                    await websocket.send_json(event)
                except Exception:  # noqa: BLE001
                    return
        finally:
            with self._lock:
                self._queues.discard(q)

    def broadcast(self, event: dict) -> None:
        """Push an event to all connected clients. Safe to call from any thread."""
        if self._loop is None:
            return
        try:
            asyncio.run_coroutine_threadsafe(self._broadcast_async(event), self._loop)
        except RuntimeError:
            pass

    async def _broadcast_async(self, event: dict) -> None:
        with self._lock:
            queues = list(self._queues)
        for q in queues:
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:
                pass


hub = NotificationHub()


def _serialize(n) -> dict:
    from app.models.base import TimestampMixin  # noqa: F401  (ensure created_at attr)
    return {
        "id": n.id,
        "title": n.title,
        "message": n.message,
        "type": n.type.value if hasattr(n.type, "value") else str(n.type),
        "link": n.link,
        "read": n.read,
        "created_at": _iso(n.created_at),
    }


def notify(db: Session, title: str, message: Optional[str] = None,
           type_: NotificationType = NotificationType.SYSTEM,
           link: Optional[str] = None) -> dict:
    """Persist a notification and broadcast it live to connected clients."""
    n = NotificationRepository(db).create(title=title, message=message, type_=type_, link=link)
    payload = _serialize(n)
    payload["event"] = "notification.new"
    hub.broadcast(payload)
    return payload


def broadcast_system(title: str, message: Optional[str] = None, link: Optional[str] = None) -> None:
    """Broadcast a system/status event without persisting it (e.g. server start)."""
    hub.broadcast({
        "event": "system",
        "title": title,
        "message": message,
        "type": NotificationType.SYSTEM.value,
        "link": link,
    })
