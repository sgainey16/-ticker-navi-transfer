"""NCAA (Men's Division I Hockey) — the thin, HONEST provider.

Structure  -> Highlightly (leagueId 218640): teams, conferences/standings,
              schedule, scores, game state, video.
People     -> Elite Prospects (name search + bio/draft/career), league-agnostic
              and cached — because neither source exposes NCAA rosters.

EMBRACE THE MISSING DATA (do not fake it):
  * No roster / team scorer list  -> team page omits "Leading the Way"; players
    are discovered by NAME through EP, never invented.
  * No GF/GA from Highlightly     -> goals are null; the UI hides that strip.
  * No verified team logos        -> logo is null; the UI shows a monogram.

IDS ARE KEPT SEPARATE. Highlightly numeric team ids live only inside this adapter.
The app sees a stable canonical short CODE (e.g. DEN, MICH, MINN, BU) produced by
an explicit alias/normalization layer — the two id spaces are never treated as one.
"""
from __future__ import annotations

import logging
import time
import unicodedata

from models.hockey import Game, TeamRef
from providers.base import HockeyProvider
import highlightly
import eliteprospects

logger = logging.getLogger("ticker.ncaa")

# Explicit, verified school -> canonical short code. We DO NOT infer these blindly;
# well-known programs (and anything the acceptance test touches) are pinned here.
ALIASES: dict[str, str] = {
    "boston university terriers": "BU",
    "boston college eagles": "BC",
    "denver pioneers": "DEN",
    "michigan wolverines": "MICH",
    "michigan state spartans": "MSU",
    "minnesota golden gophers": "MINN",
    "minnesota duluth bulldogs": "UMD",
    "north dakota fighting hawks": "UND",
    "wisconsin badgers": "WIS",
    "quinnipiac bobcats": "QUIN",
    "maine black bears": "MNE",
    "cornell big red": "COR",
    "harvard crimson": "HARV",
    "western michigan broncos": "WMU",
    "providence friars": "PROV",
    "ohio state buckeyes": "OSU",
    "penn state nittany lions": "PSU",
    "notre dame fighting irish": "ND",
    "massachusetts minutemen": "UMASS",
}


def _norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s or "")
    s = "".join(c for c in s if not unicodedata.combining(c))
    return " ".join("".join(c.lower() if (c.isalnum() or c == " ") else " " for c in s).split())


def _code(name: str) -> str:
    key = _norm(name)
    if key in ALIASES:
        return ALIASES[key]
    words = [w for w in key.split() if w]
    base = (words[0] if words else key)[:4]
    return base.upper() or "NCAA"


