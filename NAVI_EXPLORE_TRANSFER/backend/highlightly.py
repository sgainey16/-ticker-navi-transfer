"""Highlightly — universal video/highlights + multi-league content layer for THE TICKER.

ONE reusable adapter for every Highlightly-covered hockey league. The app never sees
"Highlightly"; it sees canonical Ticker content (a game's recap video, its clips) matched
to the games/teams we already show. Adding a Highlightly-supported league later is a single
entry in HL_LEAGUES — configuration, not another build.

Design rules honoured here:
  * ADDITIVE ONLY. Highlightly never overwrites stronger verified data (NHL API / HockeyTech).
    It contributes what those feeds don't have — primarily verified VIDEO.
  * NEVER FABRICATE. If a game has no matched clip, the package is simply thinner.
  * CACHED. Recent highlights per league are cached in-memory (TTL) so match lookups reuse
    one list and we stay far under the plan's 7,500 calls/day.

Auth: direct Highlightly platform key via `x-rapidapi-key` (no host header needed).
Base: https://sports.highlightly.net/hockey
"""
from __future__ import annotations

import logging
import os
import time
import unicodedata
from datetime import datetime, timezone

import httpx

logger = logging.getLogger("ticker.highlightly")

BASE = "https://sports.highlightly.net/hockey"


def _key() -> str:
    # Read lazily: server.py calls load_dotenv AFTER imports, so reading at import
    # time would miss the key. This also matches the documented load_dotenv pitfall.
    return os.environ.get("HIGHLIGHTLY_API_KEY", "").strip()

# The single plug point: canonical Ticker league code -> Highlightly leagueId.
# Add a Highlightly-supported league later by adding one line here.
HL_LEAGUES: dict[str, int] = {
    "nhl": 49291,
    "ahl": 50142,
    "echl": 50993,
    "whl": 4188,
    "ohl": 3337,
    "qmjhl": 5039,
    "ncaa": 218640,
}

_CACHE: dict[str, dict] = {}          # key -> {"ts": float, "data": list}
_CACHE_TTL = 900.0                    # 15 min — recent highlights change slowly


def enabled() -> bool:
    return bool(_key())


def covers(league: str) -> bool:
    """True when Highlightly can contribute video for this canonical league."""
    return enabled() and (league or "").lower() in HL_LEAGUES


# --------------------------------------------------------------------------- fetch
async def _get(client: httpx.AsyncClient, path: str, params: dict) -> list[dict]:
    r = await client.get(f"{BASE}{path}", params=params,
                         headers={"x-rapidapi-key": _key()}, timeout=20)
    r.raise_for_status()
    body = r.json()
    return body.get("data", body) if isinstance(body, dict) else (body or [])


async def _recent_highlights(league: str, limit: int = 40) -> list[dict]:
    """Recent verified clips for a league (cached). One call feeds many match lookups."""
    lid = HL_LEAGUES.get(league.lower())
    if not lid or not enabled():
        return []
    ckey = f"hl:{lid}:{limit}"
    hit = _CACHE.get(ckey)
    if hit and (time.time() - hit["ts"] < _CACHE_TTL):
        return hit["data"]
    try:
        async with httpx.AsyncClient() as client:
            data = await _get(client, "/highlights", {"leagueId": lid, "limit": min(limit, 40)})
    except Exception:
        logger.exception("Highlightly highlights fetch failed for %s", league)
        return hit["data"] if hit else []
    _CACHE[ckey] = {"ts": time.time(), "data": data}
    return data


# --------------------------------------------------------------------------- structure (standings/schedule)
_STRUCT_TTL = 900.0
_SEASON_TTL = 24 * 3600.0


