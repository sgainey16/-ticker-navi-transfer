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
