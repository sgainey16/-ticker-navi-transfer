# ORIGINAL NAVI EXPLORE — COMPLETE IMPLEMENTATION & UX HANDOFF

Source of truth: the **live Navi project**. This documents what ACTUALLY exists and works
today (June 2026). Navi was not modified. Copies of every file live in
`/app/NAVI_EXPLORE_TRANSFER/` (see `MANIFEST.md` there for per-file purpose/deps/transfer status).
All numbers below are real responses from the running Navi backend.

> Goal: Best reproduces THIS Explore without reinterpretation, while preserving Best's
> permanent bottom nav, Recap, My Ticker, My Hockey, Games, Team/Player/Game V2 and Sports Desk.

---
## 1. THE CORE IDEA (copy this above all)
Explore is **not** a list of leagues. It is a **generic progressive-disclosure navigator**:
- **Backend** exposes ONE node endpoint that returns **one next layer** of choices.
- **Frontend** has ONE screen that renders **any** layer.
- Scale (176 → thousands of leagues, plus a future youth/local world) comes from **DATA**,
  never new screens. Model: `WORLD → CHOICE → NARROWER CHOICE → DESTINATION`.
- **Search bypasses the tree** for anyone who already knows where they're going.

---
## 2. BACKEND CONTRACT (implemented)
### `GET /api/explore/world` — country entrances for the main surface
```
{ enabled, totals:{countries,leagues,available},
  featured:[group], countries:[group], international:[group] }
group = { country, flag, available, total, leagues:[ {id,name,country,status,code} ] }
```
Live totals today: **34 countries · 176 leagues · 5 live**. `featured` = the 9 `_FEATURED_COUNTRIES`
present in inventory; `countries` = the other ~23; `international` = Europe + World.

### `GET /api/explore/node?path=<node>` — ONE next layer
```
{ path, kind:"chooser"|"leagues", title, subtitle, flag, note?, choices:[choice] }
choice = { label, sub, status:"available"|"coming_soon",
           kind:"node"|"league"|"soon", path?, code?, icon? }
```
- `kind:"node"` → drill deeper (client pushes a new node route with `choice.path`).
- `kind:"league"` (always `status:available`, carries `code`) → go to League Hub.
- `kind:"soon"` → non-navigable; honest COMING SOON.
- Unknown deep path → **HTTP 404**.

### `GET /api/search?q=` — universal entity search (the bypass)
```
{ query, results:[ {type:"team"|"player"|"league", id, name, subtitle,
                     league_code, league, logo, team_abbr?, player_id?, headshot?, pos?, world} ] }
```

### Taxonomy resolution (`backend/explore_taxonomy.py`)
- `STATIC` dict keyed by path holds the RICH per-country trees — today **Canada + Sweden only**.
- Fallback: any `country:<Name>` or `country:<Name>/league` with no static entry → **browse**
  that country's real Highlightly leagues (available-first). So all 34 countries work.
- `AVAILABLE = {nhl, whl, ohl, qmjhl, ncaa}`; everything else `coming_soon`. Never fabricated.
- Inventory: `highlightly.all_leagues()` (day-cached). Mapping
  `_AVAILABLE_BY_HLID = {49291:nhl, 4188:whl, 3337:ohl, 5039:qmjhl, 218640:ncaa}`. `_INTERNATIONAL={Europe,World}`.
- NCAA is injected as available (offseason listing feed is empty).

### Providers (`backend/providers/registry.py`) — the single plug-point
`_PROVIDERS = { nhl:NHLProvider, whl/ohl/qmjhl:HockeyTechProvider(×3, one chassis), ncaa:NCAAProvider }`.
Each exposes `team_entities()` (feeds the search index), `team_page`, `game_by_id`, `player_page`,
`standings_now`. Add a league = add one registry line; search + availability pick it up automatically.

---
## 3. FRONTEND IMPLEMENTATION (implemented)
- `src/screens/ExploreScreen.tsx` — **main = entrances only**. Country card testID
  `explore-country-<Name>` → `router.push('/explore/node?path=country:<Name>')`.
- `app/explore/node.tsx` — **generic renderer** for every layer. Choice rows testID
  `node-choice-<code|path|label>`; `node-search` shortcut; LIVE/SOON tags; coming-soon toast.
  Uses shared `Screen`+`BackBar` → real Back retraces; bottom nav stays mounted.
  On league choice: `setContextLeague(code)` then `router.push('/league/<code>')`.
