"""NAVI EXPLORE — BACKEND ENDPOINT EXCERPT (reference / not standalone-runnable).

These are the EXACT relevant pieces from Navi's backend/server.py so Best can drop the
Explore API in without diffing the whole 1867-line monolith. The full server.py is copied
alongside for comparison. Line numbers below are Navi server.py at time of extraction.

Dependencies these endpoints require (all copied in this transfer):
  - import highlightly                # backend/highlightly.py  -> all_leagues(), enabled()
  - import explore_taxonomy           # backend/explore_taxonomy.py -> resolve()
  - from entity_index import search_entities, warm   # backend/entity_index.py
  - from providers.registry import get_provider, list_providers, search_all
  - import eliteprospects             # ONLY used by /league/{code}/player (EP bio depth) -- OPTIONAL for Explore
  - api_router = APIRouter(prefix="/api")   # Best already has this
  - MongoDB / logger etc are Best's existing infra

Wiring notes:
  * On startup Navi warms the entity index:  `from entity_index import warm; await warm()`
    (server.py ~line 1860, in the FastAPI startup hook).
  * NCAA is injected as an AVAILABLE league (id 218640) because its live listing feed is
    empty in the offseason — see _explore_by_country().
"""

# =========================================================================================
# server.py lines ~1109-1121  — CONSTANTS
# =========================================================================================
_COUNTRY_FLAG = {
    "Canada": "🇨🇦", "USA": "🇺🇸", "Sweden": "🇸🇪", "Finland": "🇫🇮", "Switzerland": "🇨🇭",
    "Germany": "🇩🇪", "Czech Republic": "🇨🇿", "Czechia": "🇨🇿", "Slovakia": "🇸🇰", "Russia": "🇷🇺",
    "Norway": "🇳🇴", "Denmark": "🇩🇰", "France": "🇫🇷", "Austria": "🇦🇹", "Italy": "🇮🇹",
    "Latvia": "🇱🇻", "Belarus": "🇧🇾", "Poland": "🇵🇱", "Slovenia": "🇸🇮", "Hungary": "🇭🇺",
    "United Kingdom": "🇬🇧", "Kazakhstan": "🇰🇿", "Japan": "🇯🇵", "Australia": "🇦🇺",
    "Ukraine": "🇺🇦", "Netherlands": "🇳🇱", "Spain": "🇪🇸", "Lithuania": "🇱🇹", "Estonia": "🇪🇪",
    "Romania": "🇷🇴", "Turkey": "🇹🇷", "New Zealand": "🇳🇿", "Iceland": "🇮🇸", "Serbia": "🇷🇸",
    "Croatia": "🇭🇷", "China": "🇨🇳", "South Korea": "🇰🇷", "Europe": "🇪🇺", "World": "🌍",
}
# Which countries get a big card up top (order matters). Everything else -> "MORE COUNTRIES".
_FEATURED_COUNTRIES = ["Canada", "USA", "Sweden", "Finland", "Czech Republic", "Russia", "Switzerland", "Germany", "Slovakia"]
# The ONLY leagues wired end-to-end into Ticker. Highlightly league id -> Ticker league code.
_AVAILABLE_BY_HLID = {49291: "nhl", 4188: "whl", 3337: "ohl", 5039: "qmjhl", 218640: "ncaa"}
# Non-country buckets shown under "INTERNATIONAL".
_INTERNATIONAL = {"Europe", "World"}


# =========================================================================================
# server.py lines ~1124-1146  — shared inventory helper (provider truth, grouped by country)
# =========================================================================================
async def _explore_by_country() -> dict:
    """Provider-truth inventory grouped by country, each league carrying an honest
    status/code. Shared by the Explore world + progressive drill-down endpoints."""
    inv = await highlightly.all_leagues()                      # noqa: F821
    seen_ids = {l.get("id") for l in inv}
    injects = [{"id": 218640, "name": "NCAA", "country": "USA"}]  # NCAA offseason feed is empty
    for j in injects:
        if j["id"] not in seen_ids:
            inv = inv + [j]

    by_country: dict = {}
    for l in inv:
        hlid = l.get("id")
        code = _AVAILABLE_BY_HLID.get(hlid)
        country = l.get("country") or "Other"
        row = {"id": hlid, "name": l.get("name"), "country": country,
               "status": "available" if code else "coming_soon", "code": code}
        by_country.setdefault(country, []).append(row)
    return by_country


