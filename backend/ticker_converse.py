"""Live Reggie + Marc conversation — the fan JOINS the desk (Team-page proof).

One shared conversation context: FAN + REGGIE + MARC. Both hosts participate in a
single back-and-forth. Everything is grounded ONLY in the verified team_page facts,
and every suggestion the hosts make must reference a whitelisted LINKABLE entity so it
always resolves to a real navigation or Follow — never a fabricated player/team/game.
"""
from __future__ import annotations
import json
import logging
import re

from emergentintegrations.llm.chat import LlmChat, UserMessage
from ticker_hosts import HOST_BIBLE

logger = logging.getLogger("ticker.converse")

# "Yes, keep an eye on him" style affirmations that turn a pending follow OFFER
# into a real Follow action.
AFFIRM = re.compile(
    r"\b(yes|yeah|yep|yup|sure|ok|okay|please|do it|go ahead|sounds good|for sure|"
    r"absolutely|definitely|let'?s do it|keep an eye|follow him|follow her|follow them|add him|add her)\b",
    re.I,
)


def build_team_context(tp: dict, league_name: str, league_code: str) -> tuple[str, list[dict]]:
    """Return (verified fact sheet, whitelist of linkable entities).

    Each linkable item has: ref (short token the LLM cites), kind, label, and a
    fully-resolved `entity` payload the frontend uses to navigate or Follow.
    """
    team = tp.get("team", {}) or {}
    rec = tp.get("record", {}) or {}
    goals = tp.get("goals", {}) or {}
    form = tp.get("form", {}) or {}
    abbr = team.get("abbr")

    lines: list[str] = [f"TEAM: {team.get('name')} ({abbr}) — {league_name}."]
    if team.get("division") or team.get("conference"):
        lines.append(
            f"Standing: #{rec.get('div_rank')} in {team.get('division')} division, "
            f"#{rec.get('conf_rank')} in the {team.get('conference')} conference."
        )
    lines.append(
        f"Record: {rec.get('wins')}-{rec.get('losses')}-{rec.get('ot')}, "
        f"{rec.get('points')} pts" + (f" in {rec.get('gp')} GP." if rec.get('gp') else ".")
    )
    if goals.get("gf") is not None:
        lines.append(f"Goals: {goals.get('gf')} for / {goals.get('ga')} against (diff {goals.get('diff')}).")
    if form.get("l10") and form.get("l10") != "–":
        lines.append(f"Form: {form.get('l10')} in last 10, streak {form.get('streak')}, home {form.get('home')}, road {form.get('road')}.")

    links: list[dict] = []

    def add(ref, kind, label, entity):
        links.append({"ref": ref, "kind": kind, "label": label, "entity": entity})

    # The team itself is always followable.
    add(f"FT:{abbr}", "follow_team", f"Follow {team.get('short') or team.get('name')}",
        {"abbr": abbr, "name": team.get("name"), "league": league_code, "logo": team.get("logo")})

    scorers = tp.get("scorers") or []
    if scorers:
        lines.append("Top scorers: " + "; ".join(
            f"{s.get('name')} ({s.get('pos')}) {s.get('points')} pts, {s.get('goals')}G {s.get('assists')}A"
            for s in scorers))
        for s in scorers:
            if s.get("player_id"):
                ent = {"player_id": str(s["player_id"]), "name": s["name"],
                       "team_abbr": abbr, "pos": s.get("pos"), "league": league_code}
                add(f"P:{s['player_id']}", "player", f"{s['name']} (open profile)", ent)
                add(f"FP:{s['player_id']}", "follow_player", f"Keep an eye on {s['name']}", ent)

    goalie = tp.get("goalie")
    if goalie and goalie.get("player_id"):
        lines.append(f"Goalie: {goalie['name']} — {goalie.get('record')}, {goalie.get('svpct')} SV%, {goalie.get('gaa')} GAA.")
        gent = {"player_id": str(goalie["player_id"]), "name": goalie["name"],
                "team_abbr": abbr, "pos": "G", "league": league_code}
        add(f"P:{goalie['player_id']}", "player", f"{goalie['name']} (open profile)", gent)
        add(f"FP:{goalie['player_id']}", "follow_player", f"Keep an eye on {goalie['name']}", gent)

    nxt = tp.get("next")
    if nxt:
        home, away = nxt.get("home", {}), nxt.get("away", {})
        opp = home if home.get("abbr") != abbr else away
        lines.append(f"Next game: {away.get('abbr')} @ {home.get('abbr')} on {nxt.get('date')}.")
        add(f"G:{nxt['id']}", "game", f"Next game vs {opp.get('abbr')}", {"id": str(nxt["id"]), "league": league_code})
        if opp.get("abbr"):
            add(f"T:{opp['abbr']}", "team", opp["abbr"], {"abbr": opp["abbr"], "league": league_code})

    recent = tp.get("recent") or []
    if recent:
        rl = []
        for g in recent[:5]:
            a, h = g.get("away", {}), g.get("home", {})
            rl.append(f"{a.get('abbr')} {a.get('score')} @ {h.get('abbr')} {h.get('score')} ({g.get('date')})")
            add(f"G:{g['id']}", "game", f"{a.get('abbr')} @ {h.get('abbr')}", {"id": str(g["id"]), "league": league_code})
        lines.append("Recent results: " + "; ".join(rl))

    roster = tp.get("roster")
    if roster:
        names = []
        for grp in ("forwards", "defensemen", "goalies"):
            for p in (roster.get(grp) or []):
                if p.get("player_id"):
                    add(f"P:{p['player_id']}", "player", p["name"],
                        {"player_id": str(p["player_id"]), "name": p["name"],
                         "team_abbr": abbr, "pos": p.get("pos"), "league": league_code})
                    names.append(p["name"])
        if names:
            lines.append(f"Roster ({len(names)}): " + ", ".join(names[:26]) + ("…" if len(names) > 26 else ""))

    return "\n".join(lines), links