- `app/search.tsx` — routes by type+id: team→`/team/<abbr>?league=`, player→`/player/<id>?…`,
  league→`/league/<code>`, skipping the hierarchy entirely.
- **Destinations reused unchanged**: `app/league/[code].tsx` (Hub: standings → team rows →
  `/team/<abbr>?league=<code>`), `team/[id]`, `player/[id]`, `game/[id]`.
- **Context** `src/lib/context.ts` — entering a league/team sets the active league; downstream
  Games/Recap/Next/Stats inherit it (no silent NHL fallback).
- **Content-is-navigation**: crest/name/league/game are themselves the links; a league choice or a
  team row IS the navigation — no separate "view" buttons.

---
## 4. THE EXACT FIRST EXPLORE SCREEN — top to bottom (visual order)
1. **Kicker** "◦ EXPLORE THE TICKER" (small, blue, tracked).
2. **Hero title** — "Take me somewhere in hockey." (2 lines, display, ~30px).
3. **Totals line** — "34 countries · 176 leagues · 5 live in Ticker".
4. **Universal Search bar** (testID `explore-search`) — "Search a league, team or player…" → `/search`.
5. **World-lens pills row** — `ELITE / JUNIOR+` (default on) · `ALL HOCKEY` · `YOUTH / LOCAL`.
6. **Section: HOCKEY NATIONS** (label + hint "Pick a country — then choose how you want to explore it.")
   → **2-column card grid** (featured): Canada (3 LIVE), USA (2 LIVE), Sweden, Finland,
     Czech Republic, Russia, Switzerland, Germany, Slovakia. Card = flag, LIVE tag, name, "N leagues", "ENTER →".
7. **Section: MORE COUNTRIES** → wrapping **chips** (flag + name + live-dot + count) for the other ~23.
8. **Section: INTERNATIONAL** → chips: Europe, World.
9. **Youth teaser row** — "Youth & Local hockey — a different discovery world — coming soon" → switches lens to YOUTH.
   (YOUTH lens shows an honest placeholder card + a sample path `Canada › British Columbia › Kamloops › Association` marked COMING SOON.)

---
## 5. EXACT TAP PATHS
### A) Explore → Canada → WHL → Kamloops  ✅ IMPLEMENTED
`EXPLORE tab` → tap **Canada** card (`explore-country-Canada`) → **Canada CHOOSER** [By Level | By Region | By League]
→ **By Level** → [Pro • Major Junior • Junior A (SOON) • University (SOON) • Youth & Local (SOON)]
→ **Major Junior** → [**WHL** • OHL • QMJHL] all LIVE
→ tap **WHL** (`node-choice-whl`) → `setContextLeague('whl')` → **/league/whl** League Hub (standings + team rows)
→ tap **Kamloops Blazers** row → **/team/&lt;abbr&gt;?league=whl** Team Page → roster/games/highlights.
(Alt route to same WHL: Canada → **By League** → browse Canadian competitions → WHL.)

### B) Explore → Search → Los Angeles Kings  ✅ IMPLEMENTED
`EXPLORE` → tap **Search bar** (`explore-search`) → `/search` → type "los angeles" / "kings" / "la"
→ result `type:"team"` LA Kings (NHL) → tap → **/team/LAK** Team Page. (Accent-fold + aliases: "la" is an NHL alias.)
Search is reachable from EVERY node screen too (`node-search`), so you can bypass at any depth.

### C) Explore → Sweden → deepest currently implemented  ⚠️ COMING SOON at the end
`EXPLORE` → tap **Sweden** → **Sweden CHOOSER** [Men's Tiers (SOON) | Women's Hockey (SOON) | By League]
— note: **no region layer** (different tree from Canada, by design).
→ **Men's Tiers** → [SHL • HockeyAllsvenskan • HockeyEttan • J20 Nationell] — **all COMING SOON** (with provider-confirmed note).
→ OR **By League** → browse real Swedish competitions from Highlightly — **all COMING SOON**.
**Deepest IMPLEMENTED destination = an honest COMING SOON leaf.** No live Swedish team/player yet (not mapped).

### D) Explore → International → deepest currently implemented  ⚠️ COMING SOON at the end
`EXPLORE` → **INTERNATIONAL** chips → **World** (50 comps, 0 live) or **Europe** (25 comps, 0 live)
→ browse list of real competitions (Champions Hockey League, Olympic Games, NHL 4 Nations, Hlinka-Gretzky, Continental Cup…)
— **all COMING SOON**. Deepest IMPLEMENTED destination = an honest COMING SOON leaf (provider-true identity only).

