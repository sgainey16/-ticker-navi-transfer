# THE TICKER — Connected-Product Review (in progress)

Purpose: walk the connected NHL product as a user (Home → Recap → Next → Scores → Game → Team → Player) and record findings. No building during the review unless explicitly approved.

Severity legend: 🔴 RED (breaks the intended Ticker experience) · 🟡 YELLOW (dull / needs polish) · 🟢 GREEN (feels like The Ticker)

---

## 🔴 RED-1 — SHOW LAYER IS TOO PASSIVE (Recap & Next)
Status: RECORDED ONLY — DO NOT IMPLEMENT YET. Decide exact show behavior after the full review.

The underlying NHL pages, data, and navigation are becoming strong, but the automatic Reggie + Marc **show layer** is currently too passive. Tapping RECAP/NEXT does not yet feel like tuning into The Ticker.

### Recap (current vs intended)
- Current: user enters Recap, browses/selects a game, scrolls, deliberately presses play/hear recap, then reaches the Reggie + Marc game conversation. Functional, but not the intended experience.
- Intended: Tap RECAP → immediately feel like you tuned into The Ticker.
  - A ready/prebuilt **league-level Recap Show** from Reggie + Marc establishes what happened across the user's hockey world.
  - SHOW → BROWSE → DEPTH: the show stays active while the user horizontally browses games. Selecting a game changes the contextual info below **without automatically restarting audio**. A deliberate action then transitions into the deeper prebuilt game recap.

### Next (current vs intended)
- Current: NEXT feels inactive when there are no NHL games today.
- Intended: a ready/prebuilt Reggie + Marc **what's-coming show segment** based on the actual upcoming schedule. If no games today, they naturally explain what's coming next rather than leaving the page dormant.

### Segment model to preserve (for the eventual fix)
- **Recap Show** — league/user-level prebuilt segment
- **Next Show** — upcoming-hockey prebuilt segment
- **Selected Game Recap** — deeper game-specific prebuilt segment
- **Talk** — genuinely live/on-demand Reggie + Marc conversation
- Use caching / pre-production intelligently so ordinary browsing does NOT repeatedly trigger LLM/TTS generation.

### Constraint
Do not redesign Recap or Next yet. Continue the connected review only.

---

## 🟢 GREEN-1 — REGGIE + MARC SPORTS DESK PANEL
Status: WORKING WELL — PRESERVE. Do not remove or redesign.

The current Reggie + Marc visual panel is working and gives the product its sports-desk identity. Having it consistently present across Home, Recap, Next, and the deeper hockey pages makes The Ticker feel like a connected sports desk/show rather than a collection of sports-data pages. It should become one of the visual signatures of the product.

- Keep the panel. Preserve the **one-panel rule**: one clear Reggie + Marc visual presence at a time — no small avatars piled on top, no large transcripts over the art.
- This is distinct from RED-1: RED-1 is about the missing/too-passive automatic show/segment behavior, NOT the visual desk panel.

Direction: **keep the desk, make the desk come alive.**

---

## REVIEW STANDARD (apply to every screen)
> Does this screen feel like I just tuned into **The Ticker** — or does it feel like I opened a sports app?

This single question exposes most of what still needs attention. Foundation is healthy; most remaining issues are **presentation & programming-layer** problems sitting on top of a working foundation — not architecture failures.

Discipline: do NOT fix randomly. Finish the walkthrough, build ONE punch list, prioritize, then execute one controlled change at a time.

---

## PUNCH-LIST BUCKETS (working draft)

### Bucket 1 — Core Ticker Show 🔴 RED
Reggie & Marc must feel alive on entering Recap and Next. The prebuilt/cached show segments are missing. (See RED-1.)

### Bucket 2 — Old MARSL Residue 🔴 RED
Reels, Stats, Rayo, MASL players/content, and any remaining soccer/demo material must be either properly converted or removed from launch navigation.

### Bucket 3 — Audio Presentation 🟡/🔴 YELLOW→RED
Voices work, but the game call renders as a large transcript/chat-log feed. Needs sports-show presentation, not chat-log presentation.

#### Clarification from the current Game-Call screen (RED — for later audio remediation)
The Game Call proves the grounded script/audio pipeline works — REUSE that capability, but do NOT adopt its presentation as the desk UI. For the later audio-presentation step:
- Do NOT replicate stacked Reggie/Marc dialogue cards.
- Do NOT repeat "Instigator/Guardian" labels throughout.
- Do NOT make written transcripts the primary representation of the show.
- Preserve the working grounded script/audio pipeline.

