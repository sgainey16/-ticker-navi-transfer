"""Universal Ticker ENTITY INDEX — one fast, alias-aware, accent-insensitive search
over every known Ticker entity (teams + leagues across all registered leagues),
reused by onboarding, main search, Explore and Draft Board discovery.

Why this exists (bug fix, June 2026):
  * Search was slow: every keystroke fanned out to all 5 providers, each opening a
    fresh HTTP client and making 1-2 EXTERNAL calls (NHL player service + 3x
    HockeyTech searchplayers + NCAA EP) sequentially.
  * "Montreal" returned nothing: matching used raw accented names ("Montréal") with
    no accent-folding and no nickname aliases ("habs").

Design:
  * Known TEAM + LEAGUE entities are indexed ONCE (per-provider team lists are
    themselves cached) and searched fully IN-MEMORY -> near-instant, zero network
    on the hot path for known entities.
  * Accent-insensitive normalization + curated alias terms (city / nickname / slang)
    so montreal|habs|canadiens, wild, stars, golden gophers|minnesota gophers,
    kamloops|blazers, WHL all resolve to the right object.
  * PLAYERS: a single fast NHL player lookup runs alongside (one network call), so
    kaprizov|kirill still resolves. Other leagues' player discovery stays on their
    own pages (kept off the hot path deliberately).
Real data only — nothing fabricated. Providers that can't answer contribute nothing.
"""
from __future__ import annotations

import asyncio
import logging
import time
import unicodedata

logger = logging.getLogger("ticker.entity_index")


def _norm(s: str) -> str:
    """Lowercase, strip diacritics (Montréal -> montreal), keep alnum + single spaces."""
    s = unicodedata.normalize("NFKD", s or "")
    s = "".join(c for c in s if not unicodedata.combining(c))
    return " ".join("".join(c.lower() if (c.isalnum() or c == " ") else " " for c in s).split())


# Slang / common short names NOT already present in official team name/city/nickname.
NHL_ALIASES: dict[str, str] = {
    "MTL": "habs", "TBL": "bolts", "NSH": "preds", "WSH": "caps", "PIT": "pens",
    "TOR": "leafs", "COL": "avs", "CAR": "canes", "OTT": "sens", "NYI": "isles",
    "CBJ": "jackets", "VGK": "vegas knights", "NJD": "jersey", "LAK": "la",
    "UTA": "utah mammoth", "SJS": "sharks", "ANA": "ducks", "WPG": "jets",
}

# NCAA programs come from Highlightly names; add well-known nicknames/short names.
NCAA_ALIASES: dict[str, str] = {
    "MINN": "golden gophers minnesota gophers", "UMD": "duluth bulldogs",
    "UND": "north dakota fighting hawks", "BU": "boston university terriers",
    "BC": "boston college eagles", "DEN": "denver pioneers",
    "MICH": "michigan wolverines", "WIS": "wisconsin badgers",
}

LEAGUE_META: dict[str, str] = {
    "nhl": "National Hockey League", "whl": "Western Hockey League",
    "ohl": "Ontario Hockey League", "qmjhl": "Quebec Maritimes Junior Hockey League",
    "ncaa": "NCAA (Men's Hockey)",
}

# On equal match score, prefer the senior league (NHL) so ambiguous city queries
# like "minnesota" surface the Wild ahead of junior/college programs.
LEAGUE_RANK: dict[str, int] = {"nhl": 0, "whl": 1, "ohl": 1, "qmjhl": 1, "ncaa": 2}

# TWO DISCOVERY WORLDS (architecture capture for the Explore/Globe + onboarding phase).
# World 1 = JUNIOR/ELITE/PRO (structured upper ecosystem: NHL/PWHL/CHL/NCAA/junior/
# European pro/international). World 2 = YOUTH/LOCAL (minor/girls/AAA-AA-A/associations/
# academies/high-school/tournaments/age-group/community). Classification is by ECOSYSTEM,
# not player age. A user may follow BOTH. Every registered league today is "elite"; youth
# entities (associations/local teams) will carry world="youth" when that world is wired.
LEAGUE_WORLD: dict[str, str] = {"nhl": "elite", "whl": "elite", "ohl": "elite", "qmjhl": "elite", "ncaa": "elite"}

