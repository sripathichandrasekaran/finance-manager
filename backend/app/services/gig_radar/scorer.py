"""Keyword-based fit scoring for captured opportunities.

Scores are fully deterministic — no AI required. Claude is only used later for
the proposal draft, never for ranking. Positive service profile terms add
points; show-stopper terms (other stacks) cancel a chunk of them.

The profile mirrors Sripathi's services (frontend dev, Tamil Nadu, India):
  - Landing pages (React, Tailwind, Framer)       $100-300
  - Business websites (WordPress, Elementor)      $150-500
  - Bug fixes & redesigns (WP, React, Wix, etc.)  $50-200
  - React frontends / dashboards (TS, MUI, Redux) $150-700
"""

from __future__ import annotations

# Terms the user actively sells (React/web frontend + WordPress/shopify work).
# Score = how strongly a match signals a good-fit gig.
POSITIVE_TERMS: dict[str, int] = {
    "react": 12,
    "frontend": 12,
    "front-end": 12,
    "front end": 12,
    "next.js": 10,
    "nextjs": 10,
    "wordpress": 10,
    "elementor": 10,
    "javascript": 9,
    "typescript": 9,
    "landing page": 9,
    "web design": 9,
    "web designer": 9,
    "business website": 9,
    "shopify": 8,
    "wix": 8,
    "squarespace": 8,
    "woocommerce": 8,
    "webflow": 8,
    "dashboard": 8,
    "tailwind": 8,
    "framer": 7,
    "redesign": 7,
    "bug fix": 7,
    "figma": 7,
    "web development": 7,
    "web developer": 7,
    "html": 6,
    "html5": 6,
    "css": 6,
    "css3": 6,
    "mui": 6,
    "bootstrap": 6,
    "redux": 6,
    "ui developer": 6,
    "web application": 6,
    "web app": 6,
    "web dev": 6,
    "website": 6,
    "saas website": 6,
    "startup website": 6,
    "ui/ux": 5,
    "responsive": 5,
    "ecommerce": 5,
    "e-commerce": 5,
    "bugs": 5,
    "saas": 4,
    "web": 2,
    "ui": 2,
    "ux": 2,
}

# Stacks/roles that would take the work away from a React/web generalist.
NEGATIVE_TERMS: tuple[str, ...] = (
    # mobile / cross-platform
    "react native", "flutter", "android", "ios", "swift", "kotlin",
    # backend / other languages
    "backend engineer", "backend developer", "python", "django", "fastapi",
    "node.js api", ".net", "asp.net", "c#", "java", "spring boot",
    "golang", "rust", "c++",
    # qa / testing
    "qa engineer", "qa tester", "quality assurance", "quality engineer",
    "manual testing", "test automation", "automation tester",
    # data / ai
    "data science", "data scientist", "data analyst", "data engineer",
    "machine learning", "ml engineer", "deep learning", "ai engineer",
    # infra
    "devops", "kubernetes", "docker", "terraform", "aws lambda",
    "cloud engineer", "serverless", "sysadmin", "system administrator",
    "network engineer", "database administrator", "dba",
    # security
    "security engineer", "penetration testing",
    # non-web services
    "game development", "unity", "unreal", "embedded", "hardware",
    "blockchain", "cryptocurrency", "smart contract", "salesforce", "sap",
    "digital marketing", "social media marketing", "content marketing",
    "content writing", "copywriting", "video editing", "logo design",
)


def score_opportunity(title: str, description: str = "", skills: str = "") -> tuple[int, list[str], list[str]]:
    """Return (score 0-100, matched positive terms, matched negative terms)."""
    blob = f"{title} {description} {skills}".lower()
    hits: list[str] = []
    total = 0
    for term, pts in POSITIVE_TERMS.items():
        if term in blob and term not in hits:
            hits.append(term)
            total += pts

    neg_hits = [term for term in NEGATIVE_TERMS if term in blob]

    score = 20 if hits else 0     # a baseline so relevant-but-generic posts still rank
    score += min(total, 80)       # cap before penalties
    if neg_hits:
        score = max(0, score - 25 * len(neg_hits))
    if "remote" not in blob.lower():
        score = max(0, score - 5)
    return min(score, 100), hits, neg_hits


def build_fit_reason(hits: list[str], neg_hits: list[str]) -> str:
    if hits:
        reason = f"Matches: {', '.join(hits[:6])}."
    else:
        reason = "No strong match — review manually."
    if neg_hits:
        reason += f" Caution: {', '.join(neg_hits[:4])}."
    return reason