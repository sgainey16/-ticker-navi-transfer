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

## THE TICKER — Hockey rebuild (Milestone 1 proof, 2026)
Foundation: MASL chassis, checkpointed at git tag `masl-clean-baseline`.
- **Canonical hockey model** `backend/models/hockey.py` (League/Team/Player/Game + scoring, goalies, stars, series).
- **NHL provider** `backend/providers/nhl.py` — public NHL API (api-web.nhle.com); auto-picks most recent completed game (weekly schedule scan, offseason fallback). All async (no event-loop blocking).
- **Hosts** `backend/ticker_hosts.py` — Reggie Banks + Marc Collins persona; voice IDs from env `REGGIE_VOICE_ID`/`MARC_VOICE_ID` (not hardcoded).
- **Recap engine** `backend/ticker_recap.py` — deterministic verified fact sheet → LLM (claude-sonnet-4-6) writes grounded Reggie/Marc dialogue answering what/why/who/remember/next. People-first. Cached in Mongo `recaps`.
- **Endpoint** `GET /api/recap/{game_id}` (id or `latest`) → {game, beats, voices}.
- **Non-blocking TTS**: `/api/tts` now runs the ElevenLabs call via `asyncio.to_thread` + on-disk cache (`backend/.tts_cache`). Verified: a 2.7s TTS did not block `/home` (0.01s); cached hit 3ms.
- **Proof screen** `frontend/app/recap/[id].tsx` — scoreboard + series + "THE CALL" Reggie/Marc beats + PLAY THE RECAP (sequential per-beat audio; text always shown; audio failure degrades gracefully). Reachable at `/recap/latest`.
- Proof game (auto): 2025-26 Stanley Cup Final G6 — Carolina 3, Vegas 0 (Bussi 22-save shutout, series 4-2). Verified accurate.
- Pending: audio confirmation on a real iPhone (web preview can't play it).


- **Stars of the League** spotlight (Top 3 on STATS tab, `src/components/StarSpotlight.tsx`, `GET /api/stars`): MVP Rian Marques (gold, 52 G), The Icon Ian Bennett (blue, 41 G), Rookie on the Rise Nikola Vignjevic (green, 28 pts) — each with tag chip, tagline, brand narrative, VIEW PROFILE → player detail. Builds star value for the pitch. [done]
- **Highlights player hardened**: replaced raw WebView embed with `react-native-youtube-iframe` via a PLATFORM-SPLIT component (`src/components/YTPlayer.tsx` native / `YTPlayer.web.tsx` web fallback) so playback stays INSIDE the app (no more getting kicked to the YouTube app) and the web bundle no longer blanks. Native containment pending on-device user confirmation. [done, device-recheck pending]
- **Persistent on-air panel** (`src/lib/broadcast.tsx`): slim audio-only ON-AIR pill (mute + close), per-page banter segments that switch on tab change, expanded to 5-6 lines/page, English-led openers. [done]
- **Real game highlights**: games REDONE to match real 2025-26 MASL games that have official MASLtv videos; each game has `video_id`+`label`. Slate: Utica@Milwaukee 17-2 (RECORD NIGHT, opW7LVDvTkQ), San Diego 7-6 Empire (wrvbAD76QdE), KC 8-5 @ Baltimore (-tNpJHj-DWY), St.Louis 7-6 Milwaukee OT (X2vnyC1SrSE), Ron Newman Cup Final G3 San Diego 10-3 Milwaukee (tlF8VAlXFyY). RECAP cards show real YouTube thumbnails → tap opens highlights player (`app/highlights/[id].tsx`) with score header + booth commentary. Native uses react-native-webview inline; web shows a "WATCH ON YOUTUBE" fallback (WebView unsupported on web). game detail has WATCH HIGHLIGHTS button. [done]
- Verified: testing agent run 2 — backend 32/32, frontend flows (bar persistence, recap→highlights, watch-highlights), zero hockey terms. [done]

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

## Milestone 2b — Host Artwork Swap (DONE, awaiting user sign-off)
- Installed user-approved Reggie Banks + Marc Collins artwork (cartoon "THE TICKER AI SPORTS NETWORK" canon).
- Replaced ONLY existing host image slots (no code/redesign):
  - assets/images/rayo.jpg  -> Reggie face-only avatar crop (400x400), zoomed out ~23% for clean circular read.
  - assets/images/casey.jpg -> Marc face-only avatar crop (400x400).
  - assets/images/broadcast-desk.png -> two-host desk hero banner, edge-extended to 1497x998 (1.5:1) so both hosts survive the hero cover-crop.
- Full posters (with nameplates/taglines) retained at /tmp for future large-portrait slot; not wired to any screen yet.
- Verified live: Home hero shows both hosts; Talk booth avatars read cleanly (green Reggie / blue Marc).
- NOT changed (intentional, per user scope): coldopen/voices still show legacy "RAYO/CASEY/Mateo Reyes/Casey Whitfield" text labels; MASL body content unchanged.

## Milestone 3 — HOME converted to THE TICKER (real NHL) [DONE, awaiting approval]
- New backend endpoint GET /api/nhl/home (providers/nhl.scoreboard_now + latest_game + cached recap beats).
  - hero: most recent completed NHL game (canonical model) + first Reggie + first Marc grounded beat.
  - slate: current-day NHL slate simplified (live/upcoming/final groups) with real logos+records.
  - Refactored recap into server._recap_beats() (shared by /recap and /nhl/home).
- providers/nhl.py: added scoreboard()/scoreboard_now() + _state_group/_score_team.
- Frontend HomeScreen.tsx fully rewritten: Ticker header, hero (TICKER logo, FINAL/LIVE badge, real team logos+score, series line, Reggie/Marc avatar takes, PLAY THE CALL -> /recap/latest), AROUND THE NHL slate grouped live/upcoming/final; final cards tap -> /recap/{id}. Empty modules hidden. Ticker blue/navy/white treatment (no MASL green on Home). No placeholders.
- New components: src/components/NhlLogo.tsx (expo-image SVG from assets.nhle.com, abbr fallback). api.ts: NhlHome types + api.nhlHome().
- Verified: /api/nhl/home returns SCF G6 (CAR 3 @ VGK 0) + grounded takes + 5 real preseason games; Home renders correctly on mobile.
- Untouched by design: global green mic/Talk FAB (persistent layer, not Home), Recap/Tonight/Reels/Scores/Stats, MASL data module still backs those other screens.
