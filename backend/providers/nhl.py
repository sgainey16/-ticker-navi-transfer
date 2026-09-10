"""NHL provider adapter — maps the public NHL API into the canonical hockey model.

Source: https://api-web.nhle.com/v1  (no key required)
Endpoints used: score/{date}, schedule/{date}, gamecenter/{id}/landing,
gamecenter/{id}/right-rail, gamecenter/{id}/boxscore.

All network I/O is async (httpx) so it never blocks the FastAPI event loop.
"""
from __future__ import annotations
import asyncio
import logging
from datetime import date, timedelta
from typing import Optional

import httpx

from models.hockey import (
    Game, TeamRef, ScoringPlay, PenaltyPlay, SkaterLine, GoalieLine, StarLine, SeriesContext,
)

logger = logging.getLogger("ticker.nhl")
BASE = "https://api-web.nhle.com/v1"
FINAL_STATES = {"OFF", "FINAL"}
DEFAULT_GAME_ID = "2025030416"  # 2025-26 Stanley Cup Final G6 fallback (offseason)


def _n(v):
    """NHL fields are often {'default': 'x'}; normalize to a plain string."""
    if isinstance(v, dict):
        return v.get("default") or ""
    return v or ""


async def _get(client: httpx.AsyncClient, path: str) -> dict:
    r = await client.get(f"{BASE}/{path}", follow_redirects=True, timeout=25)
    r.raise_for_status()
    return r.json()


async def find_latest_final(client: httpx.AsyncClient) -> str:
    """Return the game id of the most recent COMPLETED game.

    Scans the schedule backward a week at a time (each call covers a game-week),
    so it works both in-season and in the offseason without hundreds of requests.
    Falls back to the last Stanley Cup Final game if nothing is found.
    """
    try:
        now = await _get(client, "score/now")
        cursor = date.fromisoformat(now.get("currentDate"))
    except Exception:
        cursor = date.today()

    for _ in range(20):  # up to ~20 weeks back
        try:
            sched = await _get(client, f"schedule/{cursor.isoformat()}")
        except Exception:
            cursor -= timedelta(days=7)
            continue
        completed = []
        for day in sched.get("gameWeek", []):
            for g in day.get("games", []):
                if g.get("gameState") in FINAL_STATES:
                    completed.append((day.get("date"), g.get("id")))
        if completed:
            completed.sort(key=lambda x: x[0])
            return str(completed[-1][1])
        # jump to the week before this game-week
        first = sched.get("gameWeek", [{}])[0].get("date")
        cursor = (date.fromisoformat(first) if first else cursor) - timedelta(days=7)

    logger.warning("No completed game found via schedule scan; using fallback")
    return DEFAULT_GAME_ID


def _round_label(game_type: int, game_id: str) -> Optional[str]:
    if game_type != 3:
        return None
    # playoff id tail: ...03 R S GG  -> round digit near the end
    tail = game_id[-4:]  # e.g. "0416" -> round 4, game 16-ish
    try:
        rnd = int(tail[1])
    except Exception:
        return "Playoffs"
    return {1: "First Round", 2: "Second Round", 3: "Conference Final",
            4: "Stanley Cup Final"}.get(rnd, "Playoffs")


