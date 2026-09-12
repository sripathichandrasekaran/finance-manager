"""Schedulable collectors for the Gig Radar.

Every collector is stateless: it returns a list of normalized opportunity
dicts and never touches the database. Only no-key (public) sources are used —
Reddit's public JSON endpoints and the free JSON APIs of Remotive/RemoteOK.
Each dict carries:

  source        e.g. "reddit" | "remotive" | "remoteok"
  source_key    stable unique key for dedupe (f"{source}:{remote_id}")
  source_label  human label, e.g. "r/forhire" or the company name
  title, description, url, posted_at, location, budget_*, currency, skills
"""

from __future__ import annotations

import json
import logging
import re
import time
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

_TIMEOUT = 20
# Reddit blocks default library User-Agents (403); a real browser UA is
# required for its public `.json` endpoints.
_UA = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json,text/*,*/*",
    "Accept-Language": "en-US,en;q=0.9",
}

# Keywords that indicate the post/client is looking for the kind of work the
# user sells (React/web frontend). Titles containing these are kept; anything
# else (esp. [+]For Hire[+] ads) is dropped.
_HIRING_MARKERS = (
    "hiring",
    "looking for",
    "need a ",
    "need an ",
    "need someone",
    "seeking",
    "freelancer",
    "job:",
    "help building",
    "website for",
    "build a",
    "build an",
)

_FRONTEND_TERMS = (
    "react", "frontend", "front-end", "front end", "javascript", "typescript",
    "next.js", "nextjs", "remix", "wordpress", "web developer", "web development",
    "web application", "web dev", "ui developer", "ui/ux", "landing page",
    "tailwind", "dashboard", "shopify", "ecommerce", "e-commerce",
)


def _http_json(url: str) -> dict | list | None:
    import urllib.request

    req = urllib.request.Request(url, headers=_UA)
    with urllib.request.urlopen(req, timeout=_TIMEOUT) as resp:
        return json.loads(resp.read().decode("utf-8", "replace"))


def _is_hiring_post(title: str) -> bool:
    t = title.lower().strip()
    if t.startswith("[for hire]") or t.startswith("[for-hire]") or "for hire" in t and "hiring" not in t:
        return False
    if "for sale" in t:
        return False
    return any(marker in t for marker in _HIRING_MARKERS)


def _matches_frontend(blob: str) -> bool:
    blob = blob.lower()
    return any(term in blob for term in _FRONTEND_TERMS)


def _parse_k_currency(text) -> float | None:
    """Parse strings like '$40k', '$25k - $35k', 'rate: 50k' into a number."""
    if not isinstance(text, str) or not text.strip():
        return None
    m = re.search(r"\$\s?(\d+(?:\.\d+)?)\s?k", text, re.I)
    if m:
        return float(m.group(1)) * 1000
    m = re.search(r"\$\s?(\d+)", text)
    if m:
        return float(m.group(1))
    return None


def _salary_bounds(salary_text) -> tuple:
    """Return (min, max, currency_hint) from a salary string like
    'OTE $25k - $35k'."""
    if not isinstance(salary_text, str) or not salary_text.strip():
        return None, None, None
    currency = "USD" if "$" in salary_text else None
    vals = [
        float(v) * 1000
        for v in re.findall(r"\$\s?(\d+(?:\.\d+)?)\s?k", salary_text, re.I)
    ]
    if not vals:
        return None, None, currency
    return (vals[0] if len(vals) > 1 else None), (vals[-1] if len(vals) > 1 else vals[0]), currency


# --------------------------------------------------------------------------- #
# Reddit
# --------------------------------------------------------------------------- #

def collect_reddit(subreddits) -> list[dict]:
    out: list[dict] = []
    for sub in subreddits:
        try:
            payload = _http_json(f"https://www.reddit.com/r/{sub}/new.json?limit=100")
            children = (payload or {}).get("data", {}).get("children", [])
        except Exception as exc:  # noqa: BLE001
            logger.warning("GigRadar: Reddit r/%s failed: %s", sub, exc)
            continue
        for child in children:
            post = (child or {}).get("data", {})
            title = post.get("title", "") or ""
            if not _is_hiring_post(title):
                continue
            permalink = post.get("permalink") or ""
            out.append({
                "source": "reddit",
                "source_key": f"reddit:{post.get('id', '')}",
                "source_label": f"r/{sub}",
                "title": title,
                "description": (post.get("selftext") or "")[:6000] or "_(no description)_",
                "url": f"https://www.reddit.com{permalink}" if permalink else (
                    post.get("url") or ""
                ),
                "posted_at": datetime.fromtimestamp(
                    post.get("created_utc", 0), tz=timezone.utc
                ) if post.get("created_utc") else None,
                "budget_min": None,
                "budget_max": None,
                "currency": None,
                "location": "Remote" if "remote" in title.lower() else None,
                "skills": None,
            })
        time.sleep(2)  # stay well under Reddit's ~10 req/min unauthenticated limit
    return out


# --------------------------------------------------------------------------- #
# WeWorkRemotely (public RSS feed, no key required)
# --------------------------------------------------------------------------- #

