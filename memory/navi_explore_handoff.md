# NAVI → BEST TICKER HANDOFF: Explore / Global Hockey Discovery (audit, no code changes)

Ground-truth audit of what Navi ACTUALLY ships today (June 2026). Source of truth: live
Navi backend + code. Numbers below are real responses from the running app.

## 0. The one idea Best must copy
Explore is NOT a page of leagues. It is a GENERIC progressive-disclosure navigator:
one backend "node" endpoint returns ONE next layer of choices; one frontend screen
renders ANY layer. Scale (176 → thousands of leagues) comes from DATA, never new screens.
`WORLD → CHOICE → NARROWER CHOICE → DESTINATION`. Search bypasses the whole tree.

## 1. Backend contract (implemented)
- `GET /api/explore/world` → country ENTRANCES for the main surface:
  `{ enabled, totals:{countries,leagues,available}, featured[], countries[], international[] }`
  group = `{ country, flag, available, total, leagues[] }`; league = `{ id, name, country, status, code }`.
  Live totals today: **34 countries · 176 leagues · 5 live**.
- `GET /api/explore/node?path=<node>` → ONE next layer:
  `{ path, kind:"chooser"|"leagues", title, subtitle, flag, note?, choices[] }`
  choice = `{ label, sub, status:"available"|"coming_soon", kind:"node"|"league"|"soon", path?, code?, icon? }`
  - `kind:"node"` → drill deeper (push node with `choice.path`)
  - `kind:"league"` (always `status:available`, has `code`) → go to League Hub
  - `kind:"soon"` → non-navigable, honest COMING SOON
  - Unknown deep path → **404**.
- `GET /api/search?q=` → `{ query, results[] }`, result = `{ type:"team"|"player"|"league", id, name, subtitle, league_code, league, logo, team_abbr?, player_id?, headshot?, pos?, world }`.

### Taxonomy resolution (backend/explore_taxonomy.py)
- `STATIC` dict keyed by path holds the RICH, per-country trees (only **Canada** + **Sweden** today).
- Fallback: any `country:<Name>` or `country:<Name>/league` with no static entry → BROWSE that
  country's real Highlightly leagues (available-first). So every one of the 34 countries works.
- `AVAILABLE = {nhl, whl, ohl, qmjhl, ncaa}`. Everything else = coming_soon. No fabricated data.
- Inventory source: `highlightly.all_leagues()` (paged, day-cached). Mapping `_AVAILABLE_BY_HLID =
  {49291:nhl, 4188:whl, 3337:ohl, 5039:qmjhl, 218640:ncaa}`. `_INTERNATIONAL={Europe,World}`.

## 2. Frontend (implemented)
- `src/screens/ExploreScreen.tsx` — MAIN surface = ENTRANCES only:
  hero "Take me somewhere in hockey" + totals line + universal Search bar (`explore-search`) +
  world lens pills (`world-elite|all|youth`) + **HOCKEY NATIONS** 2-col grid (featured) +
  **MORE COUNTRIES** chips + **INTERNATIONAL** chips + Youth teaser.
  Each country card/chip = testID `explore-country-<Name>` → `router.push('/explore/node?path=country:<Name>')`.
- `app/explore/node.tsx` — the GENERIC renderer for every layer: flag+title+subtitle header,
  a Search shortcut (`node-search`), optional note banner, and the choice rows
  (`node-choice-<code|path|label>`) with LIVE / SOON tags. Behaviour:
  node→push next node; league→`setContextLeague(code)`+`router.push('/league/<code>')`; soon→toast.
  Uses shared `Screen` + `BackBar` so real Back retraces every layer; bottom nav stays mounted.
- Destinations REUSED unchanged: `app/league/[code].tsx` (Hub: standings → team rows
  `router.push('/team/<abbr>?league=<code>')`), `app/team/[id].tsx`, `app/player/[id].tsx`, `app/game/[id].tsx`.
- Context: `src/lib/context.ts` `setContextLeague/useContextLeague` — entering a league/team sets the
  active league; RECAP/NEXT/STATS tabs inherit it (no silent NHL fallback).

## 3. Actual tap sequences (implemented)
### Canada (rich/adaptive tree)
`EXPLORE tab → tap Canada (3 LIVE / 6 leagues) → CHOOSER: [By Level | By Region | By League]`
- By Level → `[Pro • Major Junior • Junior A (SOON) • University (SOON) • Youth & Local (SOON)]`
  - Pro → `NHL (LIVE) • PWHL (SOON)`
  - Major Junior → `WHL • OHL • QMJHL` (all LIVE) → tap WHL → **/league/whl** (Hub) → tap team →
    **/team/<abbr>?league=whl** → player/game.
- By Region → `BC, Alberta, Saskatchewan, Manitoba, Ontario, Québec, Atlantic` (all COMING SOON nodes)
  → province leaf shows honest "coming once youth/local data connected" note.
- By League → BROWSE all Canadian competitions (WHL/OHL/QMJHL live + LNAH/Memorial Cup/U SPORTS soon).

### USA (no rich tree yet → BROWSE fallback)
`EXPLORE → tap USA (2 LIVE / 11) → leagues: NCAA (LIVE), NHL (LIVE), AHL/ECHL/FPHL/PWHL Women/SPHL/USHL (SOON)`
→ tap NCAA → /league/ncaa. NOTE: NHL's provider country is "USA", so NHL surfaces here (not under Canada).