async def _season(league: str):
    """The latest season that actually HAS data (offseason-safe), cached a day."""
    lid = HL_LEAGUES.get(league.lower())
    if not lid or not enabled():
        return None
    ckey = f"season:{lid}"
    hit = _CACHE.get(ckey)
    if hit and (time.time() - hit["ts"] < _SEASON_TTL):
        return hit["data"]
    chosen = None
    try:
        async with httpx.AsyncClient() as client:
            meta = await _get(client, f"/leagues/{lid}", {})
            seasons: list[int] = []
            if isinstance(meta, list) and meta:
                seasons = [s.get("season") for s in (meta[0].get("seasons") or []) if s.get("season")]
            for yr in sorted(set(seasons), reverse=True)[:3]:
                r = await client.get(f"{BASE}/standings", params={"leagueId": lid, "season": yr},
                                     headers={"x-rapidapi-key": _key()}, timeout=20)
                if r.status_code == 200 and (r.json() or {}).get("groups"):
                    chosen = yr
                    break
            if chosen is None and seasons:
                chosen = max(seasons)
    except Exception:
        logger.exception("Highlightly season resolve failed for %s", league)
    _CACHE[ckey] = {"ts": time.time(), "data": chosen}
    return chosen


async def standings(league: str) -> list[dict]:
    """Conference standings groups for a league (cached). [] when unsupported."""
    lid = HL_LEAGUES.get(league.lower())
    if not lid or not enabled():
        return []
    season = await _season(league)
    if not season:
        return []
    ckey = f"stand:{lid}:{season}"
    hit = _CACHE.get(ckey)
    if hit and (time.time() - hit["ts"] < _STRUCT_TTL):
        return hit["data"]
    try:
        async with httpx.AsyncClient() as client:
            r = await client.get(f"{BASE}/standings", params={"leagueId": lid, "season": season},
                                 headers={"x-rapidapi-key": _key()}, timeout=20)
            r.raise_for_status()
            groups = (r.json() or {}).get("groups", [])
    except Exception:
        logger.exception("Highlightly standings failed for %s", league)
        return hit["data"] if hit else []
    _CACHE[ckey] = {"ts": time.time(), "data": groups}
    return groups


async def matches(league: str, limit: int = 300) -> list[dict]:
    """Schedule + scores for a league's current-data season (cached). [] when none."""
    lid = HL_LEAGUES.get(league.lower())
    if not lid or not enabled():
        return []
    season = await _season(league)
    if not season:
        return []
    ckey = f"matches:{lid}:{season}"
    hit = _CACHE.get(ckey)
    if hit and (time.time() - hit["ts"] < _STRUCT_TTL):
        return hit["data"]
    out: list[dict] = []
    try:
        async with httpx.AsyncClient() as client:
            off = 0
            while len(out) < limit:
                page = await _get(client, "/matches",
                                  {"leagueId": lid, "season": season, "limit": 100, "offset": off})
                if not page:
                    break
                out.extend(page)
                if len(page) < 100:
                    break
                off += 100
    except Exception:
        logger.exception("Highlightly matches failed for %s", league)
        return hit["data"] if hit else []
    out = out[:limit]
    _CACHE[ckey] = {"ts": time.time(), "data": out}
    return out


# --------------------------------------------------------------------------- normalize
def _norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s or "")
    s = "".join(c for c in s if not unicodedata.combining(c))
    return "".join(c.lower() if (c.isalnum() or c == " ") else " " for c in s)


def _nickname(name: str) -> str:
    """Last significant token of a club name (Everett Silvertips -> silvertips)."""
    toks = [t for t in _norm(name).split() if t]
    return toks[-1] if toks else ""


def _clip_haystack(clip: dict) -> str:
    m = clip.get("match") or {}
    parts = [clip.get("title") or "",
             (m.get("homeTeam") or {}).get("name") or "",
             (m.get("awayTeam") or {}).get("name") or ""]
    return _norm(" ".join(parts))


