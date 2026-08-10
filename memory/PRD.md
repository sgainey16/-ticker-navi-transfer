# MASL — Powered by THE TICKER · PRD

## Original problem statement
Build a lean, working prototype applying The Ticker broadcast format to the Major Arena Soccer League (MASL) — the second sport on the platform after hockey — hosted by two new characters, Mateo "Rayo" Reyes (bilingual high-energy play-by-play) and Casey Whitfield (calm, data-driven analyst). It is a proof-of-concept and the centerpiece of a pitch to Victory+. Must feel like a real, live MASL digital product and prove the Ticker engine is portable across sports. Uses the completed 2025-26 season as a curated "current" dataset. Highest priority: an arena-soccer knowledge layer with ZERO leaked hockey terminology.

## User choices (locked)
- Hosts chat powered by **Claude Sonnet 4.6**.
- **Curated** 2025-26 dataset (not live scraping).
- Cold Open = animated broadcast interstitial.
- **No betting / no fantasy**.
- **Top tabs** matching the hockey Ticker: RECAP · TONIGHT · HOME · REELS · SCORES · STATS + floating mic → the Booth (Talk).
- Host **voices** via **ElevenLabs Voice Design** (Cold Open only), 3 candidates per host, user selects.
- The Ticker brand: real "THE TICKER" logo, Rajdhani/Oswald/Inter fonts, black + lime-green (Rayo) + blue (Casey).

## Architecture
- **Backend** FastAPI + MongoDB. Content served from curated `/app/backend/masl_data.py`; chat history in `talk_sessions`. LLM via emergentintegrations (Claude). Voices via ElevenLabs SDK.
  - GET /api/home, /teams, /teams/{id}, /players/{id}, /standings, /leaders, /games, /games/{id}, /coldopen, /availability, /ticker
  - POST /api/talk, GET /api/talk/{id}
  - GET /api/voices/briefs · POST /api/voices/design · POST /api/voices/select · POST /api/tts
- **Frontend** Expo Router. Top-tab shell (`app/index.tsx` + custom `TopTabBar`), screens in `src/screens/*`. Detail routes team/player/game; modals coldopen, talk, voices. Fonts via expo-font; audio via expo-audio + expo-file-system.

## Knowledge layer (P0 — done)
Arena-soccer rules/terminology + 2025-26 season context injected into the host system prompt; hard rule forbidding hockey terms. Both hosts answer in strict JSON (Rayo + Casey). Verified clean terminology in testing.

## Implemented (2026-06)
- Curated 2025-26 dataset: 8 clubs, rosters, leaders (Rian Marques 52 G), standings (E/W), 5 game recaps incl. Milwaukee 17-2 Utica, availability report, ticker, cold-open script. [done]
- Real MASL club logos pulled per team (initials-crest fallback). [done]
- Arena tactics board graphic (boarded 6-a-side, reads as arena soccer). [done]
- Top-tab broadcast shell + floating mic. [done]
- Screens: Recap (Highlights of the Night), Tonight (featured + storylines, no fantasy), Home (broadcast hub), Reels (placeholder clips), Scores (standings + results), Stats (leaders + availability). [done]
- Game/Team/Player detail with box score, quarter line score, stat compare, host commentary. [done]
- Talk (the Booth): Rayo & Casey chat, Claude-powered, persisted. [done]
- Cold Open interstitial ending on WATCH LIVE ON VICTORY+. [done]
- ElevenLabs Voice Design: audition 3 candidates per host, select, saved voice used for Cold Open TTS + mute toggle. [done]
- Backend + core frontend passed testing agent (run 1). Voice feature verified via live design + TTS. [done]

## Backlog
- P1: Read Talk answers aloud with selected voices; Rayo bilingual reaction/non-verbal layer; Breaking News strip; deeper quote banks.
- P2: Real Reels/highlight video structure & sharing; feature marks (The Debate, Call It, Leaderboard, Community); MASL/M2/M3/W tier acknowledgment.
- Deferred: live 2026-27 wiring, real footage, SoccerShift licensing.

## Notes
- No auth (open prototype).
- Cold Open host audio uses expo-audio — best experienced on a real device / Expo Go (web preview may not play audio).
