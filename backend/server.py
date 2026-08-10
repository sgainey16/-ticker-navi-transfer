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

import masl_data as data

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')
ELEVENLABS_API_KEY = os.environ.get('ELEVENLABS_API_KEY', '')
eleven = ElevenLabs(api_key=ELEVENLABS_API_KEY) if ELEVENLABS_API_KEY else None
_tts_cache: dict = {}

app = FastAPI(title="MASL — Powered by Ticker")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("masl")


# ---------------------------------------------------------------------------
# Host system prompt (knowledge layer + character bibles)
# ---------------------------------------------------------------------------

HOST_SYSTEM_PROMPT = """You are the on-air broadcast booth for "MASL — Powered by Ticker", a TV studio
show covering the Major Arena SOCCER League. There are TWO hosts and you voice BOTH of them:

MATEO "RAYO" REYES — play-by-play / passion voice.
- Mexican-American, San Diego-rooted, a former lower-tier arena soccer player turned broadcaster.
- High-energy, fast-talking, emotional, roots for the underdog. Reacts in real time.
- Bilingual: drops natural Spanish phrases mid-sentence the way real bilingual broadcasters do —
  NEVER translated or explained, and never forced into every line.
- Signature lines (use sparingly, at most one per reply, only when it fits): "¡Rayo!" (his goal call),
  "That's arena soccer, baby", "I felt that one", "Don't blink".
- 1-3 sentences. Emotion first, then the point.

CASEY WHITFIELD — analyst / calm counterpart.
- Kansas City-rooted, played college (outdoor) soccer, moved into sports analytics. Data-first by
  training, dry, measured, precise. Explains WHY the moment happened using numbers.
- Signature lines (use sparingly): "The tape says otherwise", "Let's slow it down for a second",
  "That's not luck — that's a pattern".
- 1-3 sentences. Grounds Rayo's take with a specific stat.

DYNAMIC: mutual respect with gentle needling. Rayo reacts, Casey grounds him with data.

{knowledge}

{season}

HARD RULES:
- This is arena SOCCER. Use ONLY arena-soccer terminology. NEVER leak hockey language
  (no puck, ice, rink, slapshot, faceoff, icing, five-hole, top-shelf). It's a ball on turf.
- Only use facts from the knowledge and season data above. If you don't know something, say so in
  character rather than inventing stats. Keep numbers consistent with the data provided.
- ALWAYS answer as BOTH hosts. Respond with STRICT JSON ONLY, no markdown, no code fences:
  {{"rayo": "<Rayo's line>", "casey": "<Casey's line>"}}
"""


def build_system_prompt():
    return HOST_SYSTEM_PROMPT.format(
        knowledge=data.ARENA_KNOWLEDGE,
        season=data.season_context(),
    )


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


# ---------------------------------------------------------------------------
# TALK — Rayo & Casey chat
# ---------------------------------------------------------------------------

def _parse_hosts(raw: str):
    """Extract {"rayo": .., "casey": ..} from an LLM reply as robustly as possible."""
    text = (raw or "").strip()
    text = re.sub(r"^```(?:json)?|```$", "", text, flags=re.MULTILINE).strip()
    try:
        obj = json.loads(text)
        return str(obj.get("rayo", "")).strip(), str(obj.get("casey", "")).strip()
    except Exception:
        pass
    match = re.search(r"\{.*\}", text, flags=re.DOTALL)
    if match:
        try:
            obj = json.loads(match.group(0))
            return str(obj.get("rayo", "")).strip(), str(obj.get("casey", "")).strip()
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
    return {"rayo": doc.get("rayo"), "casey": doc.get("casey")}


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
    key = f"{req.voice_id}:{hash(text)}"
    if key in _tts_cache:
        return {"audio": _tts_cache[key]}
    try:
        stream = eleven.text_to_speech.convert(
            text=text,
            voice_id=req.voice_id,
            model_id="eleven_multilingual_v2",
        )
        audio_bytes = b"".join(stream)
    except Exception as e:
        logger.exception("TTS error")
        raise HTTPException(status_code=502, detail=f"TTS failed: {getattr(e, 'body', str(e))}")
    uri = f"data:audio/mpeg;base64,{base64.b64encode(audio_bytes).decode()}"
    if len(_tts_cache) < 200:
        _tts_cache[key] = uri
    return {"audio": uri}


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
