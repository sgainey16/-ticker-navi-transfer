"""Elite Prospects — cached, on-demand player enrichment for THE TICKER.

DEVELOPMENT ALLOWANCE MINDSET (1,000 calls/month, Basic tier):
  * NEVER treat EP like production traffic. Every retrieval is cached PERSISTENTLY
    in Mongo (30-day TTL) and deduped, so opening the same player again = 0 calls.
  * On-demand only — we call EP when a specific player is actually viewed or named
    by the desk, never in bulk/prefetch loops.
  * A monthly usage counter (ep_usage) tracks real upstream calls vs the 1,000 cap,
    so we can watch whether EP earns a permanent place before spending cash.

What EP adds that Highlightly does NOT: player bios (height/weight/shoots/age),
birthplace + youth team, DRAFT selection, NHL rights, career league path, play
styles, and a written biography — the deeper hockey knowledge that makes Reggie &
Marc smarter. (Transfers/season-stats endpoints are gated on the free tier.)
"""
from __future__ import annotations

import logging
import os
import re
import time

import httpx
from motor.motor_asyncio import AsyncIOMotorClient

logger = logging.getLogger("ticker.eliteprospects")

BASE = "https://api.eliteprospects.com/v1"
CACHE_TTL = 30 * 24 * 3600          # bios change slowly — cache a month
NEG_TTL = 7 * 24 * 3600             # remember "no match" for a week
_mem: dict = {}                      # per-process hot cache on top of Mongo

_client = None
_db = None


def _key() -> str:
    return os.environ.get("ELITEPROSPECTS_API_KEY", "").strip()


def enabled() -> bool:
    return bool(_key())


def _database():
    global _client, _db
    if _db is None:
        _client = AsyncIOMotorClient(os.environ["MONGO_URL"])
        _db = _client[os.environ["DB_NAME"]]
    return _db


async def _bump_usage():
    month = time.strftime("%Y-%m")
    try:
        await _database().ep_usage.update_one({"_id": month}, {"$inc": {"count": 1}}, upsert=True)
    except Exception:
        logger.exception("ep usage bump failed")


async def usage() -> dict:
    month = time.strftime("%Y-%m")
    try:
        doc = await _database().ep_usage.find_one({"_id": month}) or {}
        cached = await _database().ep_cache.estimated_document_count()
    except Exception:
        doc, cached = {}, 0
    used = int(doc.get("count", 0))
    return {"month": month, "calls_used": used, "monthly_limit": 1000,
            "remaining": max(0, 1000 - used), "cached_records": cached,
            "note": "Basic tier · cached 30d so re-views cost 0 · EP emails at 80/90/100%"}


async def _cache_get(ckey: str):
    if ckey in _mem and (time.time() - _mem[ckey]["ts"] < CACHE_TTL):
        return _mem[ckey]
    try:
        doc = await _database().ep_cache.find_one({"_id": ckey})
    except Exception:
        doc = None
    if doc:
        _mem[ckey] = doc
    return doc


async def _cache_put(ckey: str, data, ttl: int):
    rec = {"_id": ckey, "ts": time.time(), "ttl": ttl, "data": data}
    _mem[ckey] = rec
    try:
        await _database().ep_cache.update_one({"_id": ckey}, {"$set": rec}, upsert=True)
    except Exception:
        logger.exception("ep cache write failed for %s", ckey)


async def _get(client: httpx.AsyncClient, path: str, params: dict) -> dict | None:
    p = {**params, "apiKey": _key()}
    r = await client.get(f"{BASE}{path}", params=p, timeout=20)
    await _bump_usage()                              # count only REAL upstream calls
    if r.status_code != 200:
        logger.warning("EP %s -> HTTP %s", path, r.status_code)
        return None
    return r.json()


_TAG = re.compile(r"<[^>]+>")


def _strip(html: str | None, limit: int = 420) -> str | None:
    if not html:
        return None
    txt = _TAG.sub("", html).replace("&nbsp;", " ").strip()
    txt = re.sub(r"\s+", " ", txt)
    return (txt[:limit].rstrip() + "…") if len(txt) > limit else (txt or None)


