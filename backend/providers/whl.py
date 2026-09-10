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
        "standings": True,       # WHL conference standings (HockeyTech)
        "leaders": True,         # scoring + goalie leaders
        "recaps": True,          # finals available via scorebar
        "schedule": True,        # NEXT
        "team_page": True,       # identity + record + schedule (verified)
        "player_page": False,    # HockeyTech player stats not reliably available yet — link stays gated
        "search": True,
        "media": False,
    }

    async def _active_season(self, client: httpx.AsyncClient) -> str:
        """Season whose date range contains today (preseason/regular), else newest."""
        from datetime import date
        data = await _get(client, {**_common("seasons")})
        seasons = data.get("Seasons", []) if isinstance(data, dict) else []
        today = date.today().isoformat()
        for s in seasons:
            sd, ed = s.get("start_date"), s.get("end_date")
            if sd and ed and sd <= today <= ed:
                return str(s.get("season_id"))
        return str(seasons[0]["season_id"]) if seasons else "295"

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
        """Recently COMPLETED WHL games (RECAP) — own scorebar lookback."""
        async with httpx.AsyncClient(headers={"User-Agent": "TheTicker/1.0"}) as client:
            data = await _get(client, {**_common("scorebar"), "numberofdaysahead": 0, "numberofdaysback": 21})
        rows = data.get("Scorebar", []) if isinstance(data, dict) else []
        finals = []
        for c in rows:
            if c.get("GameStatus") != "4":
                continue
            finals.append({
                "id": str(c.get("ID")), "state": "OFF", "group": "final",
                "date": c.get("Date"), "start_utc": c.get("GameDateISO8601"),
                "away": _side(c, "away"), "home": _side(c, "home"),
            })
        finals.sort(key=lambda g: g.get("date") or "", reverse=True)
        return finals[:limit]

    async def standings_now(self) -> dict:
        """WHL standings grouped into Eastern/Western conferences (matches Stats UI)."""
        import json as _json
        east: list[dict] = []
        west: list[dict] = []
        async with httpx.AsyncClient(headers={"User-Agent": "TheTicker/1.0"}) as client:
            season = await self._active_season(client)
            tindex = {t["abbr"]: t for t in await _team_index(client)}
            url = ("https://lscluster.hockeytech.com/feed/index.php?feed=statviewfeed&view=teams"
                   "&groupTeamsBy=division&context=overall&site_id=0&special=false&league_id=&conference=-1&division=-1"
                   f"&season={season}&key={KEY}&client_code={CLIENT}&fmt=json")
            r = await client.get(url, timeout=20, follow_redirects=True)
            raw = r.text.strip()
            if raw.startswith("("):
                raw = raw[1:-1]
            data = _json.loads(raw)
        for section in (data[0].get("sections", []) if data else []):
            for entry in section.get("data", []):
                row = entry.get("row", {})
                abbr = row.get("team_code")
                t = tindex.get(abbr, {})
                div = (t.get("division") or "").lower()
                conf_east = ("east" in div) or ("central" in div)
                out = {
                    "abbr": abbr, "name": t.get("name") or abbr, "short": t.get("nickname") or abbr,
                    "logo": t.get("logo"), "conference": "Eastern" if conf_east else "Western",
                    "division": t.get("division"),
                    "gp": _int(row.get("games_played")), "wins": _int(row.get("wins")),
                    "losses": _int(row.get("losses")), "ot": _int(row.get("ot_losses")),
                    "points": _int(row.get("points")), "gf": _int(row.get("goals_for")),
                    "ga": _int(row.get("goals_against")), "streak": row.get("streak") or "",
                    "conf_rank": _int(row.get("rank")),
                }
                (east if conf_east else west).append(out)
        east.sort(key=lambda x: (-(x["points"] or 0)))
        west.sort(key=lambda x: (-(x["points"] or 0)))
        for i, x in enumerate(east): x["conf_rank"] = i + 1
        for i, x in enumerate(west): x["conf_rank"] = i + 1
        return {"Eastern": east, "Western": west}

    async def leaders_now(self, limit: int = 8) -> dict:
        """WHL scoring + goalie leaders (real HockeyTech), shaped like the NHL leaders."""
        def _row(p):
            return {"id": str(p.get("player_id")), "name": p.get("name"),
                    "team_abbr": p.get("team_code"), "pos": p.get("position"),
                    "value": None, "headshot": None}
        out = {"skaters": {}, "goalies": {}}
        async with httpx.AsyncClient(headers={"User-Agent": "TheTicker/1.0"}) as client:
            season = await self._active_season(client)
            try:
                data = await _get(client, {**_common("statviewtype"), "type": "topscorers",
                                           "season_id": season, "first": 0, "limit": limit})
                sc = data.get("Statviewtype", []) if isinstance(data, dict) else []
                out["skaters"]["points"] = [{**_row(p), "value": _int(p.get("points"))} for p in sc]
                out["skaters"]["goals"] = [{**_row(p), "value": _int(p.get("goals"))}
                                           for p in sorted(sc, key=lambda x: _int(x.get("goals")) or 0, reverse=True)]
                out["skaters"]["assists"] = [{**_row(p), "value": _int(p.get("assists"))}
                                             for p in sorted(sc, key=lambda x: _int(x.get("assists")) or 0, reverse=True)]
            except Exception:
                logger.exception("WHL topscorers failed")
            try:
                data = await _get(client, {**_common("statviewtype"), "type": "topgoalies",
                                           "season_id": season, "first": 0, "limit": limit})
                gl = data.get("Statviewtype", []) if isinstance(data, dict) else []
                out["goalies"]["wins"] = [{**_row(p), "value": _int(p.get("wins"))} for p in gl]
                out["goalies"]["gaa"] = [{**_row(p), "value": p.get("goals_against_average")}
                                         for p in gl if p.get("goals_against_average") is not None]
                out["goalies"]["svpct"] = [{**_row(p), "value": p.get("save_percentage")}
                                           for p in gl if p.get("save_percentage") is not None]
            except Exception:
                logger.exception("WHL topgoalies failed")
        return out

    # --- depth pages ------------------------------------------------------
    def _card(self, c: dict) -> dict:
        return {"id": str(c.get("ID")), "date": c.get("Date"), "start_utc": c.get("GameDateISO8601"),
                "away": _side(c, "away"), "home": _side(c, "home")}

    async def game_by_id(self, game_id: str) -> Game:
        """Verified WHL game from the schedule (teams/score/status/date).
        Scoring plays / stars / team stats are not exposed by HockeyTech here,
        so those modules simply don't render — never fabricated."""
        async with httpx.AsyncClient(headers={"User-Agent": "TheTicker/1.0"}) as client:
            data = await _get(client, {**_common("scorebar"), "numberofdaysahead": 45, "numberofdaysback": 45})
        rows = data.get("Scorebar", []) if isinstance(data, dict) else []
        c = next((x for x in rows if str(x.get("ID")) == str(game_id)), None)
        if not c:
            raise ValueError("WHL game not found")
        st = c.get("GameStatus")
        status = "FINAL" if st == "4" else ("LIVE" if st in ("2", "3") else "FUT")
        a, h = _side(c, "away"), _side(c, "home")
        return Game(
            id=str(c.get("ID")), league="WHL", date=c.get("Date") or "", start_utc=c.get("GameDateISO8601"),
            status=status, venue=c.get("venue_name") or None,
            away=TeamRef(id=a["abbr"] or "??", abbr=a["abbr"] or "??", name=a["name"] or a["abbr"] or "", logo=a["logo"], score=a["score"]),
            home=TeamRef(id=h["abbr"] or "??", abbr=h["abbr"] or "??", name=h["name"] or h["abbr"] or "", logo=h["logo"], score=h["score"]),
            has_video=False,
        )

    async def latest_game(self) -> Game:
        finals = await self.recent_finals_now(limit=1)
        if not finals:
            raise ValueError("no completed WHL game")
        return await self.game_by_id(finals[0]["id"])

    async def team_page(self, tri: str) -> dict:
        """Verified WHL team: identity + standings record + recent/next schedule.
        Scorers / goalie / roster are omitted (not reliably provided) so those
        modules disappear on the shared Team page — no fabrication."""
        tri = (tri or "").upper()
        stand = await self.standings_now()
        allrows = stand["Eastern"] + stand["Western"]
        row = next((r for r in allrows if r["abbr"] == tri), None)
        if not row:
            raise ValueError("unknown WHL team")
        divteams = sorted([r for r in allrows if r.get("division") == row.get("division")],
                          key=lambda x: -(x["points"] or 0))
        div_rank = divteams.index(row) + 1
        async with httpx.AsyncClient(headers={"User-Agent": "TheTicker/1.0"}) as client:
            data = await _get(client, {**_common("scorebar"), "numberofdaysahead": 30, "numberofdaysback": 30})
        rows = data.get("Scorebar", []) if isinstance(data, dict) else []
        mine = [c for c in rows if tri in (c.get("HomeCode"), c.get("VisitorCode"))]
        finals = sorted([c for c in mine if c.get("GameStatus") == "4"], key=lambda c: c.get("GameDateISO8601") or "", reverse=True)
        upcoming = sorted([c for c in mine if c.get("GameStatus") == "1"], key=lambda c: c.get("GameDateISO8601") or "")
        gf, ga = row["gf"], row["ga"]
        return {
            "team": {"abbr": tri, "name": row["name"], "short": row["short"], "logo": row["logo"],
                     "division": row["division"], "conference": row["conference"]},
            "record": {"wins": row["wins"], "losses": row["losses"], "ot": row["ot"],
                       "points": row["points"], "conf_rank": row["conf_rank"], "div_rank": div_rank},
            "goals": {"gf": gf, "ga": ga, "diff": (gf - ga) if (gf is not None and ga is not None) else 0},
            "form": {"l10": "–", "streak": row.get("streak") or "–", "home": "–", "road": "–"},
            "scorers": [], "goalie": None,
            "recent": [self._card(c) for c in finals[:5]],
            "next": self._card(upcoming[0]) if upcoming else None,
            "roster": None,
        }

    async def player_page(self, pid: str) -> dict:
        raise ValueError("WHL player page not available yet")