Target hierarchy (what Step 1 restores): **ENTER → DESK/SHOW → BROWSE → SELECTED CONTEXT → OPTIONAL GAME DEPTH** — NOT ENTER → BROWSE → OPEN GAME → TRANSCRIPT → PLAY. The desk must move UP into the primary surface; Reggie & Marc come to meet the user rather than making them drill down. (Game Call screen itself is NOT to be redesigned in Step 1.)

### Bucket 4 — Connected NHL Product 🟢 GREEN (protect)
Real NHL data, scores, schedules, horizontal browsing, Game → Team → Player connections, logos, and the dark sports-desk chassis are working and worth protecting.

---

## 🟢 CORE PRODUCT DIRECTION — MAXIMIZE THE SPORTS DESK
Status: PRODUCT DIRECTION ONLY — DO NOT IMPLEMENT YET. Continue the review.

Do not treat Reggie + Marc as something reserved primarily for Home/Recap. They are the **persistent presence** of The Ticker. Their **intensity and behavior change by context; their presence does not.** Do not separate "show surfaces" from "utility surfaces" — that would sand off what makes the product different.

Same sports desk, different depth/behavior by location:
- **Home** → run the hockey desk
- **Recap** → host the postgame show
- **Next** → preview what's coming
- **Scores** → react / contextualize the slate (short observations, not narrating every score)
- **Game** → discuss that game
- **Team** → discuss that team
- **Player** → discuss that player

Constraints (unchanged):
- This does NOT mean nonstop audio, duplicate panels, large transcripts, or constant AI generation.
- Preserve the **one-panel rule** and use **prebuilt/cached contextual segments**. Persistent presence = desk is there + a short prebuilt take is ready + the user decides whether to listen/engage.
- Long-term direction is to **expand** Reggie + Marc's abilities (more conversation, richer context, highlights, Sportlogiq intelligence, personalized discussion) rather than minimize their presence — without changing the fundamental product experience.

Guiding principle: **MAXIMIZE THE SPORTS DESK VIBE.**
> Without Reggie and Marc, we can build a very competent hockey app. With them persistently inhabiting the hockey world, we have The Ticker.

---

## CONNECTED REVIEW — SCOPE UPDATE (consolidated findings)
The screenshots make clear substantial **experience** work remains. Do NOT interpret the working NHL architecture as a finished MVP experience. The plumbing is ahead of the product experience — but this is presentation/programming-layer work, NOT another rebuild. The canonical NHL foundation is doing its job.

### Major RED areas
- **🔴 RECAP** — Too flat/passive on entry. Must feel like tuning into a Reggie + Marc **postgame show**, not opening a list of completed games and hunting for Play.
- **🔴 NEXT** — Accurate schedule utility, but lacks the active sports-desk experience. Reggie + Marc need a context-appropriate **upcoming-hockey presence even when there are no games today.**
- **🔴 REELS / HIGHLIGHTS** — Still visibly MARSL/indoor-soccer. Not acceptable as a Ticker launch surface. Do not fix yet; classify for **conversion/removal** decision.
- **🔴 STATS** — Still visibly MARSL/indoor-soccer. Not a Ticker launch surface in current form.

### Yellow/Red
- **🟡/🔴 HOME** — Real NHL data + horizontal browsing work, but Home and Recap feel too **structurally similar.** Home needs a clearer identity as **"My Ticker / what's happening in my hockey world"**; Recap is **"what happened."**
- **🟡/🔴 AUDIO PRESENTATION** — Voices work, but game-specific playback becomes a large **transcript/chat-log**. Direction: feel like a **sports broadcast**, with substantially less text dominating the screen.

### 🟢 GREEN — PROTECT
Canonical NHL architecture · Real NHL data · Game → Team → Player connectivity · Horizontal browse interaction · Dark Ticker chassis · Reggie + Marc desk artwork · One-panel rule · Capability-driven rich modules.

### CORE DIRECTION
**MAXIMIZE THE SPORTS DESK.** Reggie + Marc remain present across the product; behavior/intensity changes with context, presence does not. **Keep the desk. Make the desk come alive.**

### MODE
REVIEW-ONLY. Do not start fixing items individually. No features, leagues, Highlightly, Sportlogiq, or new architecture. These findings become ONE ordered remediation plan, executed one controlled change at a time.