---
## 6. AVAILABLE / COMING SOON LOGIC
A league is **AVAILABLE** iff its Highlightly id is in `_AVAILABLE_BY_HLID` (→ has a Ticker `code`
and a real destination). Everything else is **COMING SOON**: shown by real provider identity only —
**never** fake teams/players/games/stats/ids. `available`/`total` counts on every country come straight
from this. Featured cards show a blue "N LIVE" tag; chips show a live-dot; SOON leaves are dashed + non-tappable (toast).

## 7. BACK & CONTEXT
- Each drill layer is a **pushed route** (`/explore/node?path=…`), so the phone Back button/gesture
  **retraces the exact path**. Bottom nav remains mounted throughout.
- Entering a league/team calls `setContextLeague(code)`; the app's active league persists so Games/Recap/
  Next/Stats reflect where you are (no silent NHL default).

---
## 8. IMPLEMENTED NOW vs PLANNED / PLACEHOLDER / COMING SOON
**IMPLEMENTED NOW**
- Generic node navigator (infinite depth, zero new screens).
- Explore entrances surface (search + world lens + HOCKEY NATIONS + MORE COUNTRIES + INTERNATIONAL + youth teaser).
- Canada rich adaptive tree (By Level with Pro/Major Junior LIVE; By Region provinces; By League browse).
- Sweden distinct tree (tiers/women/league) — proves trees differ per country.
- All other 32 countries via browse fallback.
- Real 176-league / 34-country inventory with honest available/coming_soon.
- Live destinations for the 5 mapped leagues: League Hub → Team → (roster/games/highlights) and search→team/player.
- Universal accent/alias search as the bypass (shared with onboarding).
- Back retrace + active-league context + persistent bottom nav.

**PLANNED / PLACEHOLDER / COMING SOON (no real data yet)**
- Youth/Local world (world 2): geography-first (Canada→BC→Kamloops→association→team) — placeholder + sample path only.
- Canada By Region CONTENT (provinces are coming-soon nodes; no local teams/associations wired).
- Any live destination beyond the 5 leagues (SHL, Liiga, KHL, DEL, etc. all coming soon).
- "Near you" / recent-trail entrances (ideas, not built).
- World lens currently only toggles the Youth placeholder (all countries are "elite" today).
- **Known rough edge**: Highlightly returns duplicate competition ids for some countries (e.g. USA shows
  FPHL×2, PWHL Women×3) — not yet deduped in `_explore_by_country`.

---
## 9. ONBOARDING RELATIONSHIP (do NOT invent a new concept)
Navi already implements the desired relationship — reuse it:
- **Explore = discover everything** = the taxonomy tree + `/api/explore/*`.
- **Onboarding = quickly CHOOSE from that same world.** Navi's `app/onboarding.tsx` already uses the
  SAME `/api/search` + `entity_index` (team/player pickers `result-team-*`/`result-player-*`), the SAME
  region step, and the SAME league list, then writes favorites.
- **My Hockey = the chosen SUBSET** = the `follows` store.
So all three surfaces share ONE entity index + ONE taxonomy. In Best: feed onboarding's pickers from the
same search + taxonomy that Explore uses — don't build a parallel discovery system.

---
## 10. TRANSFERABLE SOURCE (where it lives)
Frontend core: `ExploreScreen.tsx`, `app/explore/node.tsx`, `app/search.tsx`, `src/components/{ui,BottomNav,NhlLogo,BackBar}.tsx`,
`src/lib/{api,useApi,context,tabnav,cache}.ts`, `src/theme/index.ts`.
Frontend destinations (reference): `app/league/[code].tsx`, `app/team/[id].tsx`, `app/player/[id].tsx`, `app/game/[id].tsx`.
Backend: `explore_taxonomy.py`, `entity_index.py`, `highlightly.py`, `providers/*`, plus the curated
`server_explore_endpoints.py` and full `server.py` (reference). All copied under `/app/NAVI_EXPLORE_TRANSFER/`.
See that folder's `MANIFEST.md` for per-file COPY / REFERENCE / ADAPT status and the "must adapt" list
(BackBar coupling, BottomNav/Screen shell, theme token remap, api.ts merge, destination route params, provider registry).
