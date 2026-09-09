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

## Milestone 5 — Real NHL Game Page [DONE, awaiting approval]
- Recap detail PLAY THE RECAP button recolored green -> Ticker blue (behavior/audio unchanged). Checkpoint tag ticker-recap-datefix-approved @ 56d1930.
- Canonical model extended: PenaltyPlay, SkaterLine; Game gained penalties, top_skaters, start_utc.
- providers/nhl.py fetch_game now populates penalties (landing summary.penalties), top_skaters (boxscore, points>0, top 6), start_utc.
- New endpoint GET /api/nhl/game/{id} -> {game} (facts only, no LLM). PLAY THE CALL opens /recap/{id} (existing grounded engine).
- Frontend app/game/[id].tsx fully rewritten -> real NHL Game Page: single-panel scoreboard (official logos/names/score/status/date/venue/series line), PLAY THE CALL (finals only), Scoring Summary (by period, strength tags), Three Stars, Key Players box score, Goaltending, Team Stats (SOG/PP/PIM/FO%/Hits/Blocks), Penalties. Scheduled/live show only available info; empty sections hidden. Highlights slot left as a code comment (not built). team_abbr + player_id retained for future Team/Player linking (not built).
- All game cards now open the Game Page: Home slate, Tonight, Scores scoreboard, Recap date-grouped cards -> /game/{id}. Recap featured PLAY THE CALL still -> /recap/latest.
- api.nhlGame(id) added.
- Verified: /game/2025030416 (SCF G6, CAR 3 VGK 0) renders all sections with real data; Recap card -> Game Page -> back works; no regression to Home/Tonight/Scores/Recap.

## Milestone 6 — Ticker Experience Layer: SHOW -> BROWSE -> DEPTH [DONE, awaiting approval]
- Checkpoint before changes: tag ticker-nhl-foundation @ ad6a748.
- Home: kept hero (SHOW). Replaced vertical slate with a horizontal GameRail (BROWSE) + GameDepth (DEPTH).
- New components: src/components/GameRail.tsx (horizontal swipe, compact cards, selected highlight), src/components/GameDepth.tsx (fetches /api/nhl/game/{id} with module cache; final -> KEY MOMENTS + team stats; upcoming -> records+note; OPEN GAME -> /game/{id}).
- Rail data = current slate (live/upcoming) + recent finals (nhlRecaps), deduped (20 cards). Default selection = latest final (hero) for immediate depth.
- Browsing changes selection only: NO navigation, NO audio (broadcast layer untouched). Deliberate OPEN GAME / hero PLAY THE CALL are the only deep/audio actions.
- Segment model (Task 4): preserved existing broadcast.tsx cached per-page segment architecture + server-side TTS cache; browsing does not trigger it. Live Talk unchanged.
- One-panel kept; Ticker navy/blue; official NHL logos; persistent blue Talk FAB.
- Verified: rail+depth render; selecting upcoming card updates depth without leaving Home.

### HIGHLIGHTLY CAPABILITY AUDIT (report only, nothing built)
- Highlightly: NOT integrated anywhere. No code refs, no key/URL in env, no reference in /app memory/docs. Zero retrievable today.
- Existing "highlights" = MASL curated YouTube IDs (masl_data.py) via react-native-youtube-iframe (YTPlayer/ReelsScreen/highlights/[id]) = demo content, not a real API.
- REAL video we already have (NHL landing feed, per goal): highlightClip (NHL video id), highlightClipSharingUrl (nhl.com/video/...), discreteClip; metadata: playerId, eventId, teamAbbrev, period, timeInPeriod, strength (ev/pp/sh), goalModifier (EN etc), shotType, assists, headshot, gameId.
- This metadata CAN support building: all-goals-by-player, power-play moments, player moments in a game, player/selected-game highlight rails, eventual personalized packages. CAVEAT: clip URLs are nhl.com/video pages (official player), not raw embeddable streams -> inline in-app playback is UNPROVEN and must be validated; deep-linking is safe.
- To use Highlightly specifically we need the user's Highlightly API credentials + plan/endpoints.

