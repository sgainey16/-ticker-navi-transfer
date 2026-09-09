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
from ticker_recap import build_recap, build_next_preview
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
    key = f"next:{slate.get('date')}:{len(slate.get('games', []) or [])}"
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


@api_router.get("/ticker/segment")
async def ticker_segment(surface: str, subject: str | None = None):
    """Shared Reggie + Marc sports-desk SHOW layer.

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

    # LEAGUE-level NEXT context: prepared upcoming-slate preview.
    if surface == "next":
        try:
            slate = await nhl.scoreboard_now()
            beats = await _next_segment_beats(slate)
            title = "NEXT ON THE TICKER" if slate.get("is_future") else "TONIGHT ON THE TICKER"
            return {"surface": "next", "segment_type": "preview", "subject": "league",
                    "title": title, "state": "ready" if beats else "unavailable",
                    "beats": beats, "voices": voices}
        except Exception:
            logger.exception("ticker_segment next failed")
            return {"surface": "next", "segment_type": "preview", "subject": "league",
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


@api_router.get("/nhl/home")
async def nhl_home():
    """THE TICKER Home feed — real NHL data only.

    hero  : the most recent completed game + a short grounded Reggie/Marc take.
    slate : the current-day NHL slate (live / upcoming / final), simplified.
    Any module with no real data is returned empty so the client can hide it.
    """
    hero = None
    try:
        game = await nhl.latest_game()
        beats = await _recap_beats(game)
        reggie = next((b for b in beats if b.get("host") == "reggie"), None)
        marc = next((b for b in beats if b.get("host") == "marc"), None)
        hero = {"game": game.model_dump(),
                "context": [b for b in (reggie, marc) if b]}
    except Exception:
        logger.exception("nhl_home hero failed")
        hero = None

    try:
        slate = await nhl.scoreboard_now()
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
    """Current-day NHL slate (Tonight/Scores)."""
    try:
        return await nhl.scoreboard_now()
    except Exception:
        logger.exception("nhl_scoreboard failed")
        return {"date": None, "games": []}


@api_router.get("/nhl/standings")
async def nhl_standings():
    """Real NHL standings by conference (Scores)."""
    try:
        return await nhl.standings_now()
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
        game = await nhl.game_by_id(game_id)
    except Exception as e:
        logger.exception("nhl_game fetch failed")
        raise HTTPException(status_code=502, detail=f"Hockey data unavailable: {e}")
    return {"game": game.model_dump()}


@api_router.get("/nhl/player/{pid}")
async def nhl_player(pid: str):
    """Verified NHL player snapshot for the Player Page."""
    try:
        return await nhl.player_page(pid)
    except Exception as e:
        logger.exception("nhl_player failed")
        raise HTTPException(status_code=502, detail=f"Player data unavailable: {e}")


@api_router.get("/nhl/team/{tri}")
async def nhl_team(tri: str):
    """Verified NHL team snapshot for the Team Page."""
    try:
        return await nhl.team_page(tri)
    except Exception as e:
        logger.exception("nhl_team failed")
        raise HTTPException(status_code=502, detail=f"Team data unavailable: {e}")


@api_router.get("/nhl/recaps")
async def nhl_recaps():
    """Recent completed NHL games for the Recap screen (real data only)."""
    try:
        games = await nhl.recent_finals_now()
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
