from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import re
import json
import base64
import logging
import uuid
from pathlib import Path
from datetime import datetime, timezone
from pydantic import BaseModel, Field
from typing import List, Optional

from emergentintegrations.llm.chat import LlmChat, UserMessage
from elevenlabs.client import ElevenLabs
from elevenlabs import VoiceSettings

import masl_data as data

import asyncio
import hashlib
from providers import nhl
from providers.registry import get_provider, list_providers, search_all
from ticker_recap import build_recap, build_next_preview, build_recap_show, build_home_open, build_my_ticker
from ticker_hosts import host_voice

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')
ELEVENLABS_API_KEY = os.environ.get('ELEVENLABS_API_KEY', '')
eleven = ElevenLabs(api_key=ELEVENLABS_API_KEY) if ELEVENLABS_API_KEY else None
_tts_cache: dict = {}
TTS_CACHE_DIR = ROOT_DIR / ".tts_cache"
TTS_CACHE_DIR.mkdir(exist_ok=True)

app = FastAPI(title="MASL — Powered by Ticker")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("masl")


# ---------------------------------------------------------------------------
# Host system prompt (knowledge layer + character bibles)
# ---------------------------------------------------------------------------

HOST_SYSTEM_PROMPT = """You are the on-air booth for THE TICKER, a hockey studio show. There are TWO hosts and
you voice BOTH of them. They have worked together for years — real chemistry, not two
interchangeable narrators.

REGGIE BANKS — "The Instigator".
- Former NHL player. Fast, confident, charismatic, funny. Hockey-first.
- Leads with emotion, instinct and a player's perspective. Playful chirps — never cruel, never forced.
- Short, natural sentences. Energy first, then the point.

MARC COLLINS — "The Guardian".
- Veteran analyst. Calm, measured, deeply human, prepared, trustworthy.
- Uses evidence and context, dry humour. Respectful disagreement. Protects perspective.
- 1-2 sentences. Grounds Reggie with a specific, relevant point.

CHEMISTRY: they can disagree, react differently, make callbacks, and laugh. Marc challenges
Reggie without killing the energy.

HUMAN-FIRST RULE: PEOPLE FIRST, DATA SECOND. Talk about players, coaches, teams, moments,
streaks and context by NAME. Statistics support the story; they never dominate it.
Person -> Moment -> Number, never Number -> Number -> Number.

HARD GROUNDING RULES:
- This is HOCKEY. Never use soccer terminology.
- Do NOT invent scores, statistics, injuries, trades, milestones, roster moves or game events.
  If you don't have a verified fact, speak to it in character (e.g. "let me pull that up") rather
  than making a number up. Never state a specific stat you weren't given.
- ALWAYS answer as BOTH hosts. Respond with STRICT JSON ONLY, no markdown, no code fences:
  {"reggie": "<Reggie's line>", "marc": "<Marc's line>"}
"""


def build_system_prompt():
    return HOST_SYSTEM_PROMPT


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class TalkRequest(BaseModel):
    session_id: Optional[str] = None
    message: str


class TalkTurn(BaseModel):
    role: str
    text: str = ""
    rayo: str = ""
    casey: str = ""
    ts: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# ---------------------------------------------------------------------------
# Content endpoints (served from curated dataset)
# ---------------------------------------------------------------------------

@api_router.get("/")
async def root():
    return {"app": "MASL — Powered by Ticker", "season": "2025-26", "status": "ok"}


@api_router.get("/home")
async def get_home():
    return data.home_feed()


@api_router.get("/ticker")
async def get_ticker():
    return {"items": data.TICKER}


@api_router.get("/teams")
async def get_teams():
    return {"teams": data.TEAMS}