## Milestone 6b — Highlightly recovery/audit [READ-ONLY, COMPLETE]
- Checkpoint of approved experience layer: tag ticker-experience-layer @ c1dc2c9.
- Exhaustive read-only search: the earlier Ticker Highlightly integration is NOT recoverable in this environment.
  - Not in working tree, ALL git history (root a0a3617 masl-clean-baseline -> HEAD), any branch/tag, MARSL-clean-source-export.zip, /app/memory (no handoff kit html present), frontend/package.json, backend/requirements.txt, or any .env (no highlightly/rapidapi/api-sports keys).
  - Only "highlights" here = MASL demo: app/highlights/[id].tsx -> api.game(id) (masl_data) -> curated YouTube videoId -> YTPlayer. Not a real highlight API.
- Reason: this fork was built from the MARSL clean baseline which per user directive intentionally did NOT merge Ticker 1 architecture. The old Highlightly code lives in the separate earlier Ticker codebase, which is not in this container.
- To perform the real Highlightly audit the user wants, need the earlier Ticker source (zip or GitHub repo) added to the environment.
- Proven in-hand video source remains NHL official per-goal clip metadata (see Milestone 6 audit).

## Milestone 7 — RECAP SHOW (SHOW->BROWSE->DEPTH) [DONE, awaiting approval]
- RecapScreen rebuilt: compact Reggie+Marc SHOW banner (desk art, reduced dead space) + RECENT FINALS horizontal GameRail + deep GameDepth. No new page/route.
- Reused Home components: GameRail, GameDepth (extended, not duplicated).
- GameDepth extended (opt-in, Home unchanged): deep prop -> adds Hits/Blocks/PIM stats + GOALTENDING line; onHearRecap prop -> HEAR THE RECAP button (-> /recap/{id}, existing cached grounded engine); OPEN GAME -> /game/{id}. Reserved HIGHLIGHTS slot as code comment in natural order (GAME STORY -> HIGHLIGHTS -> KEY MOMENTS -> STATS); renders nothing until a real source exists (no placeholders/MASL YouTube).
- Browsing rail = setSelectedId only; NO audio triggered/restarted (no broadcast/tts calls in GameRail/GameDepth). HEAR THE RECAP + OPEN GAME are the only deliberate actions.
- Default selected = most recent final. Empty state if no finals.
- Untouched: Home, Next, Scores, Game Page, broadcast/audio, Reels; no Team/Player/Highlightly.

## Milestone 8 — Real NHL Team Page [DONE, awaiting approval]
- New endpoint GET /api/nhl/team/{tri}; provider nhl.team_page() concurrently pulls standings/now + club-stats/{tri}/now + club-schedule-season/{tri}/now + roster/{tri}/current (added asyncio import + _sched_card).
- Returns verified: identity(logo/name/conf/div), record(W-L-OT/pts/div+conf rank), goals(gf/ga/diff), form(l10/streak/home/road), top5 scorers(player_id), goalie snapshot, recent finals, next game, roster(F/D/G with player_id).
- PP
## Milestone 8 - Real NHL Team Page [DONE, awaiting approval]
- New endpoint GET /api/nhl/team/{tri}; provider nhl.team_page() concurrently pulls standings/now + club-stats/{tri}/now + club-schedule-season/{tri}/now + roster/{tri}/current (added asyncio import + _sched_card).
- Verified fields: identity(logo/name/conf/div), record(W-L-OT/pts/div+conf rank), goals(gf/ga/diff), form(l10/streak/home/road), top5 scorers(player_id), goalie snapshot, recent finals, next game, roster(F/D/G with player_id).
- PP-pct/PK-pct intentionally OMITTED (not in these verified feeds) -> hidden, not fabricated. Recent Results empty in offseason -> section hidden.
- Frontend app/team/[id].tsx rewritten (people-first, compact); BackBar export preserved. Reserved TEAM HIGHLIGHTS slot (comment, renders nothing). One compact TICKER READ line from verified data (no second host panel). Player rows/roster keep player_id for future Player Page.
- Entry points wired (minimal): Scores standings rows -> /team/{abbr}; Game Page team columns -> /team/{abbr}. Game links on Team -> /game/{id}.
- api.nhlTeam added. No architecture changes to Home/Recap/Next/Scores/Game beyond routing taps.