_CACHE: dict = {"ts": 0.0, "entities": []}
_TTL = 1800  # 30 min; per-provider team lists are themselves cached ~1h
_LOCK = asyncio.Lock()


async def _provider_team_entities(p) -> list[dict]:
    code = getattr(p, "code", "") or ""
    try:
        rows = await p.team_entities()
    except Exception:
        logger.exception("team_entities failed for %s", code)
        return []
    lg = code.upper()
    amap = NHL_ALIASES if code == "nhl" else (NCAA_ALIASES if code == "ncaa" else {})
    out: list[dict] = []
    for t in rows:
        abbr = (t.get("abbr") or "").strip()
        if not abbr:
            continue
        extra = amap.get(abbr, "")
        terms = _norm(" ".join([t.get("name", ""), t.get("city", ""), t.get("nickname", ""), abbr, extra]))
        exact = set(_norm(extra).split()) | {abbr.lower()}
        out.append({
            "type": "team", "id": abbr, "team_abbr": abbr, "name": t.get("name") or abbr,
            "subtitle": lg, "logo": t.get("logo"), "league": lg, "league_code": code,
            "world": LEAGUE_WORLD.get(code, "elite"),
            "_terms": terms, "_abbr": abbr.lower(), "_exact": exact,
        })
    return out


async def _build() -> list[dict]:
    from providers.registry import list_providers
    provs = [p for p in list_providers() if p.capabilities.get("search") and hasattr(p, "team_entities")]
    results = await asyncio.gather(*[_provider_team_entities(p) for p in provs], return_exceptions=True)
    ents: list[dict] = []
    for r in results:
        if isinstance(r, list):
            ents.extend(r)
    # League entities so "WHL" -> WHL league hub, etc.
    for p in provs:
        code = getattr(p, "code", "")
        nm = LEAGUE_META.get(code, getattr(p, "name", code.upper()))
        ents.append({
            "type": "league", "id": code, "league_code": code, "name": nm,
            "subtitle": "League", "logo": None, "league": code.upper(),
            "world": LEAGUE_WORLD.get(code, "elite"),
            "_terms": _norm(f"{code} {nm}"), "_abbr": code, "_exact": {code},
        })
    return ents


async def _entities() -> list[dict]:
    if _CACHE["entities"] and (time.time() - _CACHE["ts"] < _TTL):
        return _CACHE["entities"]
    async with _LOCK:
        if _CACHE["entities"] and (time.time() - _CACHE["ts"] < _TTL):
            return _CACHE["entities"]
        ents = await _build()
        if ents:
            _CACHE.update(ts=time.time(), entities=ents)
    return _CACHE["entities"]


def _score(ql: str, qtokens: list[str], e: dict) -> int:
    if ql in e["_exact"] or ql == e["_abbr"]:
        return 100
    terms = e["_terms"]
    if terms.startswith(ql) or any(w.startswith(ql) for w in terms.split()):
        return 70
    if ql in terms:
        return 50
    if len(qtokens) > 1 and all(tok in terms for tok in qtokens):
        return 40
    return 0


async def warm() -> None:
    """Build the index ahead of the first search (called on startup)."""
    try:
        await _entities()
    except Exception:
        logger.exception("entity index warm failed")


async def search_entities(q: str, limit: int = 16) -> list[dict]:
    q = (q or "").strip()
    if len(q) < 2:
        return []
    ql = _norm(q)
    qtokens = ql.split()

    ents = await _entities()
    scored = []
    for e in ents:
        s = _score(ql, qtokens, e)
        if s:
            scored.append((s, e))
    scored.sort(key=lambda x: (-x[0], LEAGUE_RANK.get(x[1].get("league_code"), 3), len(x[1]["name"])))
    local = [{k: v for k, v in e.items() if not k.startswith("_")} for _, e in scored[:limit]]

    # One fast NHL player call so players resolve too (kaprizov, kirill…).
    players: list[dict] = []
    try:
        import providers.nhl as nhl
        players = await nhl.player_search(q, limit=8)
    except Exception:
        logger.exception("player_search failed")

    out: list[dict] = []
    seen: set = set()
    for r in local + players:
        k = (r.get("type"), str(r.get("id")))
        if k in seen:
            continue
        seen.add(k)
        out.append(r)
    return out[:limit]