async def fetch_game(client: httpx.AsyncClient, game_id: str) -> Game:
    landing = await _get(client, f"gamecenter/{game_id}/landing")
    try:
        rr = await _get(client, f"gamecenter/{game_id}/right-rail")
    except Exception:
        rr = {}
    try:
        box = await _get(client, f"gamecenter/{game_id}/boxscore")
    except Exception:
        box = {}

    home = landing["homeTeam"]
    away = landing["awayTeam"]
    home_abbr = _n(home.get("abbrev"))
    away_abbr = _n(away.get("abbrev"))

    def team_ref(t):
        return TeamRef(
            id=_n(t.get("abbrev")).lower(),
            abbr=_n(t.get("abbrev")),
            name=(_n(t.get("placeName")) + " " + _n(t.get("commonName"))).strip() or _n(t.get("name")),
            logo=t.get("logo"),
            score=t.get("score"),
        )

    scoring: list[ScoringPlay] = []
    for per in landing.get("summary", {}).get("scoring", []):
        pnum = per.get("periodDescriptor", {}).get("number", 0)
        ptype = per.get("periodDescriptor", {}).get("periodType", "REG")
        for goal in per.get("goals", []):
            name = (_n(goal.get("firstName")) + " " + _n(goal.get("lastName"))).strip() \
                or _n(goal.get("name"))
            strength = (goal.get("strength") or goal.get("goalModifier") or "ev")
            strength = "ev" if strength in ("even", "", None) else strength
            en = bool(goal.get("goalModifier") == "empty-net") or strength == "empty-net"
            scoring.append(ScoringPlay(
                period=pnum, period_type=ptype, time=_n(goal.get("timeInPeriod")),
                team_abbr=_n(goal.get("teamAbbrev")),
                scorer=name,
                scorer_id=goal.get("playerId"),
                assists=[_n(a.get("name")) for a in goal.get("assists", [])],
                strength=("pp" if "power" in str(strength) else "sh" if "short" in str(strength) else ("en" if en else "ev")),
                empty_net=en,
            ))

    penalties: list[PenaltyPlay] = []
    for per in landing.get("summary", {}).get("penalties", []):
        pnum = per.get("periodDescriptor", {}).get("number", 0)
        ptype = per.get("periodDescriptor", {}).get("periodType", "REG")
        for pen in per.get("penalties", []):
            cp = pen.get("committedByPlayer") or {}
            pname = (_n(cp.get("firstName")) + " " + _n(cp.get("lastName"))).strip()
            penalties.append(PenaltyPlay(
                period=pnum, period_type=ptype, time=_n(pen.get("timeInPeriod")),
                team_abbr=_n(pen.get("teamAbbrev")), player=pname,
                type=_n(pen.get("type")) or "MIN",
                duration=pen.get("duration"),
                desc=(_n(pen.get("descKey")).replace("-", " ") or None),
            ))

    stars = []
    for s in landing.get("summary", {}).get("threeStars", []):
        bits = []
        if s.get("goals") not in (None, ""):
            bits.append(f"{s.get('goals')}G")
        if s.get("assists") not in (None, ""):
            bits.append(f"{s.get('assists')}A")
        if s.get("savePctg") not in (None, ""):
            bits.append(f"{s.get('savePctg')} SV%")
        stars.append(StarLine(star=s.get("star", 0), name=_n(s.get("name")),
                              player_id=s.get("playerId"),
                              team_abbr=_n(s.get("teamAbbrev")), note=" ".join(bits) or None))

    goalies: list[GoalieLine] = []
    pbg = box.get("playerByGameStats", {})
    for side, abbr in (("awayTeam", away_abbr), ("homeTeam", home_abbr)):
        for g in pbg.get(side, {}).get("goalies", []):
            toi = _n(g.get("toi"))
            if toi in ("", "00:00"):
                continue
            sa = g.get("shotsAgainst") or 0
            ga = g.get("goalsAgainst") or 0
            goalies.append(GoalieLine(
                name=_n(g.get("name")), team_abbr=abbr,
                player_id=g.get("playerId"),
                shots_against=sa, saves=g.get("saves") or 0, goals_against=ga,
                toi=toi, decision=g.get("decision"), shutout=(ga == 0 and sa > 0),
            ))

    team_stats = {}
    for row in rr.get("teamGameStats", []):
        team_stats[row.get("category")] = {"away": row.get("awayValue"), "home": row.get("homeValue")}

    # Top skaters (box-score key players) — points first, then goals.
    top_skaters: list[SkaterLine] = []
    for side, abbr in (("awayTeam", away_abbr), ("homeTeam", home_abbr)):
        for grp in ("forwards", "defense"):
            for sk in pbg.get(side, {}).get(grp, []):
                pts = sk.get("points") or 0
                if pts <= 0:
                    continue
                top_skaters.append(SkaterLine(
                    name=_n(sk.get("name")), team_abbr=abbr,
                    player_id=sk.get("playerId"), position=sk.get("position"),
                    goals=sk.get("goals") or 0, assists=sk.get("assists") or 0, points=pts,
                    sog=sk.get("sog"), toi=_n(sk.get("toi")) or None,
                ))
    top_skaters.sort(key=lambda x: (x.points, x.goals), reverse=True)
    top_skaters = top_skaters[:6]

    series = None
    gt = landing.get("gameType")
    ssw = rr.get("seasonSeriesWins") or {}
    if gt == 3:
        hw, aw = ssw.get("homeTeamWins"), ssw.get("awayTeamWins")
        need = ssw.get("neededToWin")
        clinched = None
        if need is not None:
            if aw is not None and aw >= need:
                clinched = away_abbr
            elif hw is not None and hw >= need:
                clinched = home_abbr
        series = SeriesContext(
            is_playoffs=True, round_label=_round_label(gt, str(game_id)),
            game_number=int(str(game_id)[-2:]) % 10 if str(game_id)[-2:].isdigit() else None,
            home_wins=hw, away_wins=aw, needed_to_win=need, clinched_by=clinched,
        )

    return Game(
        id=str(game_id), league="NHL", date=_n(landing.get("gameDate")) or landing.get("gameDate", ""),
        start_utc=landing.get("startTimeUTC"),
        status=landing.get("gameState", "FINAL"),
        venue=_n(landing.get("venue")),
        home=team_ref(home), away=team_ref(away),
        scoring=scoring, penalties=penalties, goalies=goalies,
        top_skaters=top_skaters, three_stars=stars,
        team_stats=team_stats, series=series,
        has_video=False,  # NHL adapter has no verified clip source wired yet — no fake video.
    )


