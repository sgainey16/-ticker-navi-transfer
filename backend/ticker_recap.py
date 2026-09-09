"""Recap engine: canonical Game -> deterministic fact sheet -> Reggie+Marc script.

The fact sheet is built in code from verified provider data (no AI). The LLM only
writes the hosts' dialogue grounded strictly in that fact sheet.
"""
from __future__ import annotations
import json
import logging

from emergentintegrations.llm.chat import LlmChat, UserMessage

from models.hockey import Game
from ticker_hosts import HOST_BIBLE

logger = logging.getLogger("ticker.recap")


def build_fact_sheet(g: Game) -> str:
    """Deterministic, verified facts — the only ground truth the hosts may use."""
    lines: list[str] = []
    header = f"{g.away.name} ({g.away.abbr}) {g.away.score} at {g.home.name} ({g.home.abbr}) {g.home.score} — {g.status}"
    lines.append(header)
    if g.date:
        lines.append(f"Date: {g.date}. Venue: {g.venue or 'n/a'}.")
    if g.series and g.series.is_playoffs:
        s = g.series
        rl = s.round_label or "Playoffs"
        seg = f"{rl}"
        if s.game_number:
            seg += f", Game {s.game_number}"
        lines.append(seg + ".")
        if s.away_wins is not None and s.home_wins is not None:
            lines.append(f"Series: {g.away.abbr} {s.away_wins}, {g.home.abbr} {s.home_wins} (best-of-{ (s.needed_to_win or 4)*2-1 }).")
        if s.clinched_by:
            lines.append(f"SERIES CLINCHED by {s.clinched_by} with this game.")

    winner = g.home.abbr if (g.home.score or 0) > (g.away.score or 0) else g.away.abbr
    lines.append(f"Winner: {winner}.")

    if g.scoring:
        lines.append("Goals (in order):")
        for p in g.scoring:
            tag = {"pp": " (power play)", "sh": " (shorthanded)", "en": " (empty net)"}.get(p.strength, "")
            a = f" assists: {', '.join(p.assists)}" if p.assists else " (unassisted)"
            lines.append(f"  P{p.period} {p.time} — {p.team_abbr}: {p.scorer}{tag}.{a}")

    for gl in g.goalies:
        so = " SHUTOUT." if gl.shutout else ""
        dec = f" ({gl.decision})" if gl.decision else ""
        lines.append(f"Goalie {gl.name} ({gl.team_abbr}): {gl.saves}/{gl.shots_against} saves, {gl.goals_against} GA{dec}.{so}")

    if g.three_stars:
        stars = "; ".join(f"{s.star}. {s.name} ({s.team_abbr}){(' — ' + s.note) if s.note else ''}" for s in g.three_stars)
        lines.append(f"Three stars: {stars}.")

    sog = g.team_stats.get("sog")
    if sog:
        lines.append(f"Shots on goal: {g.away.abbr} {sog.get('away')}, {g.home.abbr} {sog.get('home')}.")

    return "\n".join(lines)


PROMPT = """Write a SHORT broadcast recap of this completed hockey game as a back-and-forth
between Reggie and Marc.

The recap must answer, woven naturally (not as headings):
1) What happened?  2) Why did it matter?  3) Who mattered (use names)?
4) What should I remember?  5) What happens next?

Length: 6 to 8 total lines, alternating hosts, Reggie opens. People first, numbers support.

HARD RULES:
- People first, numbers support. Use names.
- GROUNDING: use ONLY the facts in the sheet above. Do NOT add ages, biographies, injury/trade
  history, career milestones, hometowns, standings or any context that is not explicitly present.
  If a detail is not in the sheet, omit it. Never guess a number.
- Keep it TV-paced; each line 1-2 sentences.

Return STRICT JSON only, no prose around it:
{"beats":[{"host":"reggie","text":"..."},{"host":"marc","text":"..."}]}

VERIFIED FACTS (the only truth you may use):
---
%s
---"""


def _fallback(g: Game) -> list[dict]:
    w = g.home if (g.home.score or 0) > (g.away.score or 0) else g.away
    l = g.away if w is g.home else g.home
    first = g.scoring[0].scorer if g.scoring else "the opener"
    so = next((gl for gl in g.goalies if gl.shutout), None)
    beats = [
        {"host": "reggie", "text": f"{w.name} take it {max(g.home.score or 0, g.away.score or 0)}-{min(g.home.score or 0, g.away.score or 0)} over {l.name} — and {first} got them rolling."},
        {"host": "marc", "text": "Control the middle, limit the looks, cash your chances. That's the blueprint and they followed it."},
    ]
    if so:
        beats.append({"host": "reggie", "text": f"And {so.name}? {so.saves} saves, nothing gets by. That's a night you frame."})
    beats.append({"host": "marc", "text": "The names change but the story doesn't: goaltending and discipline win games like this."})
    return beats


