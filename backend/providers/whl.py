"""WHL provider adapter — maps the HockeyTech / Leaguestat feed into the canonical model.

Source: https://lscluster.hockeytech.com/feed/index.php  (free public key, no signup)
  client_code=whl, key=f1aa699db3d81487
This is the SECOND real league on The Ticker — it proves the universal chassis:
the same canonical Game/Team objects flow through the same registry the NHL uses.

Only what HockeyTech actually returns is exposed. Anything it doesn't provide is
left empty / capability-off so the UI hides it — never fabricated.
"""
from __future__ import annotations
import logging
import time

import httpx

from models.hockey import Game, TeamRef
from providers.base import HockeyProvider

logger = logging.getLogger("ticker.whl")

BASE = "https://lscluster.hockeytech.com/feed/index.php"
KEY = "f1aa699db3d81487"
CLIENT = "whl"


def _common(view: str) -> dict:
    return {"feed": "modulekit", "key": KEY, "client_code": CLIENT, "fmt": "json", "lang": "en", "view": view}


async def _get(client: httpx.AsyncClient, params: dict) -> dict:
    r = await client.get(BASE, params=params, timeout=20, follow_redirects=True)
    r.raise_for_status()
    return r.json().get("SiteKit", {})


_TEAM_CACHE: dict = {"ts": 0.0, "teams": []}


async def _team_index(client: httpx.AsyncClient) -> list[dict]:
    if _TEAM_CACHE["teams"] and (time.time() - _TEAM_CACHE["ts"] < 3600):
        return _TEAM_CACHE["teams"]
    data = await _get(client, {**_common("teamsbyseason")})
    teams = [{
        "id": str(t.get("id")),
        "abbr": t.get("code"),
        "name": t.get("name"),
        "city": t.get("city"),
        "nickname": t.get("nickname"),
        "logo": t.get("team_logo_url"),
        "division": t.get("division_long_name"),
    } for t in data.get("Teamsbyseason", [])]
    if teams:
        _TEAM_CACHE.update(ts=time.time(), teams=teams)
    return teams


def _int(v):
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def _group(status: str) -> str:
    # HockeyTech GameStatus: 1 = scheduled, 2/3 = in progress, 4 = final.
    if status == "4":
        return "final"
    if status in ("2", "3"):
        return "live"
    return "upcoming"


def _side(card: dict, side: str) -> dict:
    pre = "Home" if side == "home" else "Visitor"
    final_or_live = card.get("GameStatus") in ("2", "3", "4")
    return {
        "abbr": card.get(f"{pre}Code"),
        "name": card.get(f"{pre}LongName") or f"{card.get(f'{pre}City','')} {card.get(f'{pre}Nickname','')}".strip(),
        "logo": card.get(f"{pre}Logo"),
        "score": _int(card.get(f"{pre}Goals")) if final_or_live else None,
        "record": f"{card.get(f'{pre}Wins','0')}-{card.get(f'{pre}RegulationLosses','0')}-{card.get(f'{pre}OTLosses','0')}",
    }


class WHLProvider(HockeyProvider):
    code = "whl"
    name = "Western Hockey League"
    capabilities = {
        "standings": False,      # not wired in this proof cut
        "leaders": False,
        "recaps": True,          # finals available via scorebar
        "schedule": True,        # NEXT proof
        "team_page": False,
        "player_page": False,
        "search": True,          # teams + players searchable in onboarding
        "media": False,
    }

    async def scoreboard_now(self) -> dict:
        """Upcoming/live WHL games (NEXT). Real HockeyTech scorebar."""
        from datetime import date
        async with httpx.AsyncClient(headers={"User-Agent": "TheTicker/1.0"}) as client:
            data = await _get(client, {**_common("scorebar"), "numberofdaysahead": 21, "numberofdaysback": 2})
        rows = data.get("Scorebar", []) if isinstance(data, dict) else []
        games = []
        for c in rows:
            grp = _group(c.get("GameStatus", ""))
            games.append({
                "id": str(c.get("ID")),
                "state": c.get("GameStatusString") or "",
                "group": grp,
                "start_utc": c.get("GameDateISO8601"),
                "date": c.get("Date"),
                "game_type": None,
                "period": None, "period_type": None,
                "clock": c.get("GameClock") if grp == "live" else None,
                "in_intermission": bool(c.get("Intermission") == "1") if grp == "live" else None,
                "away": _side(c, "away"),
                "home": _side(c, "home"),
            })
        # NEXT = upcoming + live first (soonest first); fall back to recent finals.
        ahead = [g for g in games if g["group"] in ("upcoming", "live")]
        ahead.sort(key=lambda g: g.get("start_utc") or "")
        show = ahead or [g for g in games if g["group"] == "final"][-8:][::-1]
        today = date.today().isoformat()
        first_date = show[0].get("date") if show else None
        return {"date": first_date, "today": today, "league_name": self.name,
                "is_future": bool(first_date and first_date != today), "games": show[:14]}

    async def search(self, q: str, limit: int = 12) -> list[dict]:
        q = (q or "").strip()
        if len(q) < 2:
            return []
        ql = q.lower()
        teams_out: list[dict] = []
        players_out: list[dict] = []
        async with httpx.AsyncClient(headers={"User-Agent": "TheTicker/1.0"}) as client:
            try:
                for t in await _team_index(client):
                    hay = f"{t['name']} {t['city']} {t['nickname']} {t['abbr']}".lower()
                    if ql in hay:
                        teams_out.append({
                            "type": "team", "id": t["abbr"], "team_abbr": t["abbr"],
                            "name": t["name"], "subtitle": "WHL", "logo": t["logo"],
                            "league": "WHL", "league_code": "whl",
                        })
            except Exception:
                logger.exception("WHL team search failed")
            try:
                data = await _get(client, {**_common("searchplayers"), "search_term": q})
                for p in (data.get("Searchplayers") or []):
                    pid = str(p.get("person_id") or p.get("id") or "")
                    if not pid:
                        continue
                    name = (p.get("name") or f"{p.get('first_name','')} {p.get('last_name','')}").strip()
                    abbr = p.get("current_team_code") or p.get("team_code") or ""
                    pos = p.get("position") or p.get("position_id") or ""
                    sub = "WHL" + (f" · {pos}" if pos else "") + (f" · {abbr}" if abbr else "")
                    players_out.append({
                        "type": "player", "id": pid, "player_id": pid, "team_abbr": abbr,
                        "name": name or "WHL Player", "pos": pos, "subtitle": sub,
                        "headshot": None, "logo": None, "league": "WHL", "league_code": "whl",
                    })
            except Exception:
                logger.exception("WHL player search failed")
        return (teams_out + players_out)[:limit]

    # --- surfaces not wired in this proof cut (kept honest / minimal) ------
    async def game_by_id(self, game_id: str) -> Game:
        raise ValueError("WHL game page not wired yet")

    async def latest_game(self) -> Game:
        raise ValueError("WHL latest game not wired yet")

    async def recent_finals_now(self, limit: int = 15) -> list[dict]:
        board = await self.scoreboard_now()
        return [g for g in board.get("games", []) if g.get("group") == "final"][:limit]

    async def standings_now(self) -> dict:
        return {}

    async def leaders_now(self, limit: int = 8) -> dict:
        return {"skaters": {}, "goalies": {}}

    async def team_page(self, tri: str) -> dict:
        raise ValueError("WHL team page not wired yet")

    async def player_page(self, pid: str) -> dict:
        raise ValueError("WHL player page not wired yet")