# =========================================================================================
# server.py lines ~1149-1191  — the two Explore endpoints
# =========================================================================================
@api_router.get("/explore/world")                              # noqa: F821
async def explore_world():
    """Country ENTRANCES for the main Explore surface (progressive drill-down starts here)."""
    by_country = await _explore_by_country()

    def country_group(name: str):
        rows = by_country.get(name, [])
        rows.sort(key=lambda r: (r["status"] != "available", r["name"] or ""))
        return {"country": name, "flag": _COUNTRY_FLAG.get(name, "🏒"),
                "available": sum(1 for r in rows if r["status"] == "available"),
                "total": len(rows), "leagues": rows}

    featured, others, international = [], [], []
    for name in sorted(by_country.keys()):
        if name in _INTERNATIONAL:
            international.append(country_group(name))
        elif name in _FEATURED_COUNTRIES:
            continue
        else:
            others.append(country_group(name))
    featured = [country_group(n) for n in _FEATURED_COUNTRIES if n in by_country]

    total_leagues = sum(len(v) for v in by_country.values())
    total_available = sum(1 for v in by_country.values() for r in v if r["status"] == "available")
    return {
        "enabled": highlightly.enabled(),                      # noqa: F821
        "totals": {"countries": len(by_country), "leagues": total_leagues, "available": total_available},
        "featured": featured, "countries": others, "international": international,
    }


@api_router.get("/explore/node")                               # noqa: F821
async def explore_node(path: str):
    """Progressive drill-down: return the ONE next layer of choices for a node path.
    Static trees (Canada/Sweden) differ per country; everything else falls back to an
    honest provider-truth 'browse this country's leagues' node."""
    by_country = await _explore_by_country()
    node = explore_taxonomy.resolve(path, by_country, lambda c: _COUNTRY_FLAG.get(c, "🏒"))  # noqa: F821
    if node is None:
        raise HTTPException(status_code=404, detail="Unknown explore path.")   # noqa: F821
    return node


# =========================================================================================
# server.py lines ~1456-1468  — universal SEARCH (the bypass). Powers Explore search + onboarding.
# =========================================================================================
@api_router.get("/search")                                     # noqa: F821
async def search(q: str = ""):
    """Universal entity search across every connected provider (verified only).
    Returns [] for queries we don't cover yet — client shows honest empty state, never fabricates."""
    try:
        results = await search_all(q, limit=16)                # noqa: F821  (providers.registry.search_all -> entity_index.search_entities)
    except Exception:
        logger.exception("search failed")                      # noqa: F821
        results = []
    return {"query": q, "results": results}


# =========================================================================================
# server.py lines ~1483-1542  — LEAGUE-scoped DESTINATIONS Explore navigates INTO.
# Any registered provider answers these; Explore reaches them via /league/<code> then team rows.
# =========================================================================================
@api_router.get("/league/{code}/standings")                    # noqa: F821
async def league_standings(code: str):
    try:
        return await get_provider(code).standings_now()        # noqa: F821
    except Exception:
        logger.exception("league_standings %s failed", code)   # noqa: F821
        return {"Eastern": [], "Western": []}


@api_router.get("/league/{code}/team/{tri}")                   # noqa: F821
async def league_team(code: str, tri: str):
    try:
        return await get_provider(code).team_page(tri)         # noqa: F821
    except Exception as e:
        logger.exception("league_team failed")                 # noqa: F821
        raise HTTPException(status_code=502, detail=f"Team data unavailable: {e}")  # noqa: F821


@api_router.get("/league/{code}/game/{gid}")                   # noqa: F821
async def league_game(code: str, gid: str):
    try:
        game = await get_provider(code).game_by_id(gid)        # noqa: F821
        return {"game": game.model_dump()}
    except Exception as e:
        logger.exception("league_game failed")                 # noqa: F821
        raise HTTPException(status_code=502, detail=f"Game data unavailable: {e}")  # noqa: F821


@api_router.get("/league/{code}/player/{pid}")                 # noqa: F821
async def league_player(code: str, pid: str, name: str = "", pos: str = ""):
    """Cross-league Player Page. HockeyTech has no player stats, so junior depth is
    EP-backed (bio/draft/career). league-agnostic + cached. (See full server.py for body.)"""
    ...  # see NAVI_EXPLORE_TRANSFER/backend/server.py lines ~1530-1560 for the full implementation