def _parse_day(s: str | None):
    if not s:
        return None
    s = s.strip()
    for fmt in ("%Y-%m-%dT%H:%M:%S.%fZ", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(s[:len(fmt) + 4] if "%f" in fmt else s, fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except ValueError:
        return None


def _yt_id(clip: dict) -> str | None:
    for u in (clip.get("embedUrl"), clip.get("url")):
        if not u:
            continue
        if "youtube.com/embed/" in u:
            return u.split("/embed/")[1].split("?")[0].split("&")[0]
        if "watch?v=" in u:
            return u.split("watch?v=")[1].split("&")[0]
        if "youtu.be/" in u:
            return u.split("youtu.be/")[1].split("?")[0]
    return None


def _shape(clip: dict) -> dict:
    m = clip.get("match") or {}
    return {
        "id": clip.get("id"),
        "title": clip.get("title"),
        "category": clip.get("category") or "match-highlights",
        "type": clip.get("type"),                # VERIFIED / ...
        "source": clip.get("source"),            # youtube / ...
        "channel": clip.get("channel"),
        "url": clip.get("url"),
        "embed_url": clip.get("embedUrl"),
        "youtube_id": _yt_id(clip),
        "thumbnail": clip.get("imgUrl"),
        "date": (m.get("date") if isinstance(m, dict) else None),
        "home": ((m.get("homeTeam") or {}).get("name") if isinstance(m, dict) else None),
        "away": ((m.get("awayTeam") or {}).get("name") if isinstance(m, dict) else None),
    }


# --------------------------------------------------------------------------- public API
async def all_leagues() -> list[dict]:
    """Full Highlightly league inventory (paged), cached a day. Source of truth for
    Explore's international scale. Returns [{id, name, country}] — provider truth only."""
    if not enabled():
        return []
    ckey = "all_leagues"
    hit = _CACHE.get(ckey)
    if hit and (time.time() - hit["ts"] < _SEASON_TTL):
        return hit["data"]
    out: list[dict] = []
    try:
        async with httpx.AsyncClient() as client:
            off = 0
            while True:
                r = await client.get(f"{BASE}/leagues", params={"limit": 100, "offset": off},
                                     headers={"x-rapidapi-key": _key()}, timeout=25)
                r.raise_for_status()
                data = r.json()
                items = data if isinstance(data, list) else (data.get("data") or data.get("leagues") or [])
                if not items:
                    break
                for l in items:
                    c = l.get("country")
                    country = c.get("name") if isinstance(c, dict) else c
                    out.append({"id": l.get("id"), "name": l.get("name"), "country": country or "Other"})
                if len(items) < 100:
                    break
                off += 100
                if off > 600:
                    break
    except Exception:
        logger.exception("Highlightly all_leagues failed")
        return hit["data"] if hit else []
    _CACHE[ckey] = {"ts": time.time(), "data": out}
    return out


async def league_highlights(league: str, limit: int = 20) -> list[dict]:
    """Recent verified clips for a league, shaped for the Ticker (newest first)."""
    clips = await _recent_highlights(league, limit=40)
    return [_shape(c) for c in clips[:limit]]


async def match_highlights(league: str, home: str, away: str,
                           date: str | None = None) -> dict:
    """Verified video package for one canonical game.

    Matches by BOTH team nicknames appearing in the clip, disambiguated by date
    proximity (critical for playoff series where the same two teams meet repeatedly).
    Returns {"recap": <clip|None>, "clips": [<clip>...]} — thinner or richer per what exists.
    """
    hn, an = _nickname(home), _nickname(away)
    if not hn or not an:
        return {"recap": None, "clips": []}
    game_day = _parse_day(date)
    clips = await _recent_highlights(league, limit=40)

    scored: list[tuple[float, dict]] = []
    for c in clips:
        hay = _clip_haystack(c)
        if hn not in hay or an not in hay:
            continue
        clip_day = _parse_day((c.get("match") or {}).get("date"))
        if game_day and clip_day:
            diff = abs((clip_day.date() - game_day.date()).days)
            if diff > 2:            # same teams, wrong game in the series
                continue
            scored.append((diff, c))
        else:
            scored.append((99, c))

    scored.sort(key=lambda x: x[0])
    shaped = [_shape(c) for _, c in scored]
    return {"recap": shaped[0] if shaped else None, "clips": shaped}



async def find_team_clip(league: str, team_name: str) -> dict | None:
    """First recent clip that mentions this team (cached list — cheap)."""
    nick = _nickname(team_name or "")
    if not nick:
        return None
    for c in await _recent_highlights(league, limit=40):
        if nick in _clip_haystack(c):
            return _shape(c)
    return None