### NEXT STEP (change of gears)
Stop hunting individual defects. Define what each surface is supposed to **feel like** — especially what Reggie & Marc are doing on each: Home, Recap, Next, Scores, Reels/Highlights, Stats, Game, Team, Player. Lock that first; then Emergent works down the screens without redesigning mid-build.

---

# THE TICKER — EXPERIENCE SPEC (LOCKED, review direction only)
Each page has a distinct job; Reggie & Marc make all of them feel like ONE continuous sports desk.

| Surface | Its job | Reggie + Marc's job |
|---|---|---|
| **Home / My Ticker** | What's happening in MY hockey world? Personalized command center: followed teams, players, important games/moments, what's next. | Run my personal sports desk. Prioritize what matters to me. |
| **Recap** | What happened? Postgame show first, then horizontal browsing and game depth. | Open with a ready-to-play recap show, hit the night's stories, then transition naturally into selected games. |
| **Next** | What's coming? Upcoming games and stories — not merely tonight. | Preview the hockey ahead. Even on an off-day, there's something useful to talk about. |
| **Scores** | What's happening / what were the results? Fastest factual surface. | Stay present but lighter. React to meaningful results, surprises and slate context without slowing score checking. |
| **Highlights / Reels** | Show me the hockey. Eventually personalized by team/player/game and provider capability. | Introduce/contextualize packages and moments. Never manufacture video where rights/data don't support it. |
| **Stats** | Help me understand the numbers. Useful hockey intelligence, not spreadsheet dumping. | Translate numbers into hockey meaning. People first, numbers second. |
| **Game** | Tell me everything important about this game. | Become the game desk: what happened, why, key people/moments, with deeper recap available. |
| **Team** | Tell me about this team right now. | Team desk: form, people driving it, story, recent/next. |
| **Player** | Tell me about this player right now. | Player desk: performance, recent story, team context; eventually individual highlight packages where supported. |

## UNIFYING BEHAVIOR — SHOW → BROWSE → DEPTH → TALK
- **SHOW:** Reggie and Marc establish context.
- **BROWSE:** move horizontally through the hockey without constantly navigating away or restarting them.
- **DEPTH:** deliberately go deeper into a game/team/player/stat/highlight.
- **TALK:** actively engage Reggie and Marc for anything beyond the prebuilt experience.

## LOCKED PRINCIPLE — FUNCTIONAL SIMPLICITY ≠ ENTERTAINMENT SIMPLICITY
Underneath, The Ticker can be a very conventional sports app. On top, it should feel like a **living sports network.** Keep Scores fast, Team useful, Player clean, Game factual — WITHOUT removing the desk, personality, horizontal movement, and sense of programming that make them Ticker surfaces.

## PRELIMINARY REMEDIATION ORDER (to be finalized before any build)
1. Global sports-desk / show behavior
2. Recap
3. Home
4. Next
5. Remove/convert MARSL surfaces (Reels/Highlights, Stats)
6. Audio presentation
7. Scores / Game / Team / Player refinement

Rationale: restore the connective show behavior FIRST; do not polish individual pages before the thing that connects them all is back.

---

# STEP 3 HOME — FOLLOW-HIERARCHY AUDIT (read-only) + PROPOSAL
Home's identity is corrected to **MY HOCKEY WORLD**, organized by ranked follows (1ST / 2ND / 3RD STAR), which also weight what Reggie + Marc lead with. Audited the current build before proposing. NO Home changes made.

## What already exists (reusable)
- **Visual pattern only — `src/components/StarSpotlight.tsx`**: a MASL-era "STARS OF THE LEAGUE" card set with exactly the 1/2/3 ranking visual language (rank watermark, gold/blue/green accents, team logo + player identity + stat + tagline). It is **editorial MASL content**, fed by `api.stars()` -> `GET /api/stars` -> `masl_data.stars()` (hard-coded MASL players). Currently rendered ONLY inside `StatsScreen.tsx`. Reusable as a VISUAL TEMPLATE for the Star tiers; its DATA is fake MASL and must not be used.
- **Persistence infra — `src/utils/storage/index.ts`**: generic AsyncStorage (`getItem/setItem/removeItem`) + SecureStore helpers. Ready to hold follows locally. No follow keys defined today.
- **Canonical IDs everywhere**: real NHL `team abbr/id` and `player_id` flow through Team, Player, scorers, rosters, game data — follows can key directly on these.