CONVO_SYS = HOST_BIBLE + """

You are LIVE with a fan looking at this team's page. This is a real conversation between
THREE people: the FAN, REGGIE and MARC. Both of you are on the desk together.

STYLE:
- Reggie usually leads; Marc adds context, memory, or good-naturedly pushes back. Real chemistry.
- SHORT. 2 to 4 total lines. Talk-radio pace — never a monologue, never a wall of text.
- Actually answer what the fan said. Be a hockey friend, not a search box.
- PEOPLE FIRST: move toward players, storylines and connections when it's natural.
- You do NOT have to end on a question. Do not interrogate the fan.

WEBBING (do this when it's genuinely interesting, not every time):
- Point the fan somewhere real next — a player on this team, the opponent, the next/last game,
  or offer to keep an eye on (Follow) a player or the team.
- You may ONLY reference items in the LINKABLE list below, quoting their exact ref token.
- NEVER invent a player, team, or game that isn't in the facts.

GROUNDING: use ONLY the TEAM CONTEXT facts. If the fan asks for something not in front of you,
say so plainly ("I don't have that one in front of me") — never guess a stat, trade, or story.

OUTPUT: return ONLY valid JSON (no markdown fences), exactly:
{"turns":[{"host":"reggie","text":"..."},{"host":"marc","text":"..."}],
 "suggestions":[{"ref":"<exact ref from LINKABLE>","label":"<short tappable label>"}]}
- 1 to 4 turns, hosts alternating naturally (both may appear).
- 0 to 3 suggestions; every ref MUST be copied exactly from LINKABLE. Omit if none fit.
"""


def _extract_json(text: str) -> dict | None:
    if not text:
        return None
    t = text.strip()
    if t.startswith("```"):
        t = t.strip("`")
        nl = t.find("{")
        if nl != -1:
            t = t[nl:]
    i, j = t.find("{"), t.rfind("}")
    if i == -1 or j == -1:
        return None
    try:
        return json.loads(t[i:j + 1])
    except Exception:
        return None


async def converse_turn(llm_key: str, conversation_id: str, fact_sheet: str,
                        links: list[dict], history: list[dict], user_text: str,
                        directive: bool = False) -> dict:
    linkable = "\n".join(f"  {l['ref']} = {l['label']} [{l['kind']}]" for l in links) or "  (none)"
    convo = ""
    for h in history[-6:]:
        who = "FAN" if h.get("role") == "user" else (h.get("host") or "desk").upper()
        convo += f"{who}: {h.get('text')}\n"

    if directive:
        cue = (f"SHOW DIRECTION (the fan has NOT spoken — this is the desk producer cueing you):\n{user_text}\n\n"
               f"Continue the live show as Reggie + Marc. Do NOT treat this as a fan question. "
               f"Keep it short and let it breathe toward a natural finish. JSON only.")
    else:
        cue = f"FAN JUST SAID: {user_text}\n\nReply now as Reggie + Marc. JSON only."

    prompt = (
        f"TEAM CONTEXT (verified — the ONLY facts you may use):\n{fact_sheet}\n\n"
        f"LINKABLE (only these may be cited in suggestions, by exact ref):\n{linkable}\n\n"
        f"CONVERSATION SO FAR:\n{convo or '(this is the start)'}\n"
        f"{cue}"
    )

    data = None
    try:
        chat = LlmChat(api_key=llm_key, session_id=f"convo-{conversation_id}",
                       system_message=CONVO_SYS).with_model("anthropic", "claude-sonnet-4-6")
        reply = await chat.send_message(UserMessage(text=prompt))
        data = _extract_json(reply)
    except Exception:
        logger.exception("converse llm failed")

    if not data or not isinstance(data.get("turns"), list) or not data["turns"]:
        return {"turns": [{"host": "reggie", "text": "Say that again for me? Line cut out for a second."}],
                "suggestions": []}

    turns = [{"host": ("marc" if t.get("host") == "marc" else "reggie"), "text": str(t.get("text", "")).strip()}
             for t in data["turns"] if str(t.get("text", "")).strip()][:4]

    by_ref = {l["ref"]: l for l in links}
    suggestions = []
    for s in (data.get("suggestions") or [])[:3]:
        l = by_ref.get(s.get("ref"))
        if l:
            suggestions.append({"kind": l["kind"], "label": s.get("label") or l["label"], "entity": l["entity"]})

    return {"turns": turns or [{"host": "reggie", "text": "Say that again for me?"}], "suggestions": suggestions}
