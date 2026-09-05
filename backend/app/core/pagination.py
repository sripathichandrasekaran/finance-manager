"""Server-side pagination helpers.

Applies offset/limit to a SQLAlchemy query (returning the page plus the total
row count) and stamps the pagination metadata onto a FastAPI Response via
X-* headers, so list-shaped APIs keep returning plain arrays while still
carrying enough info for the client to render pagination controls.
"""

import math

from fastapi import Response


def apply_pagination(query, page: int, page_size: int):
    """Page a SQLAlchemy query. Returns (items, total)."""
    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    return items, total


def apply_sequence_pagination(items, page: int, page_size: int):
    """Page an in-memory sequence (already fully computed). Returns (items, total)."""
    total = len(items)
    start = (page - 1) * page_size
    return items[start:start + page_size], total


def set_pagination_headers(response: Response, total: int, page: int, page_size: int) -> None:
    pages = max(1, math.ceil(total / page_size)) if page_size else 1
    response.headers["X-Total-Count"] = str(total)
    response.headers["X-Page"] = str(page)
    response.headers["X-Page-Size"] = str(page_size)
    response.headers["X-Pages"] = str(pages)