class NCAAProvider(HockeyProvider):
    code = "ncaa"
    name = "NCAA (Men's Hockey)"
    capabilities = {
        "standings": True,
        "leaders": False,      # no verified NCAA scoring leaders source (no rosters)
        "recaps": True,
        "schedule": True,
        "team_page": True,
        "player_page": False,  # EP-backed via the league player route (name-based)
        "search": True,
        "media": True,
    }

    def __init__(self) -> None:
        self._idx: dict = {"ts": 0.0, "by_code": {}, "by_hlid": {}}

    # ------------------------------------------------------------------ index
    async def _index(self) -> dict:
        if self._idx["by_code"] and (time.time() - self._idx["ts"] < 900):
            return self._idx
        groups = await highlightly.standings("ncaa")
        by_code: dict = {}
        by_hlid: dict = {}
        for g in groups:
            gname = g.get("name") or "NCAA"
            for r in (g.get("standings") or []):
                t = r.get("team") or {}
                hlid = str(t.get("id"))
                nm = t.get("name") or ""
                if not hlid or not nm:
                    continue
                code = _code(nm)
                while code in by_code and by_code[code]["hlid"] != hlid:
                    code += "X"
                row = {
                    "code": code, "hlid": hlid, "name": nm, "short": nm,
                    "group": gname, "wins": r.get("wins"), "losses": r.get("loses"),
                    "ot": r.get("losesOvertime"), "gp": r.get("gamesPlayed"),
                    "conf_rank": r.get("position"),
                }
                by_code[code] = row
                by_hlid[hlid] = code
        if by_code:
            self._idx = {"ts": time.time(), "by_code": by_code, "by_hlid": by_hlid}
        return self._idx

    # ------------------------------------------------------------------ cards
    def _card(self, m: dict, idx: dict) -> dict:
        ht = m.get("homeTeam") or {}
        at = m.get("awayTeam") or {}
        hcode = idx["by_hlid"].get(str(ht.get("id"))) or _code(ht.get("name") or "")
        acode = idx["by_hlid"].get(str(at.get("id"))) or _code(at.get("name") or "")
        score = ((m.get("state") or {}).get("score") or {})
        cur = score.get("current")
        hs = as_ = None
        final = False
        if cur and "-" in str(cur):
            try:
                hs, as_ = [int(x.strip()) for x in str(cur).split("-")[:2]]
                final = True
            except Exception:
                hs = as_ = None
        return {
            "id": str(m.get("id")), "date": (m.get("date") or "")[:10], "start_utc": m.get("date"),
            "state": "OFF" if final else "FUT", "group": "final" if final else "upcoming",
            "away": {"abbr": acode, "score": as_, "logo": None, "name": at.get("name")},
            "home": {"abbr": hcode, "score": hs, "logo": None, "name": ht.get("name")},
        }

    async def _cards(self) -> tuple[list[dict], dict]:
        idx = await self._index()
        ms = await highlightly.matches("ncaa")
        return [self._card(m, idx) for m in ms], idx

    # ------------------------------------------------------------------ surfaces
    async def standings_now(self) -> dict:
        idx = await self._index()
        rows = [{
            "abbr": row["code"], "name": row["name"], "short": row["short"], "logo": None,
            "division": row["group"], "conference": row["group"],
            "wins": row["wins"], "losses": row["losses"], "ot": row["ot"], "points": None,
            "gp": row["gp"], "gf": None, "ga": None, "conf_rank": row["conf_rank"], "streak": None,
        } for row in idx["by_code"].values()]
        groups: dict = {}
        for r in rows:
            groups.setdefault(r["division"], []).append(r)
        # Eastern holds every row so the shared team_page (Eastern+Western) resolves;
        # `groups` is the honest conference view for a future NCAA standings screen.
        return {"Eastern": rows, "Western": [],
                "groups": [{"name": k, "rows": v} for k, v in groups.items()]}

    async def team_page(self, tri: str) -> dict:
        idx = await self._index()
        code = (tri or "").upper()
        row = idx["by_code"].get(code)
        if not row:
            c = idx["by_hlid"].get(str(tri))
            row = idx["by_code"].get(c) if c else None
            if row:
                code = c
        if not row:
            raise ValueError("unknown NCAA team")
        group = row["group"]
        divrows = sorted([r for r in idx["by_code"].values() if r["group"] == group],
                         key=lambda x: (x["conf_rank"] or 999))
        div_rank = next((i + 1 for i, r in enumerate(divrows) if r["code"] == code), row["conf_rank"])

        ms = await highlightly.matches("ncaa")
        mine = [self._card(m, idx) for m in ms
                if str((m.get("homeTeam") or {}).get("id")) == row["hlid"]
                or str((m.get("awayTeam") or {}).get("id")) == row["hlid"]]
        finals = sorted([c for c in mine if c["group"] == "final"], key=lambda c: c["start_utc"] or "", reverse=True)
        upcoming = sorted([c for c in mine if c["group"] == "upcoming"], key=lambda c: c["start_utc"] or "")

        return {
            "team": {"abbr": code, "name": row["name"], "short": row["short"], "logo": None,
                     "division": group, "conference": group},
            "record": {"wins": row["wins"], "losses": row["losses"], "ot": row["ot"],
                       "points": None, "gp": row["gp"], "conf_rank": row["conf_rank"], "div_rank": div_rank},
            "goals": {"gf": None, "ga": None, "diff": 0},        # Highlightly has no NCAA goals
            "form": {"l10": "–", "streak": "–", "home": "–", "road": "–"},
            "coach": None,
            "division_teams": [{"abbr": r["code"], "name": r["name"], "short": r["short"], "logo": None,
                                "wins": r["wins"], "losses": r["losses"], "ot": r["ot"], "points": None,
                                "gp": r["gp"], "div_rank": i + 1} for i, r in enumerate(divrows)],
            "scorers": [],       # no roster/scorer source — omitted, never faked
            "goalie": None,
            "goalies": [],
            "recent": finals[:6],
            "next": upcoming[0] if upcoming else None,
            "last_game": None,
            "roster": None,
        }

    async def scoreboard_now(self) -> dict:
        cards, _ = await self._cards()
        up = sorted([c for c in cards if c["group"] == "upcoming"], key=lambda c: c["start_utc"] or "")
        fin = sorted([c for c in cards if c["group"] == "final"], key=lambda c: c["start_utc"] or "", reverse=True)
        games = up[:12] if up else fin[:12]
        return {"date": (games[0]["date"] if games else None), "league_name": "NCAA",
                "is_future": bool(up), "games": games}

    async def recent_finals_now(self, limit: int = 15) -> list[dict]:
        cards, _ = await self._cards()
        fin = sorted([c for c in cards if c["group"] == "final"], key=lambda c: c["start_utc"] or "", reverse=True)
        return fin[:limit]

    async def game_by_id(self, game_id: str) -> Game:
        idx = await self._index()
        ms = await highlightly.matches("ncaa")
        m = next((x for x in ms if str(x.get("id")) == str(game_id)), None)
        if not m:
            raise ValueError("unknown NCAA game")
        card = self._card(m, idx)
        home, away = card["home"], card["away"]
        final = card["group"] == "final"
        has_video = False
        try:
            pkg = await highlightly.match_highlights(
                "ncaa", home.get("name") or home["abbr"], away.get("name") or away["abbr"], card["start_utc"])
            has_video = bool(pkg.get("recap") or pkg.get("clips"))
        except Exception:
            logger.exception("NCAA game video probe failed")
        return Game(
            id=str(m.get("id")), league="NCAA", date=card["date"], start_utc=card["start_utc"],
            status="FINAL" if final else "SCHEDULED",
            home=TeamRef(id=home["abbr"], abbr=home["abbr"], name=home.get("name") or home["abbr"],
                         logo=None, score=home.get("score")),
            away=TeamRef(id=away["abbr"], abbr=away["abbr"], name=away.get("name") or away["abbr"],
                         logo=None, score=away.get("score")),
            has_video=has_video,
        )

    async def latest_game(self) -> Game:
        fin = await self.recent_finals_now(limit=1)
        if not fin:
            raise ValueError("no NCAA finals available")
        return await self.game_by_id(fin[0]["id"])

    async def leaders_now(self, limit: int = 8) -> dict:
        # No verified NCAA scoring-leaders source (no rosters) — honest empty.
        return {"skaters": {}, "goalies": {}}

    async def player_page(self, pid: str) -> dict:
        # NCAA player depth is EP-backed by NAME (handled in the league player route).
        raise ValueError("NCAA player page is EP-backed (name-based)")

    async def search(self, q: str, limit: int = 12) -> list[dict]:
        q = (q or "").strip()
        if len(q) < 2:
            return []
        ql = _norm(q)
        out: list[dict] = []
        try:
            idx = await self._index()
            for code, row in idx["by_code"].items():
                if ql in _norm(row["name"]) or ql in _norm(code):
                    out.append({
                        "type": "team", "id": code, "team_abbr": code, "name": row["name"],
                        "subtitle": f"NCAA · {row['group']}", "logo": None,
                        "league": "NCAA", "league_code": "ncaa",
                    })
        except Exception:
            logger.exception("NCAA team search failed")
        # Name-based player discovery via EP (cached; only for specific queries so we
        # never bulk-query the dev allowance). We DON'T have rosters — this is the path.
        if len(q) >= 4:
            try:
                for p in await eliteprospects.search_players(q, limit=6):
                    if not p.get("ep_id"):
                        continue
                    out.append({
                        "type": "player", "id": f"ep{p['ep_id']}", "player_id": f"ep{p['ep_id']}",
                        "team_abbr": "", "name": p.get("name"), "pos": p.get("position"),
                        "subtitle": p.get("subtitle") or "Elite Prospects",
                        "headshot": p.get("image"), "logo": None,
                        "league": "NCAA", "league_code": "ncaa",
                    })
            except Exception:
                logger.exception("NCAA EP player search failed")
        return out[:limit]
