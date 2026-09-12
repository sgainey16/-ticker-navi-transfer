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

## LAUNCH BLOCKER FIXED - iOS Safari expo-audio microphone-permission crash [VERIFIED by testing_agent]
- Root cause: expo-audio's web module (AudioModule.web.js getPermissionWithQueryAsync) calls navigator.permissions.query({name:'microphone'}) which THROWS on iOS Safari -> uncaught crash on the audio playback path. App only needs TTS OUTPUT, never recording.
- Fix: Metro platform-split. NEW /app/frontend/src/lib/audio.web.ts = pure HTMLAudioElement playback (new Audio()), NO expo-audio import, graceful play()-rejection + 25s safety. Native /app/frontend/src/lib/audio.ts (expo-audio) unchanged, used only on native. expo-audio fully excluded from web bundle.
- testing_agent (iteration_5): instrumented navigator.permissions.query + getUserMedia BEFORE app code -> across fresh load, onboarding, Home, PLAY, all 6 tabs = ZERO mic queries, ZERO getUserMedia, ZERO page/expo-audio errors, no crash. PLAY works. Recommend final check on real iPhone Safari (Chromium can't reproduce the throw).
- Non-blocking polish noted: TickerDesk shares testID desk-play/ticker-desk across tab instances (namespacing would help E2E); RN-Web shadow*/pointerEvents deprecation warnings.


## TICKER LAUNCH FOUNDATION — universal hockey chassis [DONE, awaiting approval + checkpoint `ticker-universal-hockey-launch`]
Goal: make the existing Ticker architecture able to house any league/team/player/game through one canonical model + provider seam, without touching the working NHL experience.

FRONTEND
- Universal primary nav reduced to EXACTLY 4 tabs: HOME · RECAP · NEXT · STATS (app/index.tsx). Default landing = HOME.
- Removed from primary nav: MY HOCKEY (reels) — capability-gated, only where verified video exists; SCORES — its standings now live inside STATS. (ReelsScreen.tsx / ScoresScreen.tsx remain on disk, unimported, dead — intentional.)
- Deleted legacy MASL routes: app/highlights/[id].tsx (MASL/MASLtv YouTube fake video) and app/coldopen.tsx (legacy cold open). Removed their Stack.Screen registrations in app/_layout.tsx. Both now resolve to Expo "Unmatched Route".
- (Cut #1 earlier removed the legacy BroadcastProvider/Rayo-Casey engine + all /api/segment calls.)

BACKEND — provider chassis (the plug point for a 2nd league)
- NEW providers/base.py: HockeyProvider ABC — canonical surface (latest_game, game_by_id, recent_finals_now, scoreboard_now, standings_now, leaders_now, team_page, player_page) + `capabilities` dict incl. `media` (gates REELS) + describe().
- NEW providers/registry.py: _PROVIDERS = {"nhl": NHLProvider()}; get_provider(code="nhl"), list_providers(). Adding a league = one line here, zero page rewrites.
- providers/nhl.py: added NHLProvider(HockeyProvider) delegating to existing verified async fns; capabilities.media=False (no verified NHL video wired -> no fake). Game model gained `has_video: bool=False`; NHL adapter sets has_video=False explicitly.
- server.py: all /api/nhl/* routes now resolve through get_provider("nhl") (behavior identical). NEW GET /api/leagues -> registered providers + capabilities.
- No international leagues added (chassis only). NHL still the sole working provider.

VERIFIED — testing_agent iteration_7.json: PASS
- Backend 9/9 pytest (tests/test_launch_foundation.py): /api/leagues=[nhl, media:false]; /api/nhl/game/latest has_video=false league=NHL; standings 16/16; leaders skaters+goalies; scoreboard/home/recaps/ticker.segment OK.
- Frontend: onboarding->Home; nav EXACTLY [HOME,RECAP,NEXT,STATS], MY HOCKEY & SCORES absent; STATS shows WHERE MY TEAMS SIT + LEADERS + full 16+16 STANDINGS (real data); /game /player /team depth routes render + back nav; /highlights & /coldopen -> Unmatched Route; floating mic->/talk; TickerDesk PLAY->PAUSE single audio.
- Guarantees held: 0 legacy /api/segment, 0 /api/segments/, 0 permissions.query, 0 getUserMedia. Only 'segment' URL = /api/ticker/home_segment.

BEHIND LAUNCH (not started; do not begin without approval): Highlightly -> AI Play-by-Play -> Multilingual/Global.

## SECOND REAL LEAGUE — WHL "prove the pipe" cut [DONE, awaiting approval]
Goal: prove the universal chassis accepts league #2 with REAL data, NHL untouched. Scope = NEXT only.

DATA SOURCE (verified live): WHL via HockeyTech/Leaguestat — free PUBLIC key, no user key.
  base=https://lscluster.hockeytech.com/feed/index.php, feed=modulekit, key=f1aa699db3d81487, client_code=whl.
  (OHL client_code=ohl same key; QMJHL client_code=lhjmq key=f322673b6bcae299 — future.)

BACKEND
- NEW providers/whl.py WHLProvider(HockeyProvider): scoreboard_now (scorebar→canonical game cards, real logos assets.leaguestat.com), search (teamsbyseason + searchplayers, tagged league WHL), recent_finals_now (from scorebar finals). capabilities: schedule=T, search=T, recaps=T; standings/leaders/team_page/player_page/media=F (not wired this cut → hidden, no fake). game_by_id/latest_game/team_page/player_page raise (unused this cut).
- registry: _PROVIDERS now {nhl, whl}. /api/leagues shows both. search_all already aggregates all providers with capability search=True → WHL auto-included in universal onboarding search.
- server: /api/ticker/segment gained ?league= (next branch uses get_provider(league).scoreboard_now; cache key + fact sheet league-aware). NEW GET /api/league/{code}/scoreboard. ticker_recap.build_preview_fact_sheet now uses slate.league_name (default NHL) so WHL desk says "WHL".
- NHL routes/behaviour UNCHANGED.

FRONTEND
- follows.tsx: TeamFollow/PlayerFollow gained league?: string (additive). onboarding sets league from result.league_code → NHL + WHL follows coexist in one store.
- api.ts: leagues(), leagueScoreboard(code), tickerSegment(surface, subject?, league?).
- TickerDesk: optional league prop (fetch + cacheKey include league).
- TonightScreen (NEXT): NHL|WHL switcher (shown only when >1 league registered); league-aware scoreboard + desk. NHL keeps full GameDepth; WHL shows a light LiteMatchup card (no NHL deep links, no fabricated depth).
- Home/Recap/Stats/Team/Player/Game NOT wired for WHL (per scope). WHL follows on Home render as chips; backend home facts skip non-NHL gracefully (per-item try/except) so nothing breaks.

VERIFIED — testing_agent iteration_10.json: PASS
- Backend 9/9 (tests/test_whl_provider.py): leagues=nhl+whl; WHL scoreboard real games+logos; search mixes NHL+WHL (edmonton→Oilers+Oil Kings; regina→Regina Pats abbr REG; wheat→Brandon Wheat Kings); WHL next segment state=ready WHL-grounded; NHL regression 200.
- Frontend success test: onboard follow BOS(NHL fav ⭐)+REG(WHL) → Home shows both → NEXT → switch WHL → real WHL slate + Reggie/Marc desk grounded in WHL + LiteMatchup; switch back to NHL restores GameDepth. Desk PLAY→PAUSE. 0 permissions.query, 0 getUserMedia, 0 legacy /api/segment.

NEXT WAVES (behind launch, not started): expand WHL to Recap/Stats/Team/Player/Home → then Elite Prospects (Champions HL/Liiga/SHL, PAID key) → AI Play-by-Play → Multilingual.
Recon detail: /app/memory/second_league_recon.md


## WHL EXPANSION — league-level surfaces [DONE, awaiting approval; DEPTH pages next]
Scope delivered this cut (NHL untouched, no highlights/video, real WHL data only, missing modules hidden):
- HOME: NHL + WHL follows coexist (onboarding tags each follow with league); Home renders both as follow chips.
- NEXT: NHL|WHL switcher (from prior cut) — real WHL upcoming slate + WHL-grounded desk + LiteMatchup.
- RECAP: NHL|WHL switcher — real recent WHL finals rail + final-card + Reggie/Marc recap desk grounded in WHL finals (build_recap_show now league-aware).
- STATS: NHL|WHL switcher — real WHL Eastern/Western standings + real scoring/goalie leaders; "Where My Teams Sit" reflects followed WHL team.
Backend WHLProvider now real: standings_now (statviewfeed, division→Eastern/Western), leaders_now (topscorers/topgoalies), recent_finals_now (scorebar lookback), _active_season (picks the season containing today → preseason 294 now, so real data today). capabilities: schedule/search/recaps/standings/leaders=True; team_page/player_page/media=False.
Endpoints: /api/league/{code}/scoreboard|standings|leaders|recaps; /api/ticker/segment?league= (next+recap). Shared frontend LeagueSwitcher; TickerDesk gained league prop.

DEFERRED to the IMMEDIATE NEXT sub-cut (not built; depth links gated OFF for WHL so no dead ends):
- TEAM · PLAYER · GAME depth for WHL. Reason: HockeyTech roster/player/gamesummary shapes are season-dependent and need careful, no-fabrication mapping into the canonical team_page/player_page/Game shapes + league-param routing on /team /player /game. Will do as its own controlled cut.

VERIFIED — testing_agent iteration_11.json PASS: backend 20/20 (test_whl_league_surfaces.py + test_whl_provider.py); frontend all switchers real WHL data, desk grounded, HEAR THE RECAP gated off for WHL, WHL depth taps don't navigate; NHL fully unregressed; 0 permissions.query, 0 getUserMedia, 1 play only on deliberate desk-play, 0 legacy /api/segment.


## LIVE REGGIE + MARC — proof on TEAM + GAME (NHL + WHL) [DONE, awaiting approval to expand]
Rule: hosts present everywhere, speak ONLY on deliberate Play; ONE segment globally; no autoplay; capability-honest (say less when data is thinner); no fabrication.

BACKEND (ticker_recap.py + server.py):
- New grounded builders: build_team_desk(team_page, league_name) and build_game_desk(Game, league_name) — LLM writes Reggie/Marc dialogue from a deterministic verified fact sheet only; fallbacks if no LLM. Upcoming/no-scoring games are set up WITHOUT inventing score/goals/plays.
- /api/ticker/segment: added surface=team (fetch provider.team_page → build_team_desk); surface=game now league-aware (NHL keeps rich _recap_beats path; other leagues → build_game_desk). Both Mongo-cached (key includes league + status/record).

FRONTEND:
- Global audio session in src/lib/audio.ts + audio.web.ts: beginSession()/endSession()/currentSession()/subscribeSession(). beginSession stops any current audio + bumps session + notifies; only ONE segment can ever play.
- TickerDesk: replaced per-instance runRef with the global session token; other mounted desks reset their PLAY/ON-AIR UI when superseded; unmount stops audio only if it owns the session. Still one-panel, deliberate Play, no autoplay.
- TickerDesk embedded on app/team/[id].tsx (surface=team) and app/game/[id].tsx (surface=game), both league-aware via the ?league= param already threaded.

VERIFIED — testing_agent iteration_13.json PASS:
- Backend 10/10 (test_ticker_desk_surfaces.py): BOS/REG team desks grounded; NHL game rich; WHL upcoming game desk has NO score/goal/scorer language (regex-checked) → no fabrication; cache reuse; NHL regression clean.
- Frontend: all 4 (NHL Team/Game, WHL Team/Game) show ticker-desk + desk-play; 0 autoplay; maxConcurrent audio ≤ 1 across NHL Team→NHL Game→WHL Team→WHL Game (starting one stops the others); PAUSE immediate; NHL PLAY THE CALL + scoring/stars intact; WHL scoring/stars/PLAY THE CALL still hidden; 0 permissions.query, 0 getUserMedia, 0 legacy /api/segment.

NOT expanded yet (await approval): Home · Recap · Next · Stats · Player. No Highlightly/Sportlogiq/autoplay/new leagues.



## LIVE REGGIE + MARC — expanded to HOME · RECAP · NEXT · STATS (NHL + WHL) [DONE, verified]
Approved expansion of the proven TickerDesk system to the four primary tabs. Same rules: hosts present, speak ONLY on deliberate Play; ONE global audio session; no autoplay; one-panel; capability-honest; no fabrication. Team + Game desks preserved unchanged. Player desk NOT added (still deferred). No Highlightly/Sportlogiq/AI play-by-play/new leagues/redesign.

STATE FOUND: HOME, RECAP, NEXT already rendered the shared TickerDesk from earlier phases (surface=home personalized via POST /api/ticker/home_segment; surface=recap/next league-aware) and inherit the global-session behavior since it's the same component. Only STATS was missing a desk, and there was no `stats` backend surface.

NEW WORK:
- BACKEND ticker_recap.py: build_stats_desk(standings, leaders, league_name) + _stats_fact_sheet/_stats_fallback. Hosts INTERPRET the verified standings + stat leaders (conf leaders, tight vs runaway races, scoring/goal/assist/wins leaders) — every claim stays inside the numbers, no table-reading, no fabrication. WHL says less (lighter provider data).
- BACKEND server.py /api/ticker/segment: added surface=stats (provider.standings_now + leaders_now → build_stats_desk), Mongo-cached (key = top-east-team + top-scorer signature). segment_type="reaction" → "AROUND THE LEAGUE" tag.
- FRONTEND StatsScreen.tsx: mounted <TickerDesk surface="stats" league={league}/> as the top presence, right after LeagueSwitcher (league-aware NHL|WHL).

CRITICAL FIX (found in iteration_14): global one-audio-session broke ACROSS the primary tabs because app/index.tsx keeps every visited tab mounted (display:none/flex) — a superseded desk's <audio> never unmounted, and stopAudio() only tracked ONE module pointer → maxConcurrent=2. Fix: audio.web.ts + audio.ts now track EVERY created HTMLAudioElement / AudioPlayer in a module-level Set `live`; stopAudio() tears down all of them (pause+clear src+load on web; .remove() native) and clears the set. beginSession() calls stopAudio() synchronously before a new desk creates its element → at most one live audio ever.

VERIFIED — testing_agent iteration_14 (backend) + iteration_15 (frontend retest) PASS:
- Backend 27/27 (test_ticker_stats_surface.py 17 + test_ticker_desk_surfaces.py 10): stats nhl/whl ready + grounded (NHL refs McDavid/MacKinnon/Vasilevskiy/Colorado/Dallas/Carolina/Buffalo; WHL shorter, real Regina/leaders); home/recap/next/team/game regression ready; no fabricated scores in league-level desks; cache reuse.
- Frontend: ticker-desk + desk-play present on HOME/RECAP/NEXT/STATS (NHL+WHL) and Team/Game; ZERO autoplay (getUserMedia=0, permissions.query=0, playCalls=0 pre-tap, 0 legacy /api/segment); GLOBAL ONE-AUDIO-SESSION FIXED — STATS→HOME→RECAP→NEXT plays gave maxConcurrent=1; HOME→/team/BOS cross-stop maxConcurrent=1.

Reggie + Marc are now the presentation layer across the whole product. NOT touched next (per user): voice polish, Player desk, Highlightly/Sportlogiq.


## LIVE CONVERSATION — the fan JOINS the desk (TEAM PAGE proof, NHL + WHL) [DONE, verified]
User choices: Voice in / voice out · Claude Sonnet 4.6 · navigation + Follow both · compact live thread INSIDE the existing desk panel · Team page ONLY · Mute/Stop · preserve the one global audio session · both hosts share ONE conversation. Canonical vision saved to /app/memory/webbing_bible.md (§5 relationship + §7 every-question-does-something proven here).

BACKEND:
- ticker_converse.py: build_team_context(tp, league_name, league_code) → (verified fact sheet, whitelist of LINKABLE entities with refs P:/FP:/T:/G:/FT: and fully-resolved entity payloads). converse_turn(...) calls Claude Sonnet 4.6 (LlmChat, session_id=convo-<id>, system=HOST_BIBLE+webbing/grounding rules) and returns STRICT JSON {turns[], suggestions[]}; suggestions resolved ONLY against the whitelist → fabrication impossible. AFFIRM regex detects a verbal "yes".
- server.py POST /api/ticker/converse (multipart: subject, league, conversation_id?, text?, audio?): Whisper STT via emergentintegrations OpenAISpeechToText(EMERGENT_LLM_KEY).transcribe(path,response_format="text") for voice-in; loads/saves conversation history in db.conversations; a "yes" to a stored last_follow offer returns action.type=="follow" with entity; returns beats + suggestions + action + voices. Voice-out reuses /api/tts.

FRONTEND:
- src/lib/recorder.ts (native expo-audio useAudioRecorder + requestRecordingPermissionsAsync; mic ONLY on deliberate tap) and recorder.web.ts (browser MediaRecorder + getUserMedia; NOT expo-audio, protecting Safari) — same useVoiceRecorder() hook via file resolution.
- src/components/LiveDesk.tsx: mic ("TAP TO TALK"/"TAP TO SEND"), compact thread (last 4 exchanges, YOU/REGGIE/MARC), tappable suggestion chips (player/team/game → router.push; follow_team/follow_player → follows store, chip flips to "Following…"), discreet type fallback, Mute/Stop. Plays host beats through the SAME global session (beginSession/playDataUri/currentSession) — endSession() before recording. action.type=="follow" from voice-"yes" auto-applies.
- app/team/[id].tsx: LiveDesk mounted directly under TickerDesk in a connected deskGroup (one panel). app.json: NSMicrophoneUsageDescription + android RECORD_AUDIO.

VERIFIED — testing_agent iteration_16 PASS (backend 5/5 test_ticker_converse.py + frontend live):
- NHL BOS grounded (Pastrnak/Geekie/Swayman, ids validated vs /api/nhl/team/BOS); WHL REG grounded, suggestions restricted to team/game/follow_team (no roster → no player chips); Yes→follow returns entity.player_id 8477956; 400 on empty, 404 unknown team.
- Team page renders ticker-desk + live-desk as one block; entry playCalls=0/getUserMedia=0/permQuery=0 (no autoplay, no mic prompt); text path → thread + 3 grounded chips + host audio; Pastrnak chip → /player/8477956; follow chip → "Following…"+toast; mic tap → getUserMedia 0→1 (deliberate only); LiveDesk imported ONLY by team/[id].tsx (Home/Recap/Next/Stats/Game untouched).
- One-audio-session: passive desk-play → live send kills passive (pause fires); only one AUDIBLE stream (pause is synchronous). A transient probe count of 2 during handoff is a measurement artifact of play()'s async promise, not real double-audio — accepted for this proof.

FEATURES REQUIRING NATIVE BUILD: real voice-in/out is validated end-to-end on web via getUserMedia + browser Audio, but full native mic capture + background audio must be QA'd on an iOS/Android dev build (Expo Go / web preview can't fully validate native recording). Whisper accepts m4a (native) and webm (web).

NOT done (per scope): no spread beyond Team page; no Highlightly/Sportlogiq/AI play-by-play/new leagues/redesign; no autoplay change; no voice polish. Next per user: actually USE it, then decide pacing vs design vs data vs highlights.


## TEAM LIVE DESK — MERGE PLAY + TALK INTO ONE EXPERIENCE (Team page only) [DONE, verified]
User: the Team page's separate "PLAY THE DESK" + "TALK TO THE DESK" felt like two products with too much tapping. Merge into ONE continuous Reggie + Marc desk. One control set: PLAY · TALK · STOP. PLAY runs the grounded show and may continue with ONE webbed connection then end quietly. TALK = hands-free join (listen → detect end-of-speech → respond → listen again, no repeated tap-record/tap-send). User speech takes priority over the running show. STOP always immediately silences. Preserve global one-audio-session. Webbing restraint (1-2 connections, quiet endings). NO new providers / Player / Game convo / autoplay / pages / redesign / cleanup.

FRONTEND:
- NEW src/components/TeamDesk.tsx replaces the old TickerDesk(surface=team)+LiveDesk pair on the Team page. Reuses the exact desk panel visual (broadcast-desk image + gradient + REGGIE+MARC tag + ON AIR/LISTENING/THINKING status + mic level bar). Three controls: desk-play, desk-talk, desk-stop. Modes idle/show/convo via modeRef. playReply() claims beginSession token and checks currentSession() so any supersede stops it. startShow() plays the prepared team segment then ONE directive continuation (SHOW_CONTINUE) then quiet idle. startTalk() calls endSession() (user priority) → rec.openMic() → conversationLoop() (captureUtterance → converse(clip) → thread+chips+voice-yes-follow → playReply → listen again; 2 empty utterances end it). stopAll() = endSession+abort+closeMic. Compact thread (last 4) + webbing chips + Open-Settings on mic denial. LiveDesk.tsx now unused (left in place, not bundled).
- src/lib/recorder.web.ts REWRITTEN: hands-free useVoiceRecorder with Web-Audio AnalyserNode VAD (SPEECH_ON rms, 1.1s trailing silence ends utterance), openMic/closeMic/captureUtterance/abort, level meter. src/lib/recorder.ts REWRITTEN: native expo-audio with isMeteringEnabled + getStatus().metering dBFS VAD (same interface). Mic requested ONLY on deliberate TALK.

BACKEND:
- ticker_converse.py converse_turn(..., directive=False): directive mode frames the prompt as a producer cue ("the fan has NOT spoken"), not a fan question.
- server.py POST /api/ticker/converse: added `directive` form field. Directive turn (no text/audio) runs a continuation, returns user_text="" and does not require speech. Voice/text/follow paths unchanged.

VERIFIED — testing_agent iteration_17 PASS (backend 7/7 test_ticker_converse.py incl. new NHL+WHL directive cases; frontend live):
- ONE panel team-desk with desk-play/desk-talk/desk-stop; old live-desk/live-mic/text-input testIDs GONE; LiveDesk not imported by app/*.
- Entry: playCalls=0, getUserMedia=0, permissionsQuery=0 (no autoplay, no mic on entry).
- PLAY → audio + ON AIR + relabel SHOW; grounded directive continuation (Geekie 39G) + 1 connection chip. TALK → getUserMedia exactly once. TALK during PLAY → pauseCalls 0→1 (show stops before mic; user priority). STOP silences. One-audio-session: no audible overlap (transient probe count during rapid re-taps is the known play()-promise artifact; pause is synchronous).
- Regression: Home/Recap/Next/Stats/Game/Player unchanged.

CAVEATS: full hands-free VOICE round-trip (speak→Whisper→reply) needs a real device/mic — headless can't speak (backend correctness proven via pytest/curl). Native mic capture + background audio require an iOS/Android dev build to fully QA. Mic-denial "Open Settings" branch verified by source (headless auto-grants a fake stream).

NEXT per user: actually USE it before touching voices — then decide pacing vs page design vs data depth vs highlights.


## FIX — Live TALK "Couldn't reach the desk" on real device (iteration 17 field FAIL) [DONE, verified on public path]
Symptom: Kamloops Blazers Team Live Desk opened fine and TALK entered LISTENING hands-free, but after speaking it returned "Couldn't reach the desk." Headless never caught it (can't produce real speech).
ROOT CAUSE: /api/ticker/converse audio path 500'd (→ ingress 502 → frontend catch → "Couldn't reach the desk"). emergentintegrations OpenAISpeechToText.transcribe() forwards its `file` arg straight to litellm/OpenAI, which requires bytes / io.IOBase / PathLike / tuple — we passed a **str path**, so OpenAI raised "Expected entry at `file` to be bytes... received str". (_validate_audio_file accepts a str path, but litellm does not.)
FIX (server.py ticker_converse): open the temp file in binary and pass the FILE OBJECT — `with open(tmp_path,"rb") as fh: await stt.transcribe(fh, response_format="text")`. Added temporary stage logging ([converse] audio received bytes/filename + transcript). Also hardened web recorder (recorder.web.ts) to select a Whisper-friendly, browser-supported container via MediaRecorder.isTypeSupported (iOS Safari → audio/mp4) so the file extension matches the real bytes.
VERIFIED on the PUBLIC preview ingress (not just localhost/headless):
- POST /api/ticker/converse with a real speech clip (KAM/whl) → 200, transcript "How are the Blazers looking this season?", grounded Reggie+Marc reply, ~8s localhost / ~16s public.
- FRONTEND real path: /team/KAM?league=whl, fed real TTS speech into the mic via a getUserMedia override, tapped TALK → thread showed YOU (transcribed) + REGGIE + MARC (grounded 2-0-1, 11-11) + chips (Follow the Blazers, Next game vs PG, Last game vs PEN). Spoken round-trip COMPLETES on the Kamloops Blazers page.
UI unchanged (PLAY/TALK/STOP, one panel) per instruction — only the connection bug was fixed.
NOTE: native iOS/Android dev build still recommended for on-hardware mic capture QA; m4a (native) + mp4/webm (web) all accepted by Whisper.


## ITERATION 18 — Make Team Live Desk actually feel live (3 real-device fixes) [DONE; audio audibility pending device test]
1) TALK heard but desk didn't SPEAK (iOS). ROOT CAUSE: reply plays seconds after the tap (mic→STT→LLM→TTS); a fresh `new Audio().play()` is then blocked by iOS as "not a user gesture." FIX (audio.web.ts rewrite): playback now goes through ONE Web Audio AudioContext that is resumed inside the PLAY/TALK tap via new `unlockAudio()` (silent 1-sample buffer). playDataUri fetches→decodeAudioData→BufferSource on that unlocked context (with a playGen guard so a superseded decode never starts; <audio> fallback kept). audio.ts (native) gets a no-op unlockAudio. TeamDesk calls unlockAudio() at the top of startShow AND startTalk (inside the gesture).
2) Desk didn't know its own team. FIX (providers/whl.py team_page enriched with a real retrieval path): now fetches roster (view=roster → forwards/defensemen/goalies + coach), team scorers (statviewtype topscorers filtered by team_code, with G/A/P), and the last final's goal scorers (feed=gc&tab=gamesummary). Each block guarded → degrades honestly, never fabricates. ticker_converse.build_team_context surfaces coach, goalie tandem, "Goaltenders on the roster", and "Last game … Goals: Name (TEAM)…" + links players. CONVO_SYS grounding hardened: use the retrieved facts, NEVER tell the fan to check a website; if a specific number truly isn't present, say so and offer what we have.
3) Retrieval latency = dead air. FIX (TeamDesk): pre-synthesize a few content-free bridge clips (Reggie "let me pull that up" / Marc "one sec") on TALK start via /api/tts; playBridge() fires instantly when a turn begins processing so there's an immediate spoken acknowledgement while STT+LLM+TTS run; the real reply's beginSession supersedes it. Bridges never state a fact (can't be wrong); silence preferred over fabrication.

VERIFIED (real public/mobile path, not just headless):
- Root cause of the original "Couldn't reach the desk" (iteration 17 field FAIL) was ALSO fixed earlier: STT wrapper was handed a str path; now passes an open file handle. Public ingress audio converse → 200.
- WHL KAM team_page: coach Shaun Clouston; goalies Kaeden Tate, Logan Edmonstone; scorers Andrew Thomson 4pts, Collin Kim 3…; last game KAM 3 @ PEN 4 with goal scorers; roster 16F/9D/2G.
- Converse: "Who are their goalies this year?" → Tate + Edmonstone + coach; "Who scored last game?" → Penticton 4-3, Arnason/Coupland/Thomson, Katz x2 for the Vees — all grounded, no website punt.
- Real-path screenshot (/team/KAM?league=whl, real speech injected via getUserMedia): full round-trip, thread shows YOU + REGGIE + MARC, profile + Follow chips, ON AIR (Web Audio playback executing). Conversational context + continued listening intact.

CAVEAT: iOS/mobile-web AUDIBLE playback of the reply can only be finally confirmed on real hardware (headless has no speakers) — the unlock fix is the standard correct approach and the playback path executes without error. Native iOS/Android dev build still recommended for on-device mic + audio QA. UI unchanged (PLAY·TALK·STOP, one panel) per instruction.


## ITERATION 19 — make the Live Desk feel alive during retrieval [DONE, verified real path]
Iteration 18 confirmed working on real iPhone. PLAY·TALK·STOP frozen (no redesign). Three refinements:
1) FILL retrieval time naturally (varied, grounded). NEW GET /api/ticker/bridges?subject&league → build_bridge_lines(tp): short VERIFIED one-liners from already-loaded facts (record, division rank, GF/GA, coach) + a couple content-free host lines. Frontend TeamDesk.primeBridges() fetches these on TALK start, shuffles, TTSes 3 in the right host voice; playBridge() speaks a random one the instant a turn starts processing → no dead air, and NOT "let me pull that up" every time. Never states an unknown fact.
2) ELABORATE once the answer arrives. CONVO_SYS updated: answer FIRST, then add 1-2 verified context points (related player/standing/form/meaning); 1-5 short beats; conversational, not a DB response. Verified: "how big is their D?" → honest "no measurements" + Marc names the D corps + Reggie ties it to 11 GA in 4 games / top of division. No fabrication.
3) MULTI-SOURCE RETRIEVAL LAYER (the architecture ask). NEW backend/retrieval.py: EnrichmentSource ABC (supports/enrich_team) + ENRICHMENT_SOURCES registry + assemble_team_context(provider, league, subject) = primary team_page merged (additive, gap-filling, never overwrites verified) with every applicable source. build_team_context now renders a "Player bios:" line (height/weight/age/shoots) from tp.player_bio when present, so richer data → richer desk automatically with ZERO Live Desk changes. EliteProspectsSource stub REGISTERED but INERT until ELITEPROSPECTS_API_KEY set (supports whl/chl/ohl/qmjhl/ncaa); documents the player_bio merge contract. converse + bridges both go through assemble_team_context (desk no longer hard-wired to one league feed).

VERIFIED (localhost + real public path):
- /api/ticker/bridges KAM/whl → 6 grounded varied lines (2-0-1, #1 B.C. Division, 11-11, Shaun Clouston).
- Real-path screenshot /team/KAM?league=whl: voice "how big is their defense?" → 3-beat layered answer (honest + D corps names + standing context) + chips + ON AIR. Round-trip + continued listening intact.
- WHL retrieval (iter18) still rich: coach, goalies, scorers, last-game scorers.
EP READINESS (business note only, no code owed): the layer accepts Elite Prospects by implementing EliteProspectsSource.enrich_team() + setting a key; when it returns player_bio, D-line size / age / history questions answer automatically. Good moment to engage Ed at EP — the conversational desk is live and shows exactly where EP data unlocks the next level. (Contacting EP is a human/business action, not implemented here.)

## Jun 2026 — Highlightly Utilization Audit (read-only)
Live Desk V1 frozen (awaiting Elite Prospects). Audited Highlightly plan capability vs Ticker ingest/display.
HEADLINE: Ticker ingests ZERO Highlightly data — runs on free NHL public API + HockeyTech(WHL/OHL/QMJHL). No key/client/calls (grep-clean).
Video/highlights: media=False on every provider; nothing ingested or shown. AHL/ECHL/USHL/NCAA/PWHL not connected to any provider.
Highlightly offers video highlights + scores/standings/momentum/match-stats across 170+ leagues incl AHL/ECHL/WHL/OHL/QMJHL/NCAA. Weak on play-by-play/lineups/injuries.
Pricing = calls not depth: all paid tiers same data; 5k->25k only raises daily ceiling. Major-league highlights need a PAID tier (RapidAPI basic excludes NHL/AHL/OHL/NCAA highlights).
Full report: /app/memory/highlightly_audit.md. No code changed.

## Jun 2026 — Highlightly Universal Rollout + Game-Centered Video (BUILT, tested PASS)
Highlightly Pro key (7,500/day) wired via backend/highlightly.py — ONE universal adapter + HL_LEAGUES registry (nhl/ahl/echl/whl/ohl/qmjhl/ncaa). Additive to NHL API + HockeyTech (never overwrites verified data). In-memory TTL cache (15m) keeps us well under 7,500/day.
Endpoints: GET /api/highlights?league=&limit= (league feed), GET /api/highlights/match?league=&home=&away=&date= (game package: recap + clips, nickname+date matcher, disambiguates playoff series by date). /api/leagues now reports capabilities.video.
Frontend: HighlightsModule (video-first) on final game pages, ABOVE the Reggie+Marc GAME DESK — recap hero + 'more from this matchup' rail + 'Verified video · Highlightly'. Native inline youtube player (react-native-youtube-iframe) isolated behind YoutubeInline.web.tsx so web bundle stays intact; web taps open verified source via Linking. Renders nothing when no clip matched (no placeholders).
PROOF: NHL Cup Final Game 6 (Carolina@Vegas, id 2025030416) -> exact recap yt=3jbQ58HKtXA in the game package. All 7 league IDs resolve real clips. Testing agent iteration_18.json PASS (backend 5/5 + frontend web). Live Desk PLAY/TALK/STOP FROZEN and untouched (Kamloops bridges still return 6 grounded lines).
POPULATED NOW: NHL game packages (rich, Cup Final live) + WHL (preseason started). AHL/ECHL/OHL/QMJHL/NCAA video is connected + matches at the adapter, and will surface in the on-screen game package the moment each league's SCORES/game provider is registered (per-league registration, not a rebuild). Elite Prospects enrichment stub still pending EP key.

## Jun 2026 — Team Page Navigation + Energy + Performance (BUILT, tested PASS iteration_19)
Test case Prince George Cougars (WHL PG). All 5 asks delivered:
1. NAVIGATION: breadcrumb 'WHL > B.C. Division > Cougars' (chips -> new reusable /league/[code] hub; division param floats that division to top). Next-game opponent individually tappable -> team; card -> game. New 'Around the {division}' horizontal rail -> every rival team (Kamloops etc). Scorers/goalie/roster -> player. Recent/Last Game -> game. League->Division->Team->Game->Player all reachable, sideways movement everywhere.
2. DESK SAFE ZONE: added protected lower-third scrim + 1-line title (faces readable, title off faces, PLAY/TALK/STOP fully visible/tappable). NO change to Live Desk interaction (frozen).
3. ENERGY: replaced big GF/GA/DIFF grid with a compact season strip; story order desk->read->strip->next->people->last game (Highlightly video)->recent->division->roster.
4. EARLY-SEASON INTELLIGENCE (generic via record.gp): gp<10 shows 'X-Y to start the season' and hides LAST 10; gp>=10 shows RECORD + LAST 10. Fixed the '(0-2-0-0) last 10' bug.
5. PERFORMANCE: WHL team_page parallelized (asyncio.gather scorebar/roster/scorers) + cached season(1h)+team_page(90s) -> PG 1.54s->1.16s cold, 0.01s warm. Frontend cache.ts loadTeam/prefetchTeam (60s) + prefetch on pressIn -> team<->team hops instant.
Backend added division_teams + record.gp + scorers[].gp to WHL team_page; division_teams to NHL team_page (parity, Pacific=8). New files: frontend/src/lib/cache.ts, frontend/app/league/[code].tsx. Testing iteration_19.json PASS (backend 10/10, frontend 7/7). Live Desk PLAY/TALK/STOP untouched.

## Jun 2026 — Highlight inline-playback fix (web/mobile-Safari)
Prior web path opened youtube.com via Linking (bounced out of Ticker = failure). Fixed: HighlightsModule now always opens the in-app modal; YoutubeInline.web.tsx renders a raw inline <iframe> (react-native-web -> react-dom) so verified highlights play INSIDE Ticker on web too; native still uses react-native-youtube-iframe inline. Verified on /game/2025030416: tap hero -> inline player, URL stays on Ticker (not youtube.com).

## Jun 2026 — Provider keys stored + health check
Elite Prospects key stored (ELITEPROSPECTS_API_KEY, auth ?apiKey=, base https://api.eliteprospects.com/v1) — validated LIVE (1566 leagues). Not yet feeding the desk (EP data build still to be scoped); retrieval EliteProspectsSource.supports() now true but enrich_team still returns {} (harmless, no fabrication).
No provider exposes an expiry DATE. Added GET /api/health/keys: reports live/dead + quota for Highlightly (Pro 7500/day), Elite Prospects, ElevenLabs (TTS-only scoped key — valid for desk voices, lacks voices_read/quota scope), Emergent LLM (managed, balance-based). A key flipping to live:false = expired/revoked = the signal to renew.

## Jun 2026 — Elite Prospects wired in (cached development allowance, BUILT + verified)
Goal: prove what EP adds beyond Highlightly using the 1,000/mo Basic tier as a DEV allowance, cache everything.
- backend/eliteprospects.py: self-contained cached client. Auth ?apiKey=, base /v1. PERSISTENT Mongo cache (ep_cache, 30d TTL) + per-process hot cache + negative-cache (7d). Monthly usage counter (ep_usage). Only counts REAL upstream calls; re-views cost 0 (verified: repeat lookup left usage unchanged).
- Free-tier reality: player DETAIL endpoint is rich (bio, height/weight/shoots/age, birthplace, youthTeam, draftSelection, nhlRights, leagueExperience=career path, playerStyles, biography). Transfers + season-stats endpoints are 403 on free tier (skipped gracefully).
- player_by_name(name,pos): 1 search + 1 detail first time, cached after. Normalized profile.
- Endpoints: GET /api/ep/player?name=&pos= (on-demand profile), GET /api/ep/usage (calls used/1000 + cached count), EP usage folded into /api/health/keys.
- Player page (NHL): /api/nhl/player attaches `ep`; frontend renders a 'Background' card (draft, NHL rights, born, youth, frame, play-style chips, career path, bio, 'via Elite Prospects'). Verified on McDavid (2015 #1 Edmonton, path U16→OHL→WJC, styles).
- Live Desk SMARTER: /api/ticker/converse appends eliteprospects.scorer_backgrounds(tp) (top 3 scorers, cached) to the fact sheet. Verified Kamloops: desk answered 'how big is their top scorer?' with Andrew Thomson 6'1" 192, age 19, Sherwood Park AB — data only EP has. This closes the old size/bio gap.
- Frugal: all build+test used only ~10 of 1000 calls. PLAY·TALK·STOP interaction unchanged (frozen); only fact-sheet CONTENT enriched.

## Jun 2026 — HOME SPORTS DESK (auto-advancing personalized show) BUILT + tested PASS (iteration_20)
Approved 1a/2a/3a/4b. New POST /api/ticker/home_show: personalized rundown from Draft Board (NHL + followed junior blended), ONE Claude call scripts all story beats (cached db.segments), highlightly.find_team_clip attaches inline clip when available. Added league field to FollowItem. New frontend HomeShow.tsx replaces passive TickerDesk on Home: NOTHING autoplays on open; ONE tap PLAY MY SHOW -> auto-advances story->beats(TTS)->inline highlight(YoutubeInline, 30s hold, stays in-app)->stat graphic->next; TALK joins hands-free (converse for current story); STOP silences. Verified: onboarded KAM(whl)+EDM(nhl) -> Kamloops Blazers story leads beside Oilers/McDavid; auto-advance + STOP confirmed; video stays in-app. Fixed onboarding duplicate-key by de-duping search_all by (type,id). Team Live Desk untouched (frozen).

## Jun 2026 — Home Sports Desk editorial refinements
(1) Not an echo chamber: even with follows, ONE genuinely major NHL story can BREAK IN (gated to a notable final that actually has a Highlightly clip), inserted after your follows lead. Marked breaking:true, red kicker tag. Verified: follow only KAM(whl) -> story 1 Kamloops Blazers, story 2 [BREAKING] Hurricanes shut out Golden Knights.
(2) TALK pause/resume: pressing TALK pauses the show (endSession), hosts answer in the current story context via converse; when you go quiet the show RESUMES from the next story (resumeIdxRef). STOP still ends. Team Live Desk still frozen; no other pages touched.

## Jun 2026 — Provider breadth (items 1,2,4) BUILT + verified. NCAA held.
Item 4: Generalized WHL adapter -> HockeyTechProvider(code,name,client_code,key) with per-instance _common/_team_index/_active_season + per-instance caches (no module globals). Registered whl + ohl(client_code=ohl) + qmjhl(client_code=lhjmq,key=f322673b6bcae299). Verified REAL data: WHL 24, OHL 22, QMJHL 18 teams; search 'Barrie'->OHL, 'Islanders'->QMJHL Charlottetown. Fixed search league-label bug (was hardcoded 'whl' for all) -> now self.code.
Item 1: My Ticker (_home_personal_facts) + My Hockey feed player loop now use get_provider(follow.league).team_page/player_page instead of hardcoded nhl.* -> followed WHL/OHL/QMJHL teams/players flow through (verified home_show resolves MTL+KAM+BAR by real provider).
Item 2: Cross-league player page. Frontend player/[id] reads league+name+pos params, calls /league/{code}/player for non-nhl. Backend league_player is EP-backed (HockeyTech has no player stats): builds identity + EP profile (bio/draft/career/styles), league-agnostic, cached. Team-page scorers pass name+pos. Verified OHL Michael Misa -> EP 2025 #2 San Jose. NHL player route already EP-enriched. No unnecessary EP calls (30d cache intact).
Preserved: Home Sports Desk, PLAY/TALK/STOP, NEXT unchanged. No NCAA/AHL/ECHL. Reggie & Marc remain network hosts; only context changes by league (proven on OHL Barrie page).
ACCEPTANCE MET: Montreal(NHL)+Kamloops(WHL)+Barrie(OHL)+Charlottetown(QMJHL)+players across leagues all found/followed/resolved via correct provider, no NHL hardcoding.

## Jun 2026 — NCAA provider + OHL/QMJHL LIVE. Cross-league Draft Board proven. NCAA held→approved(thin).
5 leagues registered: nhl, whl, ohl, qmjhl, ncaa.
NCAA (providers/ncaa.py) = HONEST THIN: Highlightly for structure (62 teams, 6 conferences standings, schedule/scores via /matches paged 100s, game state, video) + Elite Prospects for people (name search via eliteprospects.search_players cached + bio/draft/career player pages). NO rosters, NO team scorers, NO GF/GA, NO logos — all GRACEFULLY OMITTED, never faked. School-name ALIAS/code layer (DEN/MICH/MINN/BU + heuristic) keeps Highlightly numeric ids separate from canonical codes; collisions get X suffix (MICHX=Michigan Tech, MINNX=Minnesota State).
highlightly.py: added _season (offseason-safe, picks latest season WITH standings, cached 24h), standings(), matches() (paged, cached 15m).
Frontend: NhlLogo monogram fallback on img error (NCAA null logos never show wrong NHL crest). team/[id] hides GF/GA/DIFF strip when goals null + hides PTS when points null (NCAA). player/[id] already league-aware (EP-backed non-nhl).
BUG FIXED (iteration 21): QMJHL/LHJMQ feed uses MIXED-CASE abbrs (Hal, BaC, VdO). team_page uppercased only the key, not stored abbrs -> ValueError/502 + QMJHL dropped from home_show. Fix: normalize ALL HockeyTech abbrs to .upper() at every source (_side, _team_index, standings, search, scorers) + case-insensitive compares. Idempotent for WHL/OHL. Verified: Hal/Cha/Gat team pages OK, home_show 5 stories incl QMJHL, /team/HAL frontend renders (4-1, 8 PTS, HAL@CAP, Leading the Way).
Verified end-to-end (curl + screenshots): search Denver/Michigan/Minnesota/BU->NCAA, Barrie->OHL, Halifax->QMJHL, Celebrini->EP. NCAA team DEN 20-1 #1 NCHC (goals null, scorers [], recent finals WIS 1@DEN 2, game has_video True). Mixed 5-league My Ticker + Home Show personalize with no NHL-hardcode drop. Frontend: Denver (monogram, no GF/GA, no Leading-the-Way, inline Frozen Four video), Barrie, Halifax all render.
PRESERVED: Home Sports Desk, Team Live Desk PLAY/TALK/STOP, NEXT behavior — untouched. NO AHL/ECHL. FREEZE provider breadth here per user; next = phone experience + My Ticker breadth-vs-depth architecture.

## Jun 2026 — NAV PASS ONE: persistent Ticker shell restored (approved architecture map first). No league redesign.
Problem (phone-confirmed): entering any detail route (league/team/player/game/recap) dropped the whole Ticker nav — only Back remained.
Fix (shared architecture, not per-page buttons): src/components/ui.tsx Screen now renders a persistent OutRail (HOME·RECAP·NEXT·STATS; testIDs out-home/out-recap/out-tonight/out-stats — NEXT tab key='tonight'). Tapping calls goToTab(key) then router.dismissAll() (fallback navigate('/')) to reveal the tab host on the chosen tab. All 5 detail routes use Screen -> all get the rail; HomeScreen uses TabScreen (no double rail). Back retained.
tabnav.ts: queues the requested tab when the host isn't mounted (deep-link OUT tap) and replays on setTabHandler -> shell always lands on the chosen tab.
Contextual web preserved + strengthened: NHL/Atlantic breadcrumbs already tappable; player->team, player->next/last5 game now carry ?league (no more non-NHL dead ends); Stats league leaders un-gated for non-NHL (openPlayer league-aware with name/pos). NO league-page redesign (deferred).
Testing agent iteration_22: PASS in natural in-app flow — rail present on team/league/player/game; out-stats/out-home escape detail and activate the right tab; breadcrumbs + player/game taps work; Back intact; top tabs switch. Non-blocker noted: last scroll row can sit flush under rail on 390x844 (cosmetic, deferred).
STILL DEFERRED (net-new destinations, next passes): Conference/Division as a first-class destination; CHL parent-competition surface + backend grouping; league-WORLD redesign (host/show, not standings); team-page identity hierarchy; depth-vs-breadth + intentional NEXT.

## Jun 2026 — NAV PASS TWO: context-aware tabs (no silent NHL fallback). VERIFIED.
Problem: OUT rail existed but RECAP/NEXT/STATS each used useState('nhl') and ignored the league the user was in.
Fix: src/lib/context.ts session store (getContextLeague/setContextLeague/subscribe + useContextLeague hook). Detail routes league/team/player/game set setContextLeague(lg) on mount (recap->nhl); the 3 context tabs use useContextLeague() so they inherit the current league; a tab's own switcher also updates context. HOME stays global. Context carried by stable ?league id + team/player/game ids — never by city name (no 'Boston' ambiguity, no NHL fallback).
Also fixed NEXT hardcoded 'WHL' label -> league.toUpperCase() (LiteMatchup now takes league).
Testing agent iteration_23: PASS all 5 leagues (WHL/NCAA/OHL/QMJHL/NHL) — enter team -> out-recap/out-tonight/out-stats inherit that league, zero NHL fallback; OUT rail + Back on team/league routes; HOME global; top tabs switch.
STILL DEFERRED: Conference/Division first-class destination; CHL parent surface + backend grouping; league-WORLD redesign; team-page identity hierarchy; depth-vs-breadth + intentional NEXT.