## Milestone 9 - Real NHL Player Page [DONE, awaiting approval]
- New endpoint GET /api/nhl/player/{id}; provider nhl.player_page() uses NHL player/{id}/landing (featuredStats.regularSeason.subSeason, last5Games, bio, headshot) + club-schedule-season/{teamAbbr}/now for next game. Added _height helper.
- Skater stats: GP/G/A/PTS/+-/PIM/Shots/Shooting%/PPG/PPP. Goalie stats: GP/W-L-OT/GAA/SV%/SO. last5 per-game (skater G-A-P; goalie decision/SA/GA/SV%). Unsupported fields hidden; nothing fabricated.
- Frontend app/player/[id].tsx: human-first identity (headshot/name/#/pos/team/bio/age) + one-line verified TICKER read + season grid + next game + last 5. Reserved PLAYER HIGHLIGHTS slot (comment, renders nothing).
- Routing added: Team scorers/goalie/roster -> /player/{id}; Game key players -> /player/{id}; Player team badge -> /team/{abbr}; Player next game + last5 -> /game/{id}. Real player_id/team_id/game_id relationships preserved.
- api.nhlPlayer added. No architecture changes to Home/Recap/Next/Scores/Game/Team beyond player-routing taps.

## Ticker-wide architecture rule - CAPABILITY-DRIVEN ENRICHMENT
- Highlights (and other rich modules) are capability-driven, NOT required. Core pages must work fully without them.
- When a provider supplies verified linked video/data, the module dynamically appears. When unavailable, it disappears entirely: no empty space, no "Coming Soon", no unavailable message, no fake content.
- Same page structure across leagues; provider capability determines richness. More data/video = richer; less = clean core.
- Player Page implements this via `hasHighlights` gate on provider `highlights` (absent today -> nothing renders). Identifiers (player_id/team_id/game_id) preserved to add later.

## Player routing completion (acceptance)
- Added scorer_id (ScoringPlay), player_id (StarLine, GoalieLine) to canonical game model; provider populates from NHL landing/boxscore playerId.
- Game Page now routes to /player/{id} from: Scoring Summary scorer, Three Stars, Goaltending, Key Players. Team routes from leading scorers, goalie, roster. Verified live for skater (Necas) + goalie (Blackwood/Hellebuyck).

## Remediation Step 1 - Global sports-desk behavior, proven on NEXT [DONE, awaiting approval]
- Shared reusable Reggie+Marc SHOW layer: TickerDesk component + GET /api/ticker/segment (one endpoint, context-driven). Presence constant, programming changes by surface/subject.
- NEXT rebuilt as SHOW (TickerDesk, prepared/cached league preview) -> BROWSE (GameRail) -> DEPTH (GameDepth, OPEN GAME). One-panel rule preserved; off-day honesty preserved; Talk FAB untouched.
- Prepared segments cached in Mongo (db.segments) keyed by slate date+count; TTS server-cached and produced ONLY on deliberate PLAY. Verified: entering NEXT = 1 segment call / 0 TTS; browsing rail = still 1/0 (no restart, no LLM, no ElevenLabs); PLAY = 1 TTS, ON AIR + PAUSE.
- Same endpoint proven in 2 contexts: league preview (NEXT) + game desk (surface=game&subject=id reuses grounded recap beats). Voices server-first, IDs never exposed. Audio failure never blocks page.
- Files: backend ticker_recap.py (build_next_preview + fact sheet + fallback), server.py (/ticker/segment + _next_segment_beats, cached), frontend src/lib/api.ts (tickerSegment + DeskSegment types), src/components/TickerDesk.tsx (new, shared), src/screens/TonightScreen.tsx (rebuilt SHOW/BROWSE/DEPTH). Reused: GameRail, GameDepth, audio lib, tts endpoint, desk artwork.
- Game Call transcript screen NOT touched (RED recorded for later audio remediation).

## Remediation Step 2 - Recap postgame show on the shared desk [DONE, awaiting approval]
- Recap now leads with the SAME shared TickerDesk (surface="recap"): prepared/cached POSTGAME show grounded strictly on recent final scores (team names + scores only; timeless phrasing, never claims "tonight").
- Backend: ticker_recap.build_recap_show + show fact sheet + fallback; server.py /ticker/segment surface=="recap" (Mongo-cached by latest-final id + count).
- Frontend: RecapScreen static banner replaced with <TickerDesk surface="recap">. BROWSE (GameRail recent finals) + DEPTH (GameDepth deep: HEAR THE RECAP -> /recap/[id], OPEN GAME) preserved.
- Verified on device: entry = 1 segment / 0 TTS; browsing finals = still 1/0 (no restart/LLM/TTS); one-panel rule preserved. Same shared endpoint/component now proven across NEXT (preview) + RECAP (postgame) + GAME (desk).
- Game Call transcript screen still untouched (audio-presentation RED deferred).

## Remediation Step 3 - Home / My Ticker on the shared desk [DONE, awaiting approval]
- Home now leads with the SAME shared TickerDesk (surface="home") programmed as the Ticker OPENING SHOW: prepared/cached, grounded on the latest notable final + what's coming. Honest title "YOUR HOCKEY STARTS HERE" - NO fake personalization / no "your team".
- Command-center shape, NOT a Recap/Next clone: (1) live scores wire strip, (2) shared desk opening show, (3) HAPPENING headline spotlight as a GAME card (removed the old duplicate desk-image hero -> one-panel rule now truly single desk), (4) AROUND THE NHL importance rail (live+finals) + depth, (5) COMING UP compact upcoming strip, (6) MY TEAMS/MY PLAYERS future slots render nothing until real follows exist (no Coming Soon boxes).
- Backend: ticker_recap.build_home_open + home fact sheet + fallback; server.py /ticker/segment surface=="home" (Mongo-cached by hero id + slate). RECAP prompt also hardened to timeless phrasing (never claims "tonight").
- Verified on device: desk present on entry; browsing rail = 0 new segment/TTS (no restart/LLM/ElevenLabs); PLAY = 1 TTS + ON AIR/PAUSE; spotlight->Game, rail->depth, Coming Up->Game.
- THREE distinct programs on one desk confirmed: HOME "YOUR HOCKEY STARTS HERE" (opening) / RECAP "THE TICKER RECAP" (postgame) / NEXT "NEXT ON THE TICKER" (preview).
- Files: backend ticker_recap.py, server.py; frontend src/screens/HomeScreen.tsx (rebuilt). Reused TickerDesk/GameRail/GameDepth/NhlLogo/TickerStrip. Scores/Game/Team/Player/Reels/Stats untouched.

## Onboarding + shared Follows store [DONE, awaiting approval]
- NEW src/lib/follows.tsx: FollowsProvider + useFollows() hook. Local-first persistence via storage util (key ticker.follows as JSON string; ticker.onboarded flag). Model: {teams:[{abbr,tier?}], players:[{player_id,team_abbr,tier?}]}, tier 1/2/3 OPTIONAL. No auth/backend/profile.
- NEW app/onboarding.tsx: fast visual flow NHL -> Teams (official logos grid from /api/nhl/standings, multi-select) -> Players (real rosters from selected teams via /api/nhl/team/{abbr}, compact initials chips) -> My Stars (1ST=MY CORE gold / 2ND=MY REGULARS blue / 3RD=KEEP ME POSTED silver; optional, unranked stay followed) -> Enter The Ticker.
- app/_layout.tsx wraps app in FollowsProvider + registers onboarding route. app/index.tsx gate: !onboarded -> <Redirect href="/onboarding">.
- Dev reset: /onboarding?reset=1 or "Start over (dev reset)" on step 0 -> clears follows + onboarded only.
- Verified on web session: fresh launch->onboarding; team+player select; 1st/2nd/3rd assignment; one UNRANKED follow persisted (player w/o tier); finish->Home; relaunch (same session) skips onboarding & follows survive; reset clears state. Stored model exactly {teams:[{abbr,tier}],players:[{player_id,team_abbr,tier?}]}.
- Home NOT rebuilt yet; no Team/Player follow controls added. Next: rebuild Home/My Ticker from these real follows.

## Remediation Step 3 (real) - HOME / MY TICKER + Draft Board [DONE, awaiting approval]
- Terminology: Stars -> MY DRAFT BOARD. 1ST ROUND (Can't-Miss) / 2ND ROUND (Regulars) / 3RD ROUND (Keep Me Posted). Onboarding updated (ribbon chips, "Build your Draft Board"). Underlying model UNCHANGED: tier 1|2|3 (presentation only). Added optional display name/pos to follows (additive; canonical keys abbr/player_id/team_abbr/tier intact).
- Home rebuilt from real onboarding follows:
  1) MY TICKER DESK: shared TickerDesk now personalized via POST /api/ticker/home_segment (Draft Board -> weighted 1st>2nd>3rd>unranked>league, verified facts only, Mongo-cached by follows signature). No autoplay/transcript; one-panel rule.
  2) MY DRAFT BOARD: compact horizontal round rails; 1st Round bigger tiles (gold), 2nd (blue), 3rd (silver), unranked under FOLLOWING. Teams=official logos, players=initials avatar in round colour. Tap team->Team, player->Player.
  3) AROUND MY HOCKEY: happening/upcoming rails prioritize followed teams/players first, then league; GameDepth for selected. Coming Up strip highlights followed games.
  - Empty follows -> honest "Build your Draft Board" card + general NHL fallback (desk broadens honestly).