async def latest_game() -> Game:
    async with httpx.AsyncClient(headers={"User-Agent": "TheTicker/1.0"}) as client:
        gid = await find_latest_final(client)
        return await fetch_game(client, gid)


async def game_by_id(game_id: str) -> Game:
    if game_id in ("latest", "now"):
        return await latest_game()
    async with httpx.AsyncClient(headers={"User-Agent": "TheTicker/1.0"}) as client:
        return await fetch_game(client, game_id)


# ---------------------------------------------------------------------------
# Scoreboard (today's slate) — used by the Home screen.
# ---------------------------------------------------------------------------

def _state_group(state: str) -> str:
    if state in ("LIVE", "CRIT"):
        return "live"
    if state in FINAL_STATES:
        return "final"
    return "upcoming"


def _score_team(t: dict) -> dict:
    return {
        "abbr": _n(t.get("abbrev")),
        "name": _n(t.get("name")),
        "logo": t.get("logo"),
        "score": t.get("score"),
        "record": t.get("record"),
    }


async def scoreboard(client: httpx.AsyncClient) -> dict:
    """Return the current-day NHL slate simplified for the Home screen.

    NHL's `score/now` rolls forward to the next day that actually has games, so
    in the offseason `currentDate` can be a FUTURE date. We compare it against the
    real system date and flag `is_future` so the UI can label it honestly (NEXT UP)
    rather than silently presenting a future slate as "tonight".
    """
    now = await _get(client, "score/now")
    sb_date = now.get("currentDate")
    today = date.today().isoformat()
    games = []
    for g in now.get("games", []):
        pd = g.get("periodDescriptor") or {}
        clock = g.get("clock") or {}
        state = g.get("gameState", "")
        games.append({
            "id": str(g.get("id")),
            "state": state,
            "group": _state_group(state),
            "start_utc": g.get("startTimeUTC"),
            "game_type": g.get("gameType"),
            "period": pd.get("number"),
            "period_type": pd.get("periodType"),
            "clock": clock.get("timeRemaining"),
            "in_intermission": clock.get("inIntermission"),
            "away": _score_team(g.get("awayTeam", {})),
            "home": _score_team(g.get("homeTeam", {})),
        })
    return {"date": sb_date, "today": today, "is_future": bool(sb_date and sb_date != today), "games": games}


async def scoreboard_now() -> dict:
    async with httpx.AsyncClient(headers={"User-Agent": "TheTicker/1.0"}) as client:
        return await scoreboard(client)


# ---------------------------------------------------------------------------
# Standings — used by the Scores screen.
# ---------------------------------------------------------------------------

async def standings(client: httpx.AsyncClient) -> dict:
    st = await _get(client, "standings/now")
    east: list[dict] = []
    west: list[dict] = []
    for r in st.get("standings", []):
        conf = r.get("conferenceName") or ""
        row = {
            "abbr": _n(r.get("teamAbbrev")),
            "name": _n(r.get("teamName")),
            "short": _n(r.get("teamCommonName")),
            "logo": r.get("teamLogo"),
            "conference": conf,
            "division": r.get("divisionName"),
            "gp": r.get("gamesPlayed"),
            "wins": r.get("wins"),
            "losses": r.get("losses"),
            "ot": r.get("otLosses"),
            "points": r.get("points"),
            "gf": r.get("goalFor"),
            "ga": r.get("goalAgainst"),
            "streak": f"{r.get('streakCode', '') or ''}{r.get('streakCount', '') or ''}",
            "conf_rank": r.get("conferenceSequence"),
        }
        (east if conf == "Eastern" else west).append(row)
    east.sort(key=lambda x: x["conf_rank"] or 999)
    west.sort(key=lambda x: x["conf_rank"] or 999)
    return {"Eastern": east, "Western": west}


