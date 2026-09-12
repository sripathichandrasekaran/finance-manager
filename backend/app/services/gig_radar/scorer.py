"""Keyword-based fit scoring for captured opportunities.

Scores are fully deterministic — no AI required. Claude is only used later for
the proposal draft, never for ranking. Positive service profile terms add
points; show-stopper terms (other stacks) cancel a chunk of them.
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
    "javascript": 9,
    "typescript": 9,
    "wordpress": 9,
    "landing page": 9,
    "dashboard": 8,
    "shopify": 8,
    "tailwind": 8,
    "figma": 7,
    "web development": 7,
    "web developer": 7,
    "web application": 6,
    "web dev": 6,
    "website": 6,
    "html": 6,
    "css": 6,
    "mui": 6,
    "redux": 6,
    "ui developer": 6,
    "ui/ux": 5,
    "responsive": 5,
    "ecommerce": 5,
    "e-commerce": 5,
    "saas": 4,
    "web": 2,
    "ui": 2,
    "ux": 2,
}

# Stacks that would take the work away from a React/web generalist.
NEGATIVE_TERMS: tuple[str, ...] = (
    "react native", "flutter", "android", "ios", "swift", "kotlin",
    "python", "django", "fastapi", "backend engineer", "backend developer",
    "data science", "machine learning", "nlp", "deep learning",
    "devops", "kubernetes", "docker", "aws lambda", "terraform",
    ".net", "asp.net", "c#", "java", "spring boot", "golang", "rust",
    "game development", "unity", "unreal", "embedded", "hardware",
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