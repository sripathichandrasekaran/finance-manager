"""Schedulable collectors for the Gig Radar.

Every collector is stateless: it returns a list of normalized opportunity
dicts and never touches the database. Sources are Reddit (r/forhire-style
gigs), Freelancer.com (config-gated API key), and the free JSON/RSS feeds of
Remotive/RemoteOK/WeWorkRemotely. Posts/jobs are pre-filtered so only web /
frontend work the user sells survives; QA/DevOps/data/other-stack roles are
dropped. Each dict carries:

  source        e.g. "reddit" | "freelancer" | "remotive" | "remoteok" | "rss"
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

# Terms that signal a gig is in the user's lane (web/frontend). Feed jobs are
# kept only when the title signals web work; non-web roles (QA, DevOps, data,
# other stacks) are dropped even if they mention "web" in passing.
_WEB_STRONG = (
    "react", "frontend", "front-end", "front end", "front end developer",
    "javascript", "typescript", "next.js", "nextjs", "remix", "astro",
    "wordpress", "elementor", "woocommerce", "shopify", "wix", "squarespace",
    "webflow", "framer", "landing page", "tailwind", "mui", "bootstrap",
    "web developer", "web development", "web design", "web designer",
    "ui developer", "ui/ux", "dashboard", "html", "html5", "css", "css3",
)

_WEB_WEAK = (
    "web", "webapp", "web application", "website", "web app", "saas",
    "ecommerce", "e-commerce", "redesign", "bug fix", "responsive",
)

# Short terms that must not match as substrings ("web" inside "Webnotics",
# "qa" inside "aquarium"). Matched as whole words instead.
_SHORT_WORDY = {"web", "qa", "test", "ui", "ux", "css", "html", "data"}


def _has(term: str, text: str) -> bool:
    if term in _SHORT_WORDY:
        return re.search(
            rf"(?<![a-z0-9]){re.escape(term)}(?![a-z0-9])", text
        ) is not None
    return term in text

_NON_WEB_ROLE = (
    # engineering / other stacks
    "backend", "back end", "data", "ml engineer", "machine learning",
    "ai engineer", "devops", "dev ops", "sre", "qa", "quality", "test",
    "testing", "security", "system", "sysadmin", "network", "database", "dba",
    "python", "java", "golang", "rust", "c++", "c#", ".net", "android", "ios",
    "swift", "kotlin", "flutter", "react native", "unity", "unreal", "game",
    "embedded", "hardware", "blockchain", "cryptocurrency", "salesforce",
    "cloud engineer", "terraform", "docker", "kubernetes",
    # non-dev / non-technical roles (platform names must not fake a dev job)
    "support", "customer service", "operations", "sales", "marketing",
    "customer", "associate", "coordinator", "assistant", "product manager",
    "project manager", "account manager", "recruiter", "human resources",
    "head of", "director", "finance", "consultant", "admin", "copywriting",
    "content writer", "data entry", "virtual assistant",
)

# Role words that kill a feed job even when a platform like Shopify or
# Squarespace appears in the title ("Head of Operations - Shopify").
_ROLE_BLOCKERS = (
    "support", "customer service", "operations", "sales", "marketing",
    "customer", "associate", "coordinator", "assistant", "product manager",
    "project manager", "account manager", "recruiter", "human resources",
    "head of", "director", "finance", "consultant", "admin", "copywriting",
    "content writer", "data entry", "virtual assistant", "qa", "quality",
    "tester", "testing", "data scientist", "data analyst", "data engineer",
    "devops", "sysadmin", "system administrator", "backend", "ml engineer",
    "machine learning", "ai engineer", "brand",
)


def _is_web_role(blob: str) -> bool:
    """Tolerant check for project-style listings (Reddit, Freelancer.com).

    A strong web term wins even if a non-web word appears ("React + Python
    backend"); a listing with no strong web term and any non-web role signal
    is rejected."""
    blob = blob.lower()
    strong = [t for t in _WEB_STRONG if _has(t, blob)]
    nonweb = [t for t in _NON_WEB_ROLE if _has(t, blob)]
    if strong:
        if nonweb and len(nonweb) > len(strong) * 2:
            return False
        return True
    if nonweb:
        return False
    return any(_has(weak, blob) for weak in _WEB_WEAK)


def _is_web_job_title(title: str) -> bool:
    """Strict check for job-board titles (Remotive/RemoteOK/WWR).

    Their tags/descriptions are keyword piles, so only the job title counts.
    Any non-dev role blocker wins over every platform/web word, so
    "Squarespace: Customer Support Associate" and "Head of Operations
    - Shopify" are dropped even though they mention web platforms."""
    t = title.lower()
    if any(_has(block, t) for block in _ROLE_BLOCKERS):
        return False
    if any(_has(x, t) for x in _WEB_STRONG):
        return True
    return any(_has(weak, t) for weak in _WEB_WEAK)


def _http_json(url: str, headers: dict | None = None) -> dict | list | None:
    import urllib.request

    req = urllib.request.Request(url, headers=headers or _UA)
    with urllib.request.urlopen(req, timeout=_TIMEOUT) as resp:
        return json.loads(resp.read().decode("utf-8", "replace"))


def _is_hiring_post(title: str) -> bool:
    t = title.lower().strip()
    if t.startswith("[for hire]") or t.startswith("[for-hire]") or "for hire" in t and "hiring" not in t:
        return False
    if "for sale" in t:
        return False
    return any(marker in t for marker in _HIRING_MARKERS)


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

# Reddit increasingly 403s anonymous `.json` scraping from many networks.
# Registering a free "script" app at reddit.com/prefs/apps fixes it: app-only
# (client_credentials) OAuth reads public subreddit listings reliably at
# ~60 req/min. When no client id/secret are configured we still try the
# anonymous endpoints (which may 403 in the user's network).
_REDDIT_APP_UA = "finance-manager-gig-radar/1.0 (freelance opportunity feed)"


def _reddit_app_token(client_id: str, client_secret: str) -> str | None:
    import base64
    import urllib.parse
    import urllib.request

    cred = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()
    data = urllib.parse.urlencode({"grant_type": "client_credentials"}).encode()
    req = urllib.request.Request(
        "https://www.reddit.com/api/v1/access_token",
        data=data,
        method="POST",
        headers={
            "Authorization": f"Basic {cred}",
            "User-Agent": _REDDIT_APP_UA,
            "Content-Type": "application/x-www-form-urlencoded",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=_TIMEOUT) as resp:
            body = json.loads(resp.read().decode("utf-8", "replace"))
        token = body.get("access_token")
        if token:
            logger.info("GigRadar: Reddit app-only OAuth token acquired")
        return token
    except Exception as exc:  # noqa: BLE001
        logger.warning("GigRadar: Reddit app-only token failed (%s); falling back to anonymous", exc)
        return None


def collect_reddit(
    subreddits,
    client_id: str = "",
    client_secret: str = "",
) -> list[dict]:
    out: list[dict] = []
    token = None
    if client_id and client_secret:
        token = _reddit_app_token(client_id, client_secret)
    base_url = "https://oauth.reddit.com" if token else "https://www.reddit.com"
    headers = dict(_UA)
    if token:
        headers["Authorization"] = f"Bearer {token}"
        headers["User-Agent"] = _REDDIT_APP_UA

    for sub in subreddits:
        try:
            payload = _http_json(
                f"{base_url}/r/{sub}/new.json?limit=100&raw_json=1", headers=headers
            )
            children = (payload or {}).get("data", {}).get("children", [])
        except Exception as exc:  # noqa: BLE001
            logger.warning("GigRadar: Reddit r/%s failed: %s", sub, exc)
            continue
        for child in children:
            post = (child or {}).get("data", {})
            title = post.get("title", "") or ""
            if not _is_hiring_post(title):
                continue
            body = post.get("selftext") or ""
            if not _is_web_role(f"{title} {body[:600]}"):
                continue
            permalink = post.get("permalink") or ""
            out.append({
                "source": "reddit",
                "source_key": f"reddit:{post.get('id', '')}",
                "source_label": f"r/{sub}",
                "title": title,
                "description": body[:6000] or "_(no description)_",
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
        time.sleep(2)
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

        if not _is_web_job_title(title):
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
        if not _is_web_job_title(title):
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
        if not _is_web_job_title(position):
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


# --------------------------------------------------------------------------- #
# Freelancer.com (real freelance projects with budgets — needs a free API key)
# --------------------------------------------------------------------------- #

def collect_freelancer(api_key: str) -> list[dict]:
    """Pull recent open projects from Freelancer.com's public search API.

    The key comes from the user's Freelancer account (settings -> API key);
    without it this collector stays empty. Auth is best-effort: we send the
    classic `freelancer-oauth-v1` header AND an `api_key` query param so either
    the V1 or the OAuth flavour works. Failures are logged, never fatal.

    Project shape (v0.1 /projects/active):
      { status, result: { projects: [ { id, title, description, time_submitted,
          seo_url, url, currency: {code, sign}, budget: {minimum, maximum},
          type: "fixed"|"hourly", jobs: [ {name}, ... ], owner: {...} } ] } }
    """
    out: list[dict] = []
    if not api_key:
        return out
    headers = dict(_UA)
    headers["freelancer-oauth-v1"] = api_key
    url = (
        "https://www.freelancer.com/api/projects/0.1/projects/active/"
        "?limit=50&compact=true&full_description=true"
        "&job_details=true&currency_details=true&user_details=false"
        f"&api_key={api_key}"
    )
    try:
        payload = _http_json(url, headers=headers)
    except Exception as exc:  # noqa: BLE001
        logger.warning("GigRadar: Freelancer.com failed: %s", exc)
        return out
    if not isinstance(payload, dict):
        return out
    result = payload.get("result") or payload
    projects = result.get("projects") if isinstance(result, dict) else None
    if not isinstance(projects, list):
        logger.warning("GigRadar: Freelancer.com returned no project list: %s",
                       (payload.get("status") or payload)[:200])
        return out

    for proj in projects:
        if not isinstance(proj, dict):
            continue
        title = proj.get("title") or ""
        jobs = [j.get("name", "") for j in (proj.get("jobs") or []) if isinstance(j, dict)]
        skills = ", ".join([j for j in jobs if j])
        blob = f"{title} {skills}"
        if not _is_web_role(blob):
            continue

        budget = proj.get("budget") or {}
        currency = proj.get("currency") or {}
        proj_type = proj.get("type") or "fixed"
        budget_min = budget.get("minimum")
        budget_max = budget.get("maximum")

        seo = proj.get("seo_url") or ""
        url = proj.get("url") or (
            f"https://www.freelancer.com/projects/{seo}" if seo else ""
        )
        aid = proj.get("time_submitted")
        posted_at = None
        if isinstance(aid, (int, float)):
            posted_at = datetime.fromtimestamp(aid, tz=timezone.utc)

        owner = proj.get("owner") or {}
        out.append({
            "source": "freelancer",
            "source_key": f"freelancer:{proj.get('id', '')}",
            "source_label": "Freelancer.com",
            "title": title,
            "description": (f"Type: {proj_type}\nSkills: {skills or 'n/a'}"
                            f"\nOwner: {owner.get('username') or 'n/a'} "
                            f"({owner.get('country') or 'n/a'})"
                            f"\n\n{(proj.get('description') or '')[:3000]}"),
            "url": url,
            "posted_at": posted_at,
            "budget_min": float(budget_min) if budget_min not in (None, "") else None,
            "budget_max": float(budget_max) if budget_max not in (None, "") else None,
            "currency": currency.get("code") or None,
            "location": owner.get("country") or None,
            "skills": skills or None,
        })
    return out