def _normalize(d: dict) -> dict:
    h = d.get("height") or {}
    w = d.get("weight") or {}
    draft = d.get("draftSelection") or None
    draft_str = None
    if draft:
        dt = (draft.get("draftType") or {}).get("name") or "Draft"
        team = (draft.get("team") or {}).get("name")
        draft_str = f"{draft.get('year')} {dt}: Round {draft.get('round')}, #{draft.get('overall')} overall"
        if team:
            draft_str += f" by {team}"
    rights = d.get("nhlRights") or None
    rights_str = None
    if rights and rights.get("team"):
        rights_str = f"{(rights.get('rights') or 'held').title()} — {(rights['team'] or {}).get('name')}"
    leagues, seen = [], set()
    for lg in (d.get("leagueExperience") or []):
        nm = lg.get("name")
        if nm and nm not in seen:
            seen.add(nm); leagues.append(nm)
    styles = [s.get("name") for s in (d.get("playerStyles") or []) if s.get("name")]
    latest = d.get("latestStats") or {}
    latest_str = None
    if latest.get("team"):
        latest_str = f"{(latest.get('season') or {}).get('slug','')} · {(latest['team'] or {}).get('name')}".strip(" ·")
    return {
        "ep_id": d.get("id"),
        "name": d.get("name"),
        "position": d.get("detailedPosition") or d.get("position"),
        "shoots": d.get("shoots"),
        "height": (h.get("imperial") if isinstance(h, dict) else None),
        "height_cm": (h.get("metrics") if isinstance(h, dict) else None),
        "weight": (f"{w.get('imperial')} lb" if isinstance(w, dict) and w.get("imperial") else None),
        "weight_kg": (w.get("metrics") if isinstance(w, dict) else None),
        "age": d.get("age"),
        "dob": d.get("dateOfBirth"),
        "birthplace": d.get("placeOfBirth"),
        "nationality": (d.get("nationality") or {}).get("name"),
        "youth_team": d.get("youthTeam"),
        "status": d.get("status"),
        "draft": draft_str,
        "nhl_rights": rights_str,
        "styles": styles[:4],
        "career_leagues": leagues[:12],
        "latest": latest_str,
        "bio": _strip(d.get("biographyAsHTML") or d.get("profileDescriptionAsHTML")),
        "image": d.get("imageUrl") or (d.get("photo") or None),
        "ep_url": (f"https://www.eliteprospects.com/{d.get('eliteprospectsUrlPath')}"
                   if d.get("eliteprospectsUrlPath") else None),
    }


async def player_by_name(name: str, pos: str | None = None) -> dict | None:
    """Resolve a player by name and return a normalized EP profile (cached).

    Cost the first time: 1 search + 1 detail. Every subsequent view: 0 (cached)."""
    name = (name or "").strip()
    if not name or not enabled():
        return None
    ckey = f"byname:{name.lower()}|{(pos or '').lower()}"
    hit = await _cache_get(ckey)
    if hit is not None:
        return hit.get("data")
    try:
        async with httpx.AsyncClient() as client:
            search = await _get(client, "/players", {"name": name, "limit": 5})
            rows = (search or {}).get("data") or []
            if not rows:
                await _cache_put(ckey, None, NEG_TTL)
                return None
            # prefer a name match; if a position hint is given, nudge toward it
            def score(p):
                s = 0
                if (p.get("name") or "").lower() == name.lower():
                    s += 2
                if pos and (p.get("position") or "").upper().startswith(pos.upper()[:1]):
                    s += 1
                return s
            best = sorted(rows, key=score, reverse=True)[0]
            pid = best.get("id")
            pkey = f"player:{pid}"
            phit = await _cache_get(pkey)
            if phit is not None and phit.get("data"):
                await _cache_put(ckey, phit["data"], CACHE_TTL)
                return phit["data"]
            detail = await _get(client, f"/players/{pid}", {})
            if not detail:
                await _cache_put(ckey, None, NEG_TTL)
                return None
            raw = detail.get("data", detail)
            prof = _normalize(raw)
            await _cache_put(pkey, prof, CACHE_TTL)
            await _cache_put(ckey, prof, CACHE_TTL)
            return prof
    except Exception:
        logger.exception("EP player_by_name failed for %r", name)
        return None


async def scorer_backgrounds(tp: dict, limit: int = 3) -> str:
    """A grounded fact-sheet snippet on a team's top scorers, for the Live Desk.

    Only verified EP fields — makes Reggie & Marc able to speak to size/age/
    birthplace/draft/style. Returns '' when EP has nothing (never fabricates)."""
    if not enabled():
        return ""
    scorers = (tp.get("scorers") or [])[:limit]
    lines = []
    for s in scorers:
        prof = await player_by_name(s.get("name"), s.get("pos"))
        if not prof:
            continue
        bits = []
        phys = " ".join(x for x in [prof.get("height"), prof.get("weight")] if x)
        if phys:
            bits.append(phys)
        if prof.get("age"):
            bits.append(f"age {prof['age']}")
        if prof.get("shoots"):
            bits.append(f"shoots {prof['shoots']}")
        if prof.get("birthplace"):
            bits.append(f"from {prof['birthplace']}")
        if prof.get("draft"):
            bits.append(prof["draft"])
        if prof.get("styles"):
            bits.append("style: " + ", ".join(prof["styles"]))
        if bits:
            lines.append(f"- {prof['name']}: " + "; ".join(bits) + ".")
    if not lines:
        return ""
    return "PLAYER BACKGROUND (verified, Elite Prospects):\n" + "\n".join(lines)