## What does NOT exist (nothing to restore)
- No backend user / follow / favorite / preference / profile / onboarding model or Mongo collection (grep clean).
- No ranking / 1st-2nd-3rd Star personal-follow persistence anywhere.
- No onboarding flow.
- The only "stars" in the build is MASL editorial, NOT personal follows.
Conclusion: there is no prior personal follow hierarchy hiding in this fork — only a reusable visual pattern + storage infra + real IDs.

## Smallest proposed implementation (NOT yet built — for approval)
1. **Follows store (local-first):** reuse `storage` util; one key `ticker.follows` = `{ teams:[{abbr, tier}], players:[{player_id, team_abbr, tier}] }`, tier in {1,2,3}. No backend user system / no auth needed yet.
2. **Home identity:** reorganize Home as MY HOCKEY WORLD — 1ST/2ND/3RD STAR clusters using team logos + compact player identity (team colors/initials), horizontal rails, reusing the StarSpotlight visual language rebuilt on real NHL data. Tap team -> Team, player -> Player.
3. **Desk intelligence:** extend `/ticker/segment?surface=home` to accept the ranked follows and weight the opening show 1st > 2nd > 3rd > league, grounded on verified data for those teams/players (reuse team_page/player_page/scoreboard). If no follows exist -> current honest league opening (already built).
4. **Honesty:** when follows are empty, Home shows the league fallback (today's behavior) and the desk does not fake "your team." No hard-coded favorites.
5. **Deferred (NOT this step):** onboarding UI, a full follow-management surface, backend per-user storage/auth. A minimal "follow at tier" affordance on Team/Player could be the smallest way to populate real follows — flag for the user to decide.

STOP: awaiting approval on the proposal before modifying Home.

---

# SEQUENCE CHANGE — ONBOARDING FIRST (audit + proposal, read-only)
New order: Onboarding -> Follow hierarchy (Stars) -> Home rebuilt from real follows -> rest of remediation. NO build yet.

## Audit — what exists
- **No onboarding anywhere.** `app/` routes are: index, coldopen, talk, voices, game/[id], player/[id], recap/[id], team/[id], highlights/[id]. No welcome/intro/wizard/stepper/picker/multi-select components exist (grep hits were false positives inside existing screens). Nothing to reuse structurally.
- **Team data for a picker EXISTS:** `GET /api/nhl/standings` (`nhl.standings_now()`) returns every NHL team by conference WITH official logos + records — a ready full team list.
- **Player data for a picker EXISTS:** per-team roster is already returned by `GET /api/nhl/team/{abbr}` (forwards/defense/goalies, each with real `player_id`, name, position). Onboarding can load rosters for the chosen teams. (Headshots are only on the player landing; compact initials/team-colour identity works without them.)
- **Leagues:** NHL only today -> "choose leagues" is effectively NHL now (honest; multi-league later). 
- **Persistence infra EXISTS:** `src/utils/storage` (primitive-typed, so store the follow model as a JSON string). Reusable UI: `NhlLogo`, `Pill`, `SectionTitle`, theme. A compact player-identity chip (initials + team colours) would be small new UI.

## Smallest clean onboarding proposal (NOT built — for approval)
- **Route:** new `app/onboarding.tsx` (Stack screen). First-launch gate via `storage` flag `ticker.onboarded`; `app/index.tsx` redirects to `/onboarding` when unset. (Add a hidden way to re-run later; not required for MVP.)
- **Flow (short, visual, minimal typing):**
  1. **Leagues** — NHL preselected (single option now).
  2. **Teams** — grid of official logos from `/api/nhl/standings`; tap to toggle follow.
  3. **Players** — from the rosters of chosen teams; compact identity chips (initials + team colours); tap to toggle.
  4. **Stars** — assign 1ST / 2ND / 3RD STAR to the picks the user cares most about. Ranking is NOT mandatory for every follow; unranked picks stay followed at default weight.
  5. **Finish** -> write follows -> land on HOME / MY HOCKEY WORLD.
- **Output = the follow model Home consumes:** `{ teams:[{abbr, tier}], players:[{player_id, team_abbr, tier}] }` (tier optional; 1/2/3). Persisted locally only.
- **Star language:** 1ST STAR = MY CORE, 2ND STAR = MY REGULARS, 3RD STAR = KEEP ME POSTED.
- **Guardrails:** no auth, no backend user profile, no social, no complex settings; real canonical NHL IDs; don't over-configure; friends-and-family local persistence only.
- **New shared piece:** a small `src/lib/follows` store (context + hook) that both onboarding (write) and Home (read) use — created as part of the onboarding build, not before.

STOP: awaiting approval before building onboarding. Home + Team/Player follow controls remain deferred.