async def build_recap(g: Game, llm_key: str) -> list[dict]:
    facts = build_fact_sheet(g)
    if not llm_key:
        return _fallback(g)
    chat = LlmChat(
        api_key=llm_key,
        session_id=f"recap-{g.id}",
        system_message=HOST_BIBLE,
    ).with_model("anthropic", "claude-sonnet-4-6")
    try:
        reply = await chat.send_message(UserMessage(text=PROMPT % facts))
        raw = reply if isinstance(reply, str) else str(reply)
        start, end = raw.find("{"), raw.rfind("}")
        data = json.loads(raw[start:end + 1])
        beats = [
            {"host": ("reggie" if b.get("host", "").lower().startswith("reg") else "marc"),
             "text": (b.get("text") or "").strip()}
            for b in data.get("beats", []) if (b.get("text") or "").strip()
        ]
        return beats or _fallback(g)
    except Exception as e:
        logger.exception("recap LLM failed: %s", e)
        return _fallback(g)


# ---------------------------------------------------------------------------
# NEXT — league-level upcoming-slate PREVIEW segment (SHOW layer).
# Grounded strictly on the verified slate (team names, records, count, date).
# ---------------------------------------------------------------------------

def build_preview_fact_sheet(slate: dict) -> str:
    games = slate.get("games", []) or []
    lines: list[str] = []
    if slate.get("is_future"):
        lines.append(f"There are NO NHL games today ({slate.get('today')}).")
        lines.append(f"The NEXT scheduled slate is {slate.get('date')}.")
    else:
        lines.append(f"NHL slate for {slate.get('date')}.")
    lines.append(f"Games on that slate: {len(games)}.")
    for g in games:
        a = g.get("away", {}) or {}
        h = g.get("home", {}) or {}
        ar = f" ({a.get('record')})" if a.get("record") else ""
        hr = f" ({h.get('record')})" if h.get("record") else ""
        lines.append(f"  {a.get('name') or a.get('abbr')}{ar} at {h.get('name') or h.get('abbr')}{hr}")
    return "\n".join(lines)


PREVIEW_PROMPT = """Write a SHORT on-air PREVIEW open for THE TICKER: Reggie and Marc setting up
the UPCOMING hockey (not a game that already happened).

The open should answer, woven naturally (not as headings):
1) Is there hockey today, and if not, what's next?  2) What's the shape of the coming slate?
3) One or two matchups worth pointing at (use team names).

Length: 4 to 6 total lines, alternating hosts, Reggie opens. Energetic but honest.

HARD RULES:
- Use ONLY the facts in the sheet above. Do NOT invent scores, records, standings, storylines,
  injuries, trades, start times, or which team is favoured. If it's not in the sheet, omit it.
- If there are no games today, say so plainly and pivot to what's coming — do not fake urgency.
- People/teams first. Keep it TV-paced; each line 1-2 sentences.

Return STRICT JSON only, no prose around it:
{"beats":[{"host":"reggie","text":"..."},{"host":"marc","text":"..."}]}

VERIFIED FACTS (the only truth you may use):
---
%s
---"""


def _preview_fallback(slate: dict) -> list[dict]:
    games = slate.get("games", []) or []
    n = len(games)
    first = games[0] if games else None
    matchup = ""
    if first:
        a = (first.get("away") or {}).get("abbr")
        h = (first.get("home") or {}).get("abbr")
        matchup = f"{a} and {h}"
    if slate.get("is_future"):
        beats = [
            {"host": "reggie", "text": f"No NHL on the board today — but don't go anywhere, the next slate is already loading."},
            {"host": "marc", "text": f"{n} games when the puck drops next" + (f", starting with {matchup}." if matchup else ".")},
        ]
    else:
        beats = [
            {"host": "reggie", "text": f"We've got {n} on the ice — let's get you ready."},
            {"host": "marc", "text": (f"Circle {matchup} on that list." if matchup else "Plenty to watch across the league.")},
        ]
    return beats


async def build_next_preview(slate: dict, llm_key: str) -> list[dict]:
    facts = build_preview_fact_sheet(slate)
    if not llm_key:
        return _preview_fallback(slate)
    chat = LlmChat(
        api_key=llm_key,
        session_id=f"preview-{slate.get('date')}",
        system_message=HOST_BIBLE,
    ).with_model("anthropic", "claude-sonnet-4-6")
    try:
        reply = await chat.send_message(UserMessage(text=PREVIEW_PROMPT % facts))
        raw = reply if isinstance(reply, str) else str(reply)
        start, end = raw.find("{"), raw.rfind("}")
        data = json.loads(raw[start:end + 1])
        beats = [
            {"host": ("reggie" if b.get("host", "").lower().startswith("reg") else "marc"),
             "text": (b.get("text") or "").strip()}
            for b in data.get("beats", []) if (b.get("text") or "").strip()
        ]
        return beats or _preview_fallback(slate)
    except Exception as e:
        logger.exception("preview LLM failed: %s", e)
        return _preview_fallback(slate)