async def standings_now() -> dict:
    async with httpx.AsyncClient(headers={"User-Agent": "TheTicker/1.0"}) as client:
        return await standings(client)


# ---------------------------------------------------------------------------
# Recent finals — used by the Recap screen.
# ---------------------------------------------------------------------------

async def recent_finals(client: httpx.AsyncClient, limit: int = 15) -> list[dict]:
    """Walk backward from the real 'today' collecting completed games.

    Uses each day's `prevDate` pointer so offseason gaps are skipped in a single
    hop (e.g. Sep 9 -> last Stanley Cup Final day). Real data only.
    """
    cursor = date.today().isoformat()
    out: list[dict] = []
    guard = 0
    while cursor and len(out) < limit and guard < 40:
        guard += 1
        try:
            s = await _get(client, f"score/{cursor}")
        except Exception:
            break
        day = s.get("currentDate") or cursor
        for g in s.get("games", []):
            if g.get("gameState") in FINAL_STATES:
                po = (g.get("gameOutcome") or {}).get("lastPeriodType")
                out.append({
                    "id": str(g.get("id")),
                    "state": "OFF",
                    "group": "final",
                    "date": day,
                    "game_type": g.get("gameType"),
                    "period_type": po,
                    "away": _score_team(g.get("awayTeam", {})),
                    "home": _score_team(g.get("homeTeam", {})),
                })
        cursor = s.get("prevDate")
    return out[:limit]


async def recent_finals_now(limit: int = 15) -> list[dict]:
    async with httpx.AsyncClient(headers={"User-Agent": "TheTicker/1.0"}) as client:
        return await recent_finals(client, limit)


# ---------------------------------------------------------------------------
# Team Page — verified team snapshot.
# ---------------------------------------------------------------------------

def _sched_card(g: dict) -> dict:
    return {
        "id": str(g.get("id")),
        "date": g.get("gameDate"),
        "start_utc": g.get("startTimeUTC"),
        "state": g.get("gameState"),
        "away": _score_team(g.get("awayTeam", {})),
        "home": _score_team(g.get("homeTeam", {})),
    }