- TickerDesk extended with optional segmentFetcher + cacheKey (keeps GET surfaces unchanged; Home uses POST fetcher keyed by follows signature).
- Backend: ticker_recap.build_my_ticker + MYTICKER_PROMPT + fallback; server.py POST /ticker/home_segment with HomeFollows model + _home_personal_facts (bounded team_page/player_page/scoreboard fetches, verified only).
- Verified on device: Draft Board hierarchy renders (BOS 1st / player 2nd / TOR 3rd / EDM FOLLOWING); desk personalized (curl: "Your Bruins... McDavid's your guy 138 points... Leafs 32-36"); entry=1 desk fetch/0 TTS; PLAY=1 TTS + ON AIR/PAUSE; browsing adds NO desk/LLM/TTS; board tile->Team/Player routing; relaunch (same session) persists board; onboarding terminology updated. Three distinct programs on one desk (HOME my hockey / RECAP happened / NEXT coming).
- Scope held: Reels/Highlights, Stats, Game Call, leagues, Highlightly/Sportlogiq untouched.

## Remediation - Reels -> MY HOCKEY (converted, not deleted) [DONE, awaiting approval]
- Tab REELS renamed MY HOCKEY (app/index.tsx). ReelsScreen fully rebuilt; ALL MASL content removed (arena.jpg/rayo/casey/fake reels gone).
- Verified-only, people/result-led feed assembled from Draft Board priorities. NOT a Reggie/Marc desk (Home owns that); fast + visual scan-and-tap.
- Backend: POST /api/ticker/my_hockey (HomeFollows) -> _my_hockey_feed. No LLM/TTS, no fabrication. Items: player last-game line (skater G/A or goalie saves, skipped if none), final result stories (_final_headline: shut out/edged/routed/beat from verified score), upcoming previews ("Leafs host Canadiens"). Followed teams/players first, then league. `video: null` on every item = capability-gated; same card graduates to playable when a real source connects (no empty video box, no "coming soon").
- Frontend: sections "Around Your Hockey" (followed) + "Around the NHL"; player card->/player, final/upcoming->/game. Empty/new user -> honest league feed + "Build your Draft Board" card.
- Verified on device: tab renamed; personalized feed (Leafs/Bruins upcoming under Around Your Hockey; league finals with headlines like "Hurricanes shut out Golden Knights, 3-0"); card tap routes to canonical Game page; no MASL; no fake video. McDavid player line correctly omitted (no recent game -> no fabrication).
- Scope held: Stats, Game Call, leagues, Highlightly untouched. Home/Recap/Next/Scores/Team/Player intact.

