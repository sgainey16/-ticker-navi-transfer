# PROJECT_MAP — MASL / “Powered by THE TICKER” (clean source export)

A React Native (Expo Router) + FastAPI + MongoDB app. This is the untouched working
prototype: an arena-soccer (MASL) edition of the hockey “Ticker” format, built as a
reusable engine (top tabs, persistent on-air panel, per-page host banter, highlights
player, Stars spotlight, Talk booth).

Git commit at export: 5eb5e55f8ac01e94abe3716172baa191563f074e

---

## Frontend

- **Entry point:** `frontend/app/_layout.tsx` (Expo Router root: providers, fonts,
  Stack navigator, global on-air overlay). File-based routing lives under `frontend/app/`.
- **Home / tab shell:** `frontend/app/index.tsx` — custom top-tab switcher
  (RECAP · TONIGHT · HOME · REELS · SCORES · STATS) + floating mic (Talk).
- **Screens:** `frontend/src/screens/` — HomeScreen, RecapScreen, TonightScreen,
  ReelsScreen, ScoresScreen, StatsScreen.
- **Route screens:** `frontend/app/`
  - `coldopen.tsx` — full-screen cold-open sequence (legacy; overlay is primary).
  - `talk.tsx` — Talk booth (chat with Rayo/Casey, spoken replies).
  - `voices.tsx` — ElevenLabs Voice Design audition/selection.
  - `highlights/[id].tsx` — game highlights player.
  - `game/[id].tsx`, `team/[id].tsx`, `player/[id].tsx` — detail screens.
- **Main routes / navigation:** top tabs are in-page state in `app/index.tsx`; deep
  screens are Expo Router routes (paths above). Tab handoff helper: `src/lib/tabnav.ts`.
- **Design tokens / theme:** `frontend/src/theme/index.ts` (colors, fonts, spacing,
  radius, per-host styles). Brand = black base + blue #014BFB + green #64F705,
  Rajdhani/Oswald/Inter.

## Host / character configuration

- **Hosts (display, accents, handles):** `frontend/src/theme/index.ts` → `hostStyle`
  (Rayo = green, Casey = blue).
- **Star spotlight (Top-3 “faces of the league”):** backend `STARS` in
  `backend/masl_data.py`; UI in `frontend/src/components/StarSpotlight.tsx`.
- **Selected host voice IDs (Rayo/Casey):** stored server-side in MongoDB
  `settings` collection under `_id: "voices"` (set via `POST /api/voices/select`).
  Local override keys used by the app: see `frontend/app/voices.tsx` (`VKEY_ID`).

## Voice / TTS integration (ElevenLabs)

- **Backend:** `backend/server.py`
  - `POST /api/tts` — text → speech (model `eleven_multilingual_v2`, per-host `speed`,
    in-memory cache). Client used: `ElevenLabs` (`elevenlabs` package).
  - `POST /api/voices/design`, `POST /api/voices/select`, `GET /api/voices/selected`
    — Voice Design auditions + saving chosen voices.
- **Frontend:** `frontend/src/lib/audio.ts` (playback via `expo-audio`),
  `frontend/src/lib/broadcast.tsx` (persistent on-air panel: queue/playback/segment
  switching), `frontend/app/talk.tsx` & `frontend/app/coldopen.tsx` (per-line TTS).

## API endpoints (all under `/api`)

Defined in `backend/server.py`:
- `GET /api/home`, `GET /api/teams`, `GET /api/teams/{id}`, `GET /api/players/{id}`
- `GET /api/games`, `GET /api/games/{id}`
- `GET /api/standings`, `GET /api/leaders`, `GET /api/availability`, `GET /api/ticker`
- `GET /api/coldopen`, `GET /api/segments/{page}` (per-page banter), `GET /api/stars`
- `POST /api/talk`, `GET /api/talk/{session_id}` (LLM chat)
- `POST /api/tts`, voices endpoints (see above)

## Highlights / video code

- **Player screen:** `frontend/app/highlights/[id].tsx`.
- **Platform-split player:** `frontend/src/components/YTPlayer.tsx` (native, uses
  `react-native-youtube-iframe` for contained in-app playback) and
  `frontend/src/components/YTPlayer.web.tsx` (web fallback thumbnail → opens YouTube).
- **Data:** each game in `backend/masl_data.py` has a `video_id` (official MASLtv clips).

## Talk / chat code

- **Backend:** `POST /api/talk` in `backend/server.py` (Emergent LLM via
  `emergentintegrations`; returns distinct Rayo + Casey replies; arena-soccer knowledge
  layer / guardrails in `backend/masl_data.py`).
- **Frontend:** `frontend/app/talk.tsx` (chat UI + spoken playback).

## Data source locations

- **All curated data:** `backend/masl_data.py` — teams, rosters, players, leaders,
  standings, games (+ `video_id`), availability, ticker, cold-open script, per-page
  banter `SEGMENTS`, `STARS`, and the arena-soccer knowledge/guardrail text.
- **Team logos & imagery:** `frontend/assets/` (rendered by
  `frontend/src/components/TeamLogo.tsx` by team abbreviation, with initials fallback).

## Database / storage

- **MongoDB** (via `motor`). Connection: `MONGO_URL`, DB: `DB_NAME` (`backend/.env`).
- Collections used: `talk_sessions` (chat history) and `settings` (`_id: "voices"`).
- No migrations; documents are created on demand. Most content is served from the
  in-code dataset (`masl_data.py`), not the DB.

## Mobile / responsive

- Expo (React Native) app; runs on iOS/Android (Expo Go / native build) and web.
- Safe-area aware layouts; native-only features (WebView video, audio) fall back
  gracefully on web.

---

## Run locally

### Backend (FastAPI)
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # fill MONGO_URL, DB_NAME, ELEVENLABS_API_KEY, LLM key
# start MongoDB locally (or point MONGO_URL at a hosted cluster)
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```
API is served under `/api` (e.g. http://localhost:8001/api/home).

### Frontend (Expo)
```bash
cd frontend
cp .env.example .env          # set EXPO_PUBLIC_BACKEND_URL=http://localhost:8001
yarn install                  # (or npm install)
yarn start                    # Expo dev server; press w for web, or scan QR in Expo Go
```

Notes:
- The app calls `${EXPO_PUBLIC_BACKEND_URL}/api/...`.
- ElevenLabs + LLM keys are required for host audio and the Talk booth.
- YouTube highlight playback works on a real device / Expo Go (WebView), not web.