async def team_page(tri: str) -> dict:
    tri = tri.upper()
    async with httpx.AsyncClient(headers={"User-Agent": "TheTicker/1.0"}) as client:
        standings_data, cs, sched, roster = await asyncio.gather(
            _get(client, "standings/now"),
            _get(client, f"club-stats/{tri}/now"),
            _get(client, f"club-schedule-season/{tri}/now"),
            _get(client, f"roster/{tri}/current"),
        )

    row = next((r for r in standings_data.get("standings", [])
                if _n(r.get("teamAbbrev")) == tri), None)
    if not row:
        raise ValueError(f"Unknown team {tri}")

    team = {
        "abbr": tri,
        "name": _n(row.get("teamName")),
        "short": _n(row.get("teamCommonName")),
        "logo": row.get("teamLogo"),
        "conference": row.get("conferenceName"),
        "division": row.get("divisionName"),
    }
    record = {
        "wins": row.get("wins"), "losses": row.get("losses"), "ot": row.get("otLosses"),
        "points": row.get("points"), "gp": row.get("gamesPlayed"),
        "div_rank": row.get("divisionSequence"), "conf_rank": row.get("conferenceSequence"),
        "point_pct": row.get("pointPctg"),
    }
    goals = {"gf": row.get("goalFor"), "ga": row.get("goalAgainst"), "diff": row.get("goalDifferential")}
    form = {
        "l10": f"{row.get('l10Wins', 0)}-{row.get('l10Losses', 0)}-{row.get('l10OtLosses', 0)}",
        "streak": f"{row.get('streakCode', '') or ''}{row.get('streakCount', '') or ''}",
        "home": f"{row.get('homeWins', 0)}-{row.get('homeLosses', 0)}-{row.get('homeOtLosses', 0)}",
        "road": f"{row.get('roadWins', 0)}-{row.get('roadLosses', 0)}-{row.get('roadOtLosses', 0)}",
    }

    skaters = sorted(cs.get("skaters", []), key=lambda s: (s.get("points") or 0, s.get("goals") or 0), reverse=True)
    scorers = [{
        "player_id": s.get("playerId"),
        "name": f"{_n(s.get('firstName'))} {_n(s.get('lastName'))}".strip(),
        "pos": s.get("positionCode"), "gp": s.get("gamesPlayed"),
        "goals": s.get("goals"), "assists": s.get("assists"), "points": s.get("points"),
    } for s in skaters[:5]]

    goalies = sorted(cs.get("goalies", []), key=lambda g: (g.get("wins") or 0), reverse=True)
    goalie = None
    if goalies:
        g0 = goalies[0]
        goalie = {
            "player_id": g0.get("playerId"),
            "name": f"{_n(g0.get('firstName'))} {_n(g0.get('lastName'))}".strip(),
            "record": f"{g0.get('wins', 0)}-{g0.get('losses', 0)}-{g0.get('overtimeLosses', 0)}",
            "gaa": round(g0.get("goalsAgainstAverage"), 2) if g0.get("goalsAgainstAverage") is not None else None,
            "svpct": round(g0.get("savePercentage"), 3) if g0.get("savePercentage") is not None else None,
            "so": g0.get("shutouts"),
        }

    games = sched.get("games", [])
    finals = [g for g in games if g.get("gameState") in FINAL_STATES]
    upcoming = [g for g in games if g.get("gameState") not in FINAL_STATES and g.get("gameState") not in ("LIVE", "CRIT")]
    recent = [_sched_card(g) for g in finals[-5:]][::-1]
    nxt = _sched_card(upcoming[0]) if upcoming else None

    def _people(group):
        return [{
            "player_id": p.get("id"),
            "name": f"{_n(p.get('firstName'))} {_n(p.get('lastName'))}".strip(),
            "number": p.get("sweaterNumber"), "pos": p.get("positionCode"),
        } for p in roster.get(group, [])]

    return {
        "team": team, "record": record, "goals": goals, "form": form,
        "scorers": scorers, "goalie": goalie,
        "recent": recent, "next": nxt,
        "roster": {"forwards": _people("forwards"), "defensemen": _people("defensemen"), "goalies": _people("goalies")},
    }


# ---------------------------------------------------------------------------
# Player Page — verified player snapshot.
# ---------------------------------------------------------------------------

def _height(inches):
    if not inches:
        return None
    return f"{inches // 12}'{inches % 12}\""


async def player_page(pid: str) -> dict:
    async with httpx.AsyncClient(headers={"User-Agent": "TheTicker/1.0"}) as client:
        p = await _get(client, f"player/{pid}/landing")
        team_abbr = _n(p.get("currentTeamAbbrev"))
        nxt = None
        if team_abbr:
            try:
                sched = await _get(client, f"club-schedule-season/{team_abbr}/now")
                upcoming = [g for g in sched.get("games", [])
                            if g.get("gameState") not in FINAL_STATES
                            and g.get("gameState") not in ("LIVE", "CRIT")]
                if upcoming:
                    nxt = _sched_card(upcoming[0])
            except Exception:
                nxt = None

    is_goalie = p.get("position") == "G"
    fs = (p.get("featuredStats", {}).get("regularSeason", {}) or {}).get("subSeason", {}) or {}

    player = {
        "id": str(p.get("playerId")),
        "name": f"{_n(p.get('firstName'))} {_n(p.get('lastName'))}".strip(),
        "pos": p.get("position"),
        "is_goalie": is_goalie,
        "number": p.get("sweaterNumber"),
        "team_abbr": team_abbr,
        "team_id": p.get("currentTeamId"),
        "team_name": _n(p.get("fullTeamName")),
        "team_logo": p.get("teamLogo"),
        "headshot": p.get("headshot"),
        "height": _height(p.get("heightInInches")),
        "weight": p.get("weightInPounds"),
        "birth_date": p.get("birthDate"),
        "birth_city": _n(p.get("birthCity")),
        "birth_country": p.get("birthCountry"),
        "shoots": p.get("shootsCatches"),
    }

    skater = None
    goalie = None
    if is_goalie:
        goalie = {
            "gp": fs.get("gamesPlayed"), "wins": fs.get("wins"), "losses": fs.get("losses"),
            "ot": fs.get("otLosses"),
            "gaa": round(fs["goalsAgainstAvg"], 2) if fs.get("goalsAgainstAvg") is not None else None,
            "svpct": round(fs["savePctg"], 3) if fs.get("savePctg") is not None else None,
            "shutouts": fs.get("shutouts"),
        }
    else:
        skater = {
            "gp": fs.get("gamesPlayed"), "goals": fs.get("goals"), "assists": fs.get("assists"),
            "points": fs.get("points"), "plus_minus": fs.get("plusMinus"), "pim": fs.get("pim"),
            "shots": fs.get("shots"),
            "shooting_pct": round(fs["shootingPctg"] * 100, 1) if fs.get("shootingPctg") is not None else None,
            "pp_goals": fs.get("powerPlayGoals"), "pp_points": fs.get("powerPlayPoints"),
        }

    last5 = []
    for g in p.get("last5Games", []):
        row = {"game_id": str(g.get("gameId")), "date": g.get("gameDate"),
               "opp": _n(g.get("opponentAbbrev")), "home_road": g.get("homeRoadFlag"), "toi": g.get("toi")}
        if is_goalie:
            row.update({"decision": g.get("decision"), "shots_against": g.get("shotsAgainst"),
                        "goals_against": g.get("goalsAgainst"),
                        "svpct": round(g["savePctg"], 3) if g.get("savePctg") is not None else None})
        else:
            row.update({"goals": g.get("goals"), "assists": g.get("assists"), "points": g.get("points")})
        last5.append(row)

    return {"player": player, "skater": skater, "goalie": goalie, "last5": last5, "next": nxt}