### Europe / International (BROWSE, honest coming-soon)
`EXPLORE → INTERNATIONAL chips → Europe (25 comps, 0 live) / World (50 comps, 0 live)`
→ list of real competitions all COMING SOON (Champions Hockey League, Olympic Games, NHL 4 Nations,
Hlinka-Gretzky, Continental Cup, …). Provider-true, nothing fabricated.

### Sweden (proof that trees DIFFER per country)
`EXPLORE → tap Sweden → CHOOSER: [Men's Tiers (SOON) | Women's Hockey (SOON) | By League]` — **NO region layer**.
- Men's Tiers → `SHL • HockeyAllsvenskan • HockeyEttan • J20 Nationell` (all SOON + note).
- Women's → `SDHL` (SOON). By League → browse Swedish inventory.

## 4. Search = the bypass (implemented, shared)
- Entrances: `explore-search` (Explore main) and `node-search` (every node screen) → `/search`.
- `app/search.tsx` → `api.search(q)` → routes by TYPE+id, skipping the whole hierarchy:
  team→`/team/<abbr>?league=`, player→`/player/<id>?league=&name=&pos=`, league→`/league/<code>`.
- Engine `backend/entity_index.py`: in-memory, accent-folded (`Montréal`→montreal), alias-aware
  (`habs`, `leafs`, `golden gophers`), team+league entities indexed once; ONE fast NHL player call
  for player hits. `LEAGUE_RANK` puts NHL above junior/college on ties. Same index powers onboarding.
  Verified resolves: montreal/habs/canadiens→Canadiens, wild→Wild, dallas/stars→Stars,
  kamloops/blazers→Kamloops, whl→WHL Hub, kaprizov/kirill→player, golden gophers→Minnesota (NCAA).

## 5. Implemented vs planned/deferred
IMPLEMENTED: generic node navigator; entrances surface; Canada rich tree; Sweden distinct tree;
32 other countries via browse fallback; available/coming_soon from real 176-league inventory;
League→Team→Player/Game reuse; universal search bypass; Back + league-context persistence; persistent bottom nav.
PLANNED / NOT BUILT (honest coming-soon only, NO data): Youth/Local world (world 2) geography-first
(Canada→BC→Kamloops→association→team) — placeholder + sample path only; province/region CONTENT;
mapping more leagues to "available" beyond the 5 (SHL/Liiga/KHL/DEL… all soon); "Near you" / recent-trail
entrances (ideas, not built); world lens currently only toggles the Youth placeholder (all countries are "elite" today).
KNOWN ROUGH EDGE: provider returns duplicate competition IDs (USA shows FPHL×2, PWHL Women×3) — not yet deduped.

## 6. What Best should reproduce (priority order)
1. The node CONTRACT + single generic renderer (infinite depth, zero new screens). ← the whole point.
2. Backend resolver: static per-country trees + browse fallback + `AVAILABLE` set + 404 on unknown.
3. Explore main = ENTRANCES only (never a flat 176-league list).
4. Content-is-navigation into EXISTING League/Team/Player/Game, setting active league context.
5. Universal search as the bypass, wired to the SAME entity index as onboarding.
6. Strict honesty: available vs coming_soon straight from provider inventory; never fabricate.

## 7. Onboarding reuse (do NOT invent a new concept)
Navi ALREADY implements the desired relationship — reuse it, don't redesign:
- Explore = discover everything = the taxonomy tree + `/api/explore/*`.
- Onboarding (`app/onboarding.tsx`) = quickly CHOOSE from that same world. It already uses the SAME
  `/api/search` + `entity_index` (search team/player, `result-team-*`/`result-player-*`), the SAME
  region step (country/region taxonomy), and the SAME league list (`api.leagues()`), then writes favorites.
- My Hockey = the chosen SUBSET = the `follows` store (`src/lib/follows.tsx`).
So the three surfaces share ONE entity index + ONE taxonomy. Best's onboarding should feed its
team/player/league pickers from that same search + taxonomy — Explore browses the tree, Onboarding
searches/taps to select favorites from it, My Hockey renders the follows subset.

## 8. Key files / data structures
Backend: `explore_taxonomy.py` (AVAILABLE, LG, STATIC, resolve, _browse), `server.py`
(`_explore_by_country`, `/api/explore/world`, `/api/explore/node`, `_COUNTRY_FLAG`,
`_FEATURED_COUNTRIES`, `_AVAILABLE_BY_HLID`, `_INTERNATIONAL`, `/api/search`), `highlightly.all_leagues()`,
`entity_index.py` (`_norm`, `NHL_ALIASES`, `NCAA_ALIASES`, `LEAGUE_META`, `LEAGUE_RANK`, `LEAGUE_WORLD`,
`search_entities`), `providers/registry.search_all`.
Frontend: `src/screens/ExploreScreen.tsx`, `app/explore/node.tsx`, `app/search.tsx`,
`app/league/[code].tsx`, `app/team/[id].tsx` (+ exported `BackBar`), `app/player/[id].tsx`,
`app/game/[id].tsx`, `src/lib/context.ts`, `src/lib/api.ts` (`exploreWorld`, `exploreNode`, `ExploreNode`/`ExploreChoice` types),
`src/components/BottomNav.tsx`.
Screenshots captured this audit: Explore main, Canada chooser, Canada·By Level, Canada·Major Junior (WHL/OHL/QMJHL LIVE),
USA browse, Sweden chooser, Sweden·Men's Tiers (SOON), search.