@api_router.get("/teams/{team_id}")
async def get_team(team_id: str):
    team = data.TEAMS_BY_ID.get(team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    roster = data.players_for_team(team_id)
    recaps = [g for g in data.GAMES if team_id in (g["home_id"], g["away_id"])]
    return {"team": team, "roster": roster, "recaps": recaps}


@api_router.get("/players/{player_id}")
async def get_player(player_id: str):
    player = data.PLAYERS_BY_ID.get(player_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    return {"player": player, "team": data.TEAMS_BY_ID.get(player["team_id"])}


@api_router.get("/standings")
async def get_standings():
    return data.standings()


@api_router.get("/leaders")
async def get_leaders():
    return data.LEADERS


@api_router.get("/availability")
async def get_availability():
    return {"report": data.AVAILABILITY}


@api_router.get("/games")
async def get_games():
    return {"games": data.GAMES}


@api_router.get("/games/{game_id}")
async def get_game(game_id: str):
    game = data.GAMES_BY_ID.get(game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    return {
        "game": game,
        "home": data.TEAMS_BY_ID.get(game["home_id"]),
        "away": data.TEAMS_BY_ID.get(game["away_id"]),
    }


@api_router.get("/coldopen")
async def get_cold_open():
    co = dict(data.COLD_OPEN)
    m = co["matchup"]
    co["home"] = data.TEAMS_BY_ID.get(m["home"])
    co["away"] = data.TEAMS_BY_ID.get(m["away"])
    return co


@api_router.get("/segments/{page}")
async def get_segment(page: str):
    beats = data.SEGMENTS.get(page)
    if beats is None:
        raise HTTPException(status_code=404, detail="Unknown segment")
    return {"page": page, "beats": beats}


@api_router.get("/stars")
async def get_stars():
    return {"stars": data.stars()}


# ---------------------------------------------------------------------------
# TALK — Rayo & Casey chat
# ---------------------------------------------------------------------------

def _parse_hosts(raw: str):
    """Extract {"rayo": .., "casey": ..} from an LLM reply as robustly as possible."""
    text = (raw or "").strip()
    text = re.sub(r"^```(?:json)?|```$", "", text, flags=re.MULTILINE).strip()
    try:
        obj = json.loads(text)
        return (str(obj.get("reggie", obj.get("rayo", ""))).strip(),
                str(obj.get("marc", obj.get("casey", ""))).strip())
    except Exception:
        pass
    match = re.search(r"\{.*\}", text, flags=re.DOTALL)
    if match:
        try:
            obj = json.loads(match.group(0))
            return (str(obj.get("reggie", obj.get("rayo", ""))).strip(),
                    str(obj.get("marc", obj.get("casey", ""))).strip())
        except Exception:
            pass
    # Last resort: whole thing is Rayo talking.
    return text, ""


@api_router.get("/talk/{session_id}")
async def get_talk_history(session_id: str):
    doc = await db.talk_sessions.find_one({"session_id": session_id})
    if not doc:
        return {"session_id": session_id, "turns": []}
    return {"session_id": session_id, "turns": doc.get("turns", [])}


@api_router.post("/talk")
async def talk(req: TalkRequest):
    session_id = req.session_id or str(uuid.uuid4())
    user_text = (req.message or "").strip()
    if not user_text:
        raise HTTPException(status_code=400, detail="Empty message")

    doc = await db.talk_sessions.find_one({"session_id": session_id})
    prior = doc.get("turns", []) if doc else []

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=build_system_prompt(),
    ).with_model("anthropic", "claude-sonnet-4-6")

    # Replay recent history so the booth keeps context across turns.
    for t in prior[-8:]:
        if t.get("role") == "user":
            try:
                await chat.send_message(UserMessage(text=t.get("text", "")))
            except Exception:
                pass

    try:
        reply = await chat.send_message(UserMessage(text=user_text))
    except Exception as e:
        logger.exception("LLM error")
        raise HTTPException(status_code=502, detail=f"Broadcast booth unavailable: {e}")

    rayo, casey = _parse_hosts(reply if isinstance(reply, str) else str(reply))

    user_turn = TalkTurn(role="user", text=user_text).model_dump()
    host_turn = TalkTurn(role="hosts", rayo=rayo, casey=casey).model_dump()

    await db.talk_sessions.update_one(
        {"session_id": session_id},
        {"$push": {"turns": {"$each": [user_turn, host_turn]}},
         "$setOnInsert": {"session_id": session_id,
                          "created_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )

    return {"session_id": session_id, "rayo": rayo, "casey": casey}


# ---------------------------------------------------------------------------
# VOICES — ElevenLabs Voice Design + TTS (Cold Open host voices)
# ---------------------------------------------------------------------------

class DesignRequest(BaseModel):
    host: str  # "rayo" | "casey"


class SelectRequest(BaseModel):
    host: str
    generated_voice_id: str


class TtsRequest(BaseModel):
    text: str
    voice_id: str
    speed: float | None = None


@api_router.get("/voices/briefs")
async def voices_briefs():
    return {k: {"name": v["name"], "description": v["description"], "sample": v["sample"]} for k, v in data.VOICE_BRIEFS.items()}


@api_router.post("/voices/design")
async def voices_design(req: DesignRequest):
    if not eleven:
        raise HTTPException(status_code=503, detail="Voice engine not configured")
    brief = data.VOICE_BRIEFS.get(req.host)
    if not brief:
        raise HTTPException(status_code=404, detail="Unknown host")
    try:
        res = eleven.text_to_voice.design(
            voice_description=brief["description"],
            text=brief["sample"],
            model_id="eleven_multilingual_ttv_v2",
        )
    except Exception as e:
        logger.exception("Voice design error")
        raise HTTPException(status_code=502, detail=f"Voice design failed: {getattr(e, 'body', str(e))}")
    previews = [
        {
            "generated_voice_id": p.generated_voice_id,
            "audio": f"data:audio/mpeg;base64,{p.audio_base_64}",
            "duration": getattr(p, "duration_secs", None),
        }
        for p in res.previews
    ]
    return {"host": req.host, "previews": previews}


@api_router.post("/voices/select")
async def voices_select(req: SelectRequest):
    if not eleven:
        raise HTTPException(status_code=503, detail="Voice engine not configured")
    brief = data.VOICE_BRIEFS.get(req.host)
    if not brief:
        raise HTTPException(status_code=404, detail="Unknown host")
    try:
        voice = eleven.text_to_voice.create(
            voice_name=f"{brief['name']} {req.generated_voice_id[:6]}",
            voice_description=brief["description"],
            generated_voice_id=req.generated_voice_id,
        )
    except Exception as e:
        logger.exception("Voice select error")
        raise HTTPException(status_code=502, detail=f"Voice save failed: {getattr(e, 'body', str(e))}")
    await db.settings.update_one({"_id": "voices"}, {"$set": {req.host: voice.voice_id}}, upsert=True)
    return {"host": req.host, "voice_id": voice.voice_id}


class SetVoiceRequest(BaseModel):
    host: str
    voice_id: str


@api_router.get("/voices/selected")
async def voices_selected():
    doc = await db.settings.find_one({"_id": "voices"}) or {}
    # Ticker hosts: Reggie -> energy slot ("rayo"), Marc -> analyst slot ("casey").
    reggie = host_voice("reggie") or doc.get("rayo")
    marc = host_voice("marc") or doc.get("casey")
    return {"rayo": reggie, "casey": marc, "reggie": reggie, "marc": marc}


@api_router.post("/voices/set")
async def voices_set(req: SetVoiceRequest):
    if req.host not in ("rayo", "casey"):
        raise HTTPException(status_code=400, detail="Unknown host")
    await db.settings.update_one({"_id": "voices"}, {"$set": {req.host: req.voice_id}}, upsert=True)
    return {"ok": True, "host": req.host, "voice_id": req.voice_id}


@api_router.post("/tts")
async def tts(req: TtsRequest):
    if not eleven:
        raise HTTPException(status_code=503, detail="Voice engine not configured")
    text = (req.text or "").strip()
    if not text or not req.voice_id:
        raise HTTPException(status_code=400, detail="text and voice_id required")
    speed = req.speed if req.speed else 1.0
    speed = max(0.7, min(1.2, speed))
    key = hashlib.md5(f"{req.voice_id}:{speed}:{text}".encode()).hexdigest()
    if key in _tts_cache:
        return {"audio": _tts_cache[key]}
    fpath = TTS_CACHE_DIR / f"{key}.mp3"
    if fpath.exists():
        uri = f"data:audio/mpeg;base64,{base64.b64encode(fpath.read_bytes()).decode()}"
        _tts_cache[key] = uri
        return {"audio": uri}

    def _convert() -> bytes:
        stream = eleven.text_to_speech.convert(
            text=text,
            voice_id=req.voice_id,
            model_id="eleven_multilingual_v2",
            voice_settings=VoiceSettings(speed=speed),
        )
        return b"".join(stream)

    try:
        # Run the blocking ElevenLabs SDK call OFF the event loop so it never
        # freezes other API requests (the Ticker-1 blocking-TTS lesson).
        audio_bytes = await asyncio.to_thread(_convert)
    except Exception as e:
        logger.exception("TTS error")
        raise HTTPException(status_code=502, detail=f"TTS failed: {getattr(e, 'body', str(e))}")
    try:
        fpath.write_bytes(audio_bytes)
    except Exception:
        pass
    uri = f"data:audio/mpeg;base64,{base64.b64encode(audio_bytes).decode()}"
    if len(_tts_cache) < 200:
        _tts_cache[key] = uri
    return {"audio": uri}


async def _recap_beats(game, refresh: bool = False):
    """Grounded Reggie+Marc beats for a canonical game, cached in Mongo."""
    doc = None if refresh else await db.recaps.find_one({"_id": game.id})
    if doc and doc.get("beats"):
        return doc["beats"]
    beats = await build_recap(game, EMERGENT_LLM_KEY)
    await db.recaps.update_one(
        {"_id": game.id},
        {"$set": {"beats": beats,
                  "created_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return beats


async def _next_segment_beats(slate: dict):
    """Prepared/cached NEXT preview beats, keyed by slate date + game count.

    Cached in Mongo so ordinary browsing/re-entry never re-hits the LLM.
    """
    key = f"next:{slate.get('league_name','NHL')}:{slate.get('date')}:{len(slate.get('games', []) or [])}"
    doc = await db.segments.find_one({"_id": key})
    if doc and doc.get("beats"):
        return doc["beats"]
    beats = await build_next_preview(slate, EMERGENT_LLM_KEY)
    await db.segments.update_one(
        {"_id": key},
        {"$set": {"beats": beats, "created_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return beats


class FollowItem(BaseModel):
    abbr: Optional[str] = None
    player_id: Optional[str] = None
    team_abbr: Optional[str] = None
    tier: Optional[int] = None


class HomeFollows(BaseModel):
    teams: List[FollowItem] = []
    players: List[FollowItem] = []


ROUND_LABEL = {1: "1ST ROUND (can't-miss)", 2: "2ND ROUND", 3: "3RD ROUND"}


def _round_key(x) -> int:
    return x.tier if x.tier in (1, 2, 3) else 9


def _card_line(c: dict) -> str:
    a = c.get("away", {}) or {}
    h = c.get("home", {}) or {}
    if a.get("score") is not None and h.get("score") is not None:
        return f"{a.get('abbr')} {a.get('score')}, {h.get('abbr')} {h.get('score')}"
    return f"{a.get('abbr')} @ {h.get('abbr')} ({c.get('date') or ''})"


async def _home_personal_facts(follows: HomeFollows) -> tuple[str, bool]:
    teams = sorted(follows.teams, key=_round_key)[:4]
    players = sorted(follows.players, key=_round_key)[:3]
    has = bool(teams or players)
    lines: list[str] = []
    if has:
        lines.append("The viewer's Draft Board (priority order):")
    for t in teams:
        if not t.abbr:
            continue
        try:
            d = await nhl.team_page(t.abbr)
            label = ROUND_LABEL.get(t.tier, "FOLLOWING")
            seg = f"{label}: {d['team']['name']} ({d['record']['wins']}-{d['record']['losses']}-{d['record']['ot']})"
            recent = d.get("recent") or []
            if recent:
                seg += f"; latest {_card_line(recent[0])}"
            nxt = d.get("next")
            if nxt:
                seg += f"; next {nxt.get('away', {}).get('abbr')} @ {nxt.get('home', {}).get('abbr')} on {nxt.get('date')}"
            lines.append(seg)
        except Exception:
            logger.exception("home facts team %s failed", t.abbr)
    for p in players:
        if not p.player_id:
            continue
        try:
            d = await nhl.player_page(p.player_id)
            pl = d["player"]
            label = ROUND_LABEL.get(p.tier, "FOLLOWING")
            seg = f"{label}: {pl['name']} ({pl.get('pos')}, {pl.get('team_abbr')})"
            sk = d.get("skater")
            gl = d.get("goalie")
            if sk and sk.get("points") is not None:
                seg += f"; season {sk.get('goals')}G {sk.get('assists')}A {sk.get('points')}P"
            elif gl and gl.get("svpct") is not None:
                seg += f"; season {gl.get('svpct')} SV%, {gl.get('gaa')} GAA"
            last5 = d.get("last5") or []
            if last5:
                g0 = last5[0]
                if "points" in g0:
                    seg += f"; last game vs {g0.get('opp')}: {g0.get('goals')}G {g0.get('assists')}A"
            lines.append(seg)
        except Exception:
            logger.exception("home facts player %s failed", p.player_id)
    try:
        slate = await nhl.scoreboard_now()
        g = slate.get("games", []) or []
        if slate.get("is_future"):
            lines.append(f"League: no NHL today ({slate.get('today')}); next slate {slate.get('date')} has {len(g)} games.")
        else:
            lines.append(f"League: {len(g)} games today ({slate.get('date')}).")
    except Exception:
        logger.exception("home facts slate failed")
    return "\n".join(lines), has


def _final_headline(a: dict, h: dict) -> tuple[str, dict, dict]:
    """People/result-led headline from a VERIFIED final score only. No fabrication."""
    asc, hsc = a.get("score"), h.get("score")
    win, lose = (a, h) if (asc or 0) >= (hsc or 0) else (h, a)
    ws, ls = (win.get("score") or 0), (lose.get("score") or 0)
    wn = win.get("name") or win.get("abbr")
    ln = lose.get("name") or lose.get("abbr")
    margin = ws - ls
    if ls == 0:
        verb = f"shut out {ln}"
    elif margin == 1:
        verb = f"edged {ln}"
    elif margin >= 4:
        verb = f"routed {ln}"
    else:
        verb = f"beat {ln}"
    return f"{wn} {verb}, {ws}\u2013{ls}", win, lose


async def _my_hockey_feed(follows: HomeFollows) -> dict:
    fteams = {t.abbr for t in follows.teams if t.abbr}
    fplayer_teams = {p.team_abbr for p in follows.players if p.team_abbr}
    followed_abbrs = fteams | fplayer_teams
    has = bool(follows.teams or follows.players)

    mine: list[dict] = []
    league: list[dict] = []

    # 1) followed players' latest verified game line (people-first). Bounded.
    players = sorted(follows.players, key=_round_key)[:4]
    for p in players:
        if not p.player_id:
            continue
        try:
            d = await nhl.player_page(p.player_id)
            pl = d["player"]
            last5 = d.get("last5") or []
            if not last5:
                continue
            g0 = last5[0]
            opp = g0.get("opp")
            if d.get("goalie"):
                sv = (g0.get("shots_against") or 0) - (g0.get("goals_against") or 0)
                headline = f"{pl['name']}: {sv}/{g0.get('shots_against')} saves vs {opp}"
            else:
                gg, aa = g0.get("goals") or 0, g0.get("assists") or 0
                if gg == 0 and aa == 0:
                    continue
                bits = []
                if gg: bits.append(f"{gg}G")
                if aa: bits.append(f"{aa}A")
                headline = f"{pl['name']}: {' '.join(bits)} vs {opp}"
            mine.append({
                "type": "player", "player_id": pl["id"], "game_id": g0.get("game_id"),
                "team_abbr": pl.get("team_abbr"), "team_logo": pl.get("team_logo"),
                "headshot": pl.get("headshot"), "headline": headline,
                "sub": f"{pl.get('pos')} \u00b7 {pl.get('team_abbr')}", "followed": True, "video": None,
            })
        except Exception:
            logger.exception("my_hockey player %s failed", p.player_id)

    # 2) recent finals -> result stories. Followed teams first.
    try:
        finals = await nhl.recent_finals_now(limit=14)
    except Exception:
        finals = []
    for c in finals:
        a, h = c.get("away", {}) or {}, c.get("home", {}) or {}
        if a.get("score") is None or h.get("score") is None:
            continue
        headline, _w, _l = _final_headline(a, h)
        item = {
            "type": "final", "game_id": c.get("id"), "headline": headline,
            "away": {"abbr": a.get("abbr"), "logo": a.get("logo"), "score": a.get("score")},
            "home": {"abbr": h.get("abbr"), "logo": h.get("logo"), "score": h.get("score")},
            "video": None,
        }
        if a.get("abbr") in followed_abbrs or h.get("abbr") in followed_abbrs:
            item["followed"] = True
            mine.append(item)
        else:
            item["followed"] = False
            league.append(item)

    # 3) upcoming games involving follows -> preview cards.
    try:
        slate = await nhl.scoreboard_now()
        for g in slate.get("games", []) or []:
            if g.get("group") != "upcoming":
                continue
            a, h = g.get("away", {}) or {}, g.get("home", {}) or {}
            if a.get("abbr") in followed_abbrs or h.get("abbr") in followed_abbrs:
                hn = h.get("name") or h.get("abbr")
                an = a.get("name") or a.get("abbr")
                mine.append({
                    "type": "upcoming", "game_id": g.get("id"),
                    "headline": f"{hn} host {an}",
                    "away": {"abbr": a.get("abbr"), "logo": a.get("logo")},
                    "home": {"abbr": h.get("abbr"), "logo": h.get("logo")},
                    "date": g.get("start_utc"), "followed": True, "video": None,
                })
    except Exception:
        logger.exception("my_hockey slate failed")

    items = mine + league[:10] if has else league[:14]
    return {"items": items, "personalized": has}


@api_router.post("/ticker/my_hockey")
async def ticker_my_hockey(follows: HomeFollows):
    """My Hockey feed: verified, people-led items assembled from Draft Board priorities.

    No LLM/TTS, no fabricated highlights. `video` is null today; the same card can
    graduate to a playable moment when a legitimate video source is connected.
    """
    try:
        return await _my_hockey_feed(follows)
    except Exception:
        logger.exception("ticker_my_hockey failed")
        return {"items": [], "personalized": bool(follows.teams or follows.players)}


@api_router.post("/ticker/home_segment")
async def ticker_home_segment(follows: HomeFollows):
    """Personalized My Ticker desk segment, programmed from the user's Draft Board.

    Verified facts only. Cached in Mongo by a signature of the follows so ordinary
    re-entry never re-hits the LLM; TTS is produced only on deliberate play.
    """
    voices = {"reggie": host_voice("reggie"), "marc": host_voice("marc")}
    try:
        facts, has = await _home_personal_facts(follows)
        sig = hashlib.sha1(facts.encode()).hexdigest()[:16]
        key = f"myticker:{sig}"
        doc = await db.segments.find_one({"_id": key})
        if doc and doc.get("beats"):
            beats = doc["beats"]
        else:
            beats = await build_my_ticker(facts, has, EMERGENT_LLM_KEY)
            await db.segments.update_one(
                {"_id": key},
                {"$set": {"beats": beats, "created_at": datetime.now(timezone.utc).isoformat()}},
                upsert=True,
            )
        return {"surface": "home", "segment_type": "opening", "subject": "myticker",
                "title": "YOUR HOCKEY STARTS HERE", "state": "ready" if beats else "unavailable",
                "beats": beats, "voices": voices}
    except Exception:
        logger.exception("ticker_home_segment failed")
        return {"surface": "home", "segment_type": "opening", "subject": "myticker",
                "title": None, "state": "unavailable", "beats": [], "voices": voices}


@api_router.get("/ticker/segment")
async def ticker_segment(surface: str, subject: str | None = None, league: str = "nhl"):
    """Shared Reggie + Marc sports-desk SHOW layer (any registered league).

    One reusable endpoint that returns a PREPARED/CACHED contextual segment for a
    surface (+ optional subject). Presence is constant across the app; the segment
    (its programming) changes with context. Never generated on passive browsing —
    callers fetch once per surface/subject, and TTS is produced only on deliberate play.
    """
    voices = {"reggie": host_voice("reggie"), "marc": host_voice("marc")}

    # GAME-level context: reuse the grounded, Mongo-cached game recap beats.
    if surface == "game" and subject:
        try:
            game = await nhl.game_by_id(subject)
            beats = await _recap_beats(game)
            return {"surface": surface, "segment_type": "game", "subject": subject,
                    "title": f"{game.away.abbr} @ {game.home.abbr} · GAME DESK",
                    "state": "ready" if beats else "unavailable",
                    "beats": beats, "voices": voices}
        except Exception:
            logger.exception("ticker_segment game failed")
            return {"surface": surface, "segment_type": "game", "subject": subject,
                    "title": None, "state": "unavailable", "beats": [], "voices": voices}

    # LEAGUE-level NEXT context: prepared upcoming-slate preview (league-aware).
    if surface == "next":
        try:
            slate = await get_provider(league).scoreboard_now()
            beats = await _next_segment_beats(slate)
            lname = slate.get("league_name", "NHL")
            title = f"NEXT ON THE TICKER" if slate.get("is_future") else f"TONIGHT ON THE TICKER"
            return {"surface": "next", "segment_type": "preview", "subject": league,
                    "title": title, "state": "ready" if beats else "unavailable",
                    "beats": beats, "voices": voices}
        except Exception:
            logger.exception("ticker_segment next failed")
            return {"surface": "next", "segment_type": "preview", "subject": league,
                    "title": None, "state": "unavailable", "beats": [], "voices": voices}

    # LEAGUE-level RECAP context: prepared postgame show over recent finals.
    if surface == "recap":
        try:
            prov = get_provider(league)
            finals = await prov.recent_finals_now(limit=8)
            lname = getattr(prov, "name", "NHL")
            key = f"recap:{league}:{(finals[0].get('id') if finals else 'none')}:{len(finals)}"
            doc = await db.segments.find_one({"_id": key})
            if doc and doc.get("beats"):
                beats = doc["beats"]
            else:
                beats = await build_recap_show(finals, EMERGENT_LLM_KEY, league_name=lname)
                await db.segments.update_one(
                    {"_id": key},
                    {"$set": {"beats": beats, "created_at": datetime.now(timezone.utc).isoformat()}},
                    upsert=True,
                )
            return {"surface": "recap", "segment_type": "recap", "subject": league,
                    "title": "THE TICKER RECAP", "state": "ready" if beats else "unavailable",
                    "beats": beats, "voices": voices}
        except Exception:
            logger.exception("ticker_segment recap failed")
            return {"surface": "recap", "segment_type": "recap", "subject": league,
                    "title": None, "state": "unavailable", "beats": [], "voices": voices}

    # LEAGUE-level HOME context: the Ticker opening show (honest, NHL-only for now).
    if surface == "home":
        try:
            slate = await nhl.scoreboard_now()
            hero_game = None
            try:
                hero_game = (await nhl.latest_game()).model_dump()
            except Exception:
                hero_game = None
            hid = hero_game.get("id") if hero_game else "none"
            key = f"home:{hid}:{len(slate.get('games', []) or [])}:{slate.get('date')}"
            doc = await db.segments.find_one({"_id": key})
            if doc and doc.get("beats"):
                beats = doc["beats"]
            else:
                beats = await build_home_open(hero_game, slate, EMERGENT_LLM_KEY)
                await db.segments.update_one(
                    {"_id": key},
                    {"$set": {"beats": beats, "created_at": datetime.now(timezone.utc).isoformat()}},
                    upsert=True,
                )
            return {"surface": "home", "segment_type": "opening", "subject": "league",
                    "title": "YOUR HOCKEY STARTS HERE", "state": "ready" if beats else "unavailable",
                    "beats": beats, "voices": voices}
        except Exception:
            logger.exception("ticker_segment home failed")
            return {"surface": "home", "segment_type": "opening", "subject": "league",
                    "title": None, "state": "unavailable", "beats": [], "voices": voices}

    raise HTTPException(status_code=404, detail=f"No desk segment for surface '{surface}'")


@api_router.get("/recap/{game_id}")
async def get_recap(game_id: str, refresh: bool = False):
    """Real NHL game -> Reggie + Marc recap (text). Milestone-1 proof.

    game_id may be a real NHL id or 'latest' (auto-picks the most recent final).
    The recap is cached in Mongo per game so we don't re-hit the LLM each view.
    """
    try:
        game = await nhl.game_by_id(game_id)
    except Exception as e:
        logger.exception("NHL fetch failed")
        raise HTTPException(status_code=502, detail=f"Hockey data unavailable: {e}")

    beats = await _recap_beats(game, refresh=refresh)
    return {
        "game": game.model_dump(),
        "beats": beats,
        "voices": {"reggie": host_voice("reggie"), "marc": host_voice("marc")},
    }


@api_router.get("/leagues")
async def leagues():
    """Registered leagues + the universal modules each provider can fill.

    This is the plug point: a second league appears here automatically once its
    adapter is registered, and every screen reads it through the same contract.
    """
    return {"leagues": [p.describe() for p in list_providers()]}


@api_router.get("/search")
async def search(q: str = ""):
    """Universal onboarding search across every connected provider (verified only).

    Returns [] for queries we don't cover yet — the client shows an honest
    'not connected yet' state and never fabricates results.
    """
    try:
        results = await search_all(q, limit=16)
    except Exception:
        logger.exception("search failed")
        results = []
    return {"query": q, "results": results}


@api_router.get("/league/{code}/scoreboard")
async def league_scoreboard(code: str):
    """League-aware upcoming slate (NEXT). Any registered provider."""
    try:
        return await get_provider(code).scoreboard_now()
    except KeyError:
        raise HTTPException(status_code=404, detail=f"No provider for league '{code}'")
    except Exception:
        logger.exception("league_scoreboard %s failed", code)
        return {"date": None, "games": []}


@api_router.get("/league/{code}/standings")
async def league_standings(code: str):
    try:
        return await get_provider(code).standings_now()
    except Exception:
        logger.exception("league_standings %s failed", code)
        return {"Eastern": [], "Western": []}


@api_router.get("/league/{code}/leaders")
async def league_leaders(code: str):
    try:
        return await get_provider(code).leaders_now(limit=8)
    except Exception:
        logger.exception("league_leaders %s failed", code)
        return {"skaters": {}, "goalies": {}}


@api_router.get("/league/{code}/recaps")
async def league_recaps(code: str):
    try:
        games = await get_provider(code).recent_finals_now()
    except Exception:
        logger.exception("league_recaps %s failed", code)
        games = []
    return {"games": games}


@api_router.get("/nhl/home")
async def nhl_home():
    """THE TICKER Home feed — real NHL data only.

    hero  : the most recent completed game + a short grounded Reggie/Marc take.
    slate : the current-day NHL slate (live / upcoming / final), simplified.
    Any module with no real data is returned empty so the client can hide it.
    """
    prov = get_provider("nhl")
    hero = None
    try:
        game = await prov.latest_game()
        beats = await _recap_beats(game)
        reggie = next((b for b in beats if b.get("host") == "reggie"), None)
        marc = next((b for b in beats if b.get("host") == "marc"), None)
        hero = {"game": game.model_dump(),
                "context": [b for b in (reggie, marc) if b]}
    except Exception:
        logger.exception("nhl_home hero failed")
        hero = None

    try:
        slate = await prov.scoreboard_now()
    except Exception:
        logger.exception("nhl_home slate failed")
        slate = {"date": None, "games": []}

    return {
        "hero": hero,
        "slate": slate,
        "voices": {"reggie": host_voice("reggie"), "marc": host_voice("marc")},
    }


@api_router.get("/nhl/scoreboard")
async def nhl_scoreboard():
    """Current-day NHL slate (NEXT / Home slate)."""
    try:
        return await get_provider("nhl").scoreboard_now()
    except Exception:
        logger.exception("nhl_scoreboard failed")
        return {"date": None, "games": []}


@api_router.get("/nhl/standings")
async def nhl_standings():
    """Real NHL standings by conference (Stats)."""
    try:
        return await get_provider("nhl").standings_now()
    except Exception:
        logger.exception("nhl_standings failed")
        return {"Eastern": [], "Western": []}


@api_router.get("/nhl/game/{game_id}")
async def nhl_game(game_id: str):
    """Real NHL game facts for the Game Page (no LLM; facts only).

    game_id may be a real NHL id or 'latest'. PLAY THE CALL on the client opens
    /recap/{id} which runs the grounded Reggie+Marc engine separately.
    """
    try:
        game = await get_provider("nhl").game_by_id(game_id)
    except Exception as e:
        logger.exception("nhl_game fetch failed")
        raise HTTPException(status_code=502, detail=f"Hockey data unavailable: {e}")
    return {"game": game.model_dump()}


@api_router.get("/nhl/leaders")
async def nhl_leaders():
    try:
        return await get_provider("nhl").leaders_now(limit=8)
    except Exception as e:
        logger.exception("nhl_leaders failed")
        raise HTTPException(status_code=502, detail=f"Leaders unavailable: {e}")


@api_router.get("/nhl/player/{pid}")
async def nhl_player(pid: str):
    """Verified NHL player snapshot for the Player Page."""
    try:
        return await get_provider("nhl").player_page(pid)
    except Exception as e:
        logger.exception("nhl_player failed")
        raise HTTPException(status_code=502, detail=f"Player data unavailable: {e}")


@api_router.get("/nhl/team/{tri}")
async def nhl_team(tri: str):
    """Verified NHL team snapshot for the Team Page."""
    try:
        return await get_provider("nhl").team_page(tri)
    except Exception as e:
        logger.exception("nhl_team failed")
        raise HTTPException(status_code=502, detail=f"Team data unavailable: {e}")


@api_router.get("/nhl/recaps")
async def nhl_recaps():
    """Recent completed NHL games for the Recap screen (real data only)."""
    try:
        games = await get_provider("nhl").recent_finals_now()
    except Exception:
        logger.exception("nhl_recaps failed")
        games = []
    return {"games": games}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