# ---------------------------------------------------------------------------
# LEAGUE LEADERS — verified NHL skater/goalie stat leaders (consumer Stats).
# ---------------------------------------------------------------------------

def _abbr(v):
    if isinstance(v, dict):
        return v.get("default") or ""
    return v or ""


def _leader_row(x: dict) -> dict:
    return {
        "id": str(x.get("id")),
        "name": f"{_n(x.get('firstName'))} {_n(x.get('lastName'))}".strip(),
        "team_abbr": _abbr(x.get("teamAbbrev")),
        "pos": x.get("position"),
        "value": x.get("value"),
        "headshot": x.get("headshot"),
    }


async def leaders_now(limit: int = 8) -> dict:
    out = {"skaters": {}, "goalies": {}}
    async with httpx.AsyncClient(headers={"User-Agent": "TheTicker/1.0"}, follow_redirects=True, timeout=25) as client:
        for cat in ("points", "goals", "assists"):
            try:
                r = await client.get(f"{BASE}/skater-stats-leaders/current", params={"categories": cat, "limit": limit})
                out["skaters"][cat] = [_leader_row(x) for x in (r.json().get(cat) or [])]
            except Exception:
                out["skaters"][cat] = []
        gmap = {"wins": "wins", "gaa": "goalsAgainstAverage", "svpct": "savePctg"}
        for key, cat in gmap.items():
            try:
                r = await client.get(f"{BASE}/goalie-stats-leaders/current", params={"categories": cat, "limit": limit})
                rows = []
                for x in (r.json().get(cat) or []):
                    row = _leader_row(x)
                    v = row.get("value")
                    if isinstance(v, (int, float)):
                        row["value"] = round(v, 2) if key != "wins" else int(v)
                    rows.append(row)
                out["goalies"][key] = rows
            except Exception:
                out["goalies"][key] = []
    return out



# ---------------------------------------------------------------------------
# Provider adapter — the NHL implementation of the universal HockeyProvider.
# Delegates to the verified async functions above; the registry exposes it to
# the API layer so every screen reads NHL through the same contract a future
# league will implement.
# ---------------------------------------------------------------------------
from providers.base import HockeyProvider  # noqa: E402


class NHLProvider(HockeyProvider):
    code = "nhl"
    name = "National Hockey League"
    capabilities = {
        "standings": True,
        "leaders": True,
        "recaps": True,
        "schedule": True,
        "team_page": True,
        "player_page": True,
        "media": False,  # no verified NHL video source wired yet — REELS stays gated.
    }

    async def latest_game(self):
        return await latest_game()

    async def game_by_id(self, game_id: str):
        return await game_by_id(game_id)

    async def recent_finals_now(self, limit: int = 15):
        return await recent_finals_now(limit)

    async def scoreboard_now(self):
        return await scoreboard_now()

    async def standings_now(self):
        return await standings_now()

    async def leaders_now(self, limit: int = 8):
        return await leaders_now(limit)

    async def team_page(self, tri: str):
        return await team_page(tri)

    async def player_page(self, pid: str):
        return await player_page(pid)