## Remediation - STATS -> Ticker consumer Stats [DONE, awaiting approval]
- StatsScreen fully rebuilt; MASL removed (StarSpotlight, api.leaders/teams/availability, green, availability report all gone). People-first, no analytics/betting/charts/sortable tables/AI conclusions, no Reggie/Marc desk.
- Sections: (1) WHERE MY TEAMS SIT - followed teams' verified standing (rank in conference, record, points; tap->Team); (2) LEAGUE LEADERS - chips Points/Goals/Assists/Wins/GAA/SV%, real NHL leaders with headshots (tap->Player), followed players/teams highlighted; (3) STANDINGS - both conferences, followed highlighted (tap->Team).
- Backend: providers/nhl.leaders_now() via NHL skater-stats-leaders/current + goalie-stats-leaders/current (follow_redirects); GET /api/nhl/leaders. Verified only; unavailable -> omitted, never manufactured.
- Verified on device: My teams (BOS 5th East 100pts, EDM 5th West 93pts); leaders McDavid 138 / Kucherov 130 / MacKinnon 127...; SV% chip -> Wedgewood .921; standings both confs; leader/team taps route to Player/Team pages. No MASL, no fabricated data.
- LAST product-surface change before Friends & Family freeze. Scope held: Home/My Hockey/Recap/Next/Scores/Game/Team/Player/leagues/integrations untouched.