def collect_weworkremotely() -> list[dict]:
    import email.utils
    import html as html_mod
    import re as _re
    import xml.etree.ElementTree as ET
    import urllib.request

    out: list[dict] = []
    req = urllib.request.Request("https://weworkremotely.com/remote-jobs.rss", headers=_UA)
    try:
        with urllib.request.urlopen(req, timeout=_TIMEOUT) as resp:
            raw = resp.read()
        root = ET.fromstring(raw)
    except Exception as exc:  # noqa: BLE001
        logger.warning("GigRadar: WeWorkRemotely failed: %s", exc)
        return out

    for item in root.findall(".//item"):
        def _field(name: str) -> str:
            el = item.find(name)
            return (el.text or "").strip() if el is not None and el.text else ""

        title = _field("title")
        skills = _field("skills")
        category = _field("category")
        job_type = _field("type")
        region = _field("region")
        pub = _field("pubDate")
        guid = _field("guid")
        desc_html = _field("description")

        blob = f"{title} {skills} {category}"
        if not _matches_frontend(blob):
            continue

        posted_at = None
        if pub:
            try:
                posted_at = email.utils.parsedate_to_datetime(pub)
            except Exception:  # noqa: BLE001
                posted_at = None

        text = _re.sub(r"<[^>]+>", " ", desc_html)
        text = html_mod.unescape(_re.sub(r"\s+", " ", text)).strip()
        out.append({
            "source": "rss",
            "source_key": f"wwr:{guid or title}",
            "source_label": "WeWorkRemotely",
            "title": title,
            "description": f"Category: {category or 'n/a'}\nType: {job_type or 'n/a'}"
                           f"\nSkills: {skills or 'n/a'}\nRegion: {region or 'Anywhere'}"
                           f"\n\n{text[:3000]}",
            "url": guid or "",
            "posted_at": posted_at,
            "budget_min": None,
            "budget_max": None,
            "currency": None,
            "location": region or "Remote",
            "skills": skills or None,
        })
    return out


# --------------------------------------------------------------------------- #
# Remotive (free JSON API, no key required)
# --------------------------------------------------------------------------- #

def collect_remotive() -> list[dict]:
    out: list[dict] = []
    try:
        payload = _http_json("https://remotive.com/api/remote-jobs")
    except Exception as exc:  # noqa: BLE001
        logger.warning("GigRadar: Remotive failed: %s", exc)
        return out
    for job in (payload or {}).get("jobs", []) or []:
        title = job.get("title") or ""
        tpl = job.get("tags") or []
        tags = ", ".join(tpl) if isinstance(tpl, list) else str(tpl or "")
        blob = f"{title} {tags}"
        if not _matches_frontend(blob):
            continue
        published = job.get("publication_date")
        try:
            posted_at = datetime.fromisoformat(published) if published else None
        except Exception:  # noqa: BLE001
            posted_at = None
        salary_min, salary_max, currency = _salary_bounds(job.get("salary"))
        out.append({
            "source": "remotive",
            "source_key": f"remotive:{job.get('id', '')}",
            "source_label": job.get("company_name") or "Remotive",
            "title": f"{title} — {job.get('company_name', '')}".strip(" —"),
            "description": f"Category: {job.get('category') or 'n/a'}\nTags: {tags}"
                           f"\nSalary: {job.get('salary') or 'n/a'}"
                           f"\n\n{(job.get('description') or '')[:3000]}",
            "url": job.get("url") or "",
            "posted_at": posted_at,
            "budget_min": salary_min,
            "budget_max": salary_max,
            "currency": currency or "USD",
            "location": job.get("candidate_required_location") or "Remote",
            "skills": tags or None,
        })
    return out


# --------------------------------------------------------------------------- #
# RemoteOK (free JSON API, no key required)
# --------------------------------------------------------------------------- #

def collect_remoteok() -> list[dict]:
    out: list[dict] = []
    try:
        payload = _http_json("https://remoteok.com/api")
    except Exception as exc:  # noqa: BLE001
        logger.warning("GigRadar: RemoteOK failed: %s", exc)
        return out
    jobs = payload if isinstance(payload, list) else []
    for job in jobs[1:]:
        position = job.get("position") or ""
        tags = ", ".join(job.get("tags") or [])
        blob = f"{position} {tags}"
        if not _matches_frontend(blob):
            continue
        ts = job.get("date")
        posted_at = None
        if isinstance(ts, str):
            try:
                posted_at = datetime.fromisoformat(ts)
            except Exception:  # noqa: BLE001
                posted_at = None
        elif isinstance(ts, (int, float)):
            posted_at = datetime.fromtimestamp(
                ts / 1000 if ts > 1e12 else ts, tz=timezone.utc
            )
        salary_min = _parse_k_currency(job.get("salary_min"))
        salary_max = _parse_k_currency(job.get("salary_max"))
        location = job.get("location") or "Remote"
        if not isinstance(location, str):
            location = ", ".join(str(x) for x in location)
        out.append({
            "source": "remoteok",
            "source_key": f"remoteok:{job.get('id', '')}",
            "source_label": job.get("company") or "RemoteOK",
            "title": f"{position} — {job.get('company', '')}".strip(" —"),
            "description": f"Tags: {tags}\nSalary: {job.get('salary_min') or ''} - {job.get('salary_max') or ''}"
                           f"\nLocation: {location}"
                           f"\n\n{(job.get('description') or '')[:3000]}",
            "url": job.get("url") or "",
            "posted_at": posted_at,
            "budget_min": salary_min,
            "budget_max": salary_max,
            "currency": "USD",
            "location": location,
            "skills": tags or None,
        })
    return out