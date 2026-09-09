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
