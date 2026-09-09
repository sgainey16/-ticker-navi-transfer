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
