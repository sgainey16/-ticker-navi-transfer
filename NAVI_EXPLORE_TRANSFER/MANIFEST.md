# NAVI EXPLORE — TRANSFER MANIFEST

Everything required to reproduce Navi's Explore / progressive hockey-world discovery in
another project (Best Ticker). **Navi was NOT modified — these are copies.**
Extracted from the live Navi project. Full architecture + UX doc:
`/app/memory/ORIGINAL_NAVI_EXPLORE_HANDOFF.md`.

Legend — **Transfer status**:
- **COPY** = drop into Best (may need import-path tweaks only).
- **REFERENCE** = compare against Best's existing equivalent; do NOT overwrite Best's V2.
- **ADAPT** = must be changed/re-pointed during integration (see notes).

---
## FRONTEND

| File (in this package) | Purpose | Transfer | Direct deps |
|---|---|---|---|
| `frontend/src/screens/ExploreScreen.tsx` | **Explore main surface** = entrances only (hero, totals, Search bar, world-lens pills, HOCKEY NATIONS grid, MORE COUNTRIES chips, INTERNATIONAL chips, Youth teaser). Country tap → pushes node route. | **COPY** | theme, api(exploreWorld/ExploreCountry), useApi, ui(TabScreen/Loader/ErrorState), expo-router, expo-haptics, reanimated, @expo/vector-icons |
| `frontend/app/explore/node.tsx` | **The generic drill-down renderer.** ONE screen renders ANY layer (chooser/leagues) from `/api/explore/node`. LIVE/SOON tags, search shortcut, note banner, coming-soon toast. node→push next; league→setContextLeague+`/league/<code>`. | **COPY** | theme, api(exploreNode/ExploreChoice), useApi, ui(Screen/Loader/ErrorState), **BackBar**, context(setContextLeague), expo-router/haptics/reanimated |
| `frontend/app/search.tsx` | **Universal search route** (the bypass). Types → `/api/search` → routes team/player/league DIRECTLY to destinations. | **COPY** | theme, api(search/SearchResult), ui(Screen), **BackBar**, NhlLogo, expo-image |
| `frontend/src/components/BackBar.tsx` | **NEW standalone extraction** of Navi's BackBar (back + globe + search). In Navi it lived inside `app/team/[id].tsx`; extracted so Explore doesn't drag the whole Team page. | **ADAPT** | theme, expo-router. Re-point imports OR replace with Best's back control (keep testIDs). |
| `frontend/src/components/ui.tsx` | Shared primitives: `Screen`, `TabScreen`, `Loader`, `ErrorState`, `Card`, `SectionTitle`, `Pill`, `LiveBadge`, `FollowPill`. Screen/TabScreen wrap SafeArea + mount `BottomNav`. | **REFERENCE** | theme, **BottomNav**, safe-area-context. Best likely has equivalents — reuse Best's; only need Screen/TabScreen/Loader/ErrorState for Explore. |
| `frontend/src/components/BottomNav.tsx` | Navi's 5-destination persistent bottom nav. | **REFERENCE** | theme, tabnav, safe-area. **Best keeps its OWN bottom nav** — do not replace. |
| `frontend/src/components/NhlLogo.tsx` | Team/league crest with graceful fallback (used by search results + league hub). | **COPY** | theme, expo-image |
| `frontend/src/lib/api.ts` | API client + all types. Explore adds: `exploreWorld()`, `exploreNode(path)`, `ExploreWorld/ExploreCountry/ExploreNode/ExploreChoice`, `search()/SearchResult`. Reads `EXPO_PUBLIC_BACKEND_URL`. | **REFERENCE/COPY** | Merge the Explore methods+types into Best's api client; don't clobber Best's endpoints. |
| `frontend/src/lib/useApi.ts` | Tiny data hook: `{data,loading,error,reload}`. | **COPY** | — |
| `frontend/src/lib/context.ts` | **Active-league context persistence.** `setContextLeague/getContextLeague/useContextLeague`. Entering a league/team sets active league so downstream tabs inherit it. | **COPY** | react |
| `frontend/src/lib/tabnav.ts` | Bridge so pushed routes can jump back to a bottom-nav tab (`goToTab`). | **REFERENCE** | Only needed by Navi's BottomNav; Best uses its own. |
| `frontend/src/lib/cache.ts` | `loadTeam/prefetchTeam` team-page cache used by League Hub → Team. | **REFERENCE** | api. Best's team destination has its own loading. |
| `frontend/src/theme/index.ts` | Design tokens: `colors, fonts, spacing, radius, fontSize`. Explore styles reference these. | **REFERENCE** | Map Navi tokens → Best's theme (keep names or remap). |
| `frontend/app/league/[code].tsx` | **League Hub** — Explore's primary live destination (standings + team rows → Team). | **REFERENCE** | api, useApi, ui, NhlLogo, BackBar, cache, context. Compare with Best's league page. |
| `frontend/app/team/[id].tsx` | Team destination (also the ORIGINAL home of BackBar). **Heavy**: pulls TeamDesk, HighlightsModule, follows, cache. | **REFERENCE** | **Best keeps its Team V2** — do not overwrite. Included only to compare + to show BackBar's origin. |
| `frontend/app/player/[id].tsx` | Player destination. | **REFERENCE** | **Best keeps Player V2.** |
| `frontend/app/game/[id].tsx` | Game destination. | **REFERENCE** | **Best keeps Game V2.** |

---
## BACKEND

| File | Purpose | Transfer | Notes |
|---|---|---|---|
| `backend/explore_taxonomy.py` | **The taxonomy engine.** `AVAILABLE` set, `LG` league labels, `STATIC` per-country trees (Canada rich; Sweden different), `resolve()` (static win → browse fallback), `_browse()`. Add a country/level/youth branch here — the client never changes. | **COPY** | Pure data + logic, no external deps. |
| `backend/server_explore_endpoints.py` | **NEW curated excerpt**: exact code for constants (`_COUNTRY_FLAG/_FEATURED_COUNTRIES/_AVAILABLE_BY_HLID/_INTERNATIONAL`), `_explore_by_country()`, `/api/explore/world`, `/api/explore/node`, `/api/search`, and the `/api/league/{code}/...` destinations. | **COPY** | Drop these into Best's FastAPI app (has `api_router` prefix `/api`). |
| `backend/server.py` | Full Navi backend (1867 lines) for side-by-side comparison. Explore-relevant ranges: constants 1109-1121, helper 1124-1146, explore endpoints 1149-1191, search 1456-1468, league destinations 1483-1542, startup index warm ~1860. | **REFERENCE** | Do NOT copy wholesale — it also contains AI/TTS/Reels/Recap. |
| `backend/entity_index.py` | **Universal search engine.** Accent-fold `_norm`, `NHL_ALIASES/NCAA_ALIASES`, `LEAGUE_META/LEAGUE_RANK/LEAGUE_WORLD`, in-memory index, `search_entities()`, `warm()`. Powers Explore search AND onboarding. | **COPY** | Needs `providers.registry.list_providers` + provider `.team_entities()`. |
| `backend/highlightly.py` | **Inventory source of truth.** `all_leagues()` (paged, day-cached → the 176 leagues / 34 countries), `enabled()`, match/highlight helpers. | **COPY** | Requires env `HIGHLIGHTLY_API_KEY`. |
| `backend/providers/__init__.py` `base.py` `registry.py` `nhl.py` `whl.py` `ncaa.py` | League adapters + the single **registry plug-point**. `registry._PROVIDERS` registers nhl, whl, ohl, qmjhl (all three CHL via one `HockeyTechProvider`), ncaa. `search_all()` → entity index. Each provider exposes `team_entities()` (feeds search), `team_page/game_by_id/player_page/standings_now`. | **COPY** | ncaa uses highlightly + eliteprospects; whl uses HockeyTech. |

---
## DEPENDENCIES BEST WILL NEED
**Env:** `EXPO_PUBLIC_BACKEND_URL` (frontend), `HIGHLIGHTLY_API_KEY` (backend).
**npm/expo:** `expo-router`, `expo-haptics`, `expo-image`, `react-native-reanimated`,
`react-native-safe-area-context`, `@expo/vector-icons`. (All standard; Best already has most.)
**python:** `fastapi`, `httpx` (highlightly), `motor`/mongo (only for unrelated caches — Explore
endpoints themselves don't require Mongo). `eliteprospects` module only for junior player depth.
**Backend startup:** call `await warm()` from `entity_index` so search is instant.

## CANNOT TRANSFER DIRECTLY — MUST ADAPT
1. **BackBar coupling** — Explore files import `BackBar` from `@/app/team/[id]`. Use the
   extracted `src/components/BackBar.tsx` and re-point imports, or swap Best's own back control
   (keep testIDs `back-button`, `nav-hockey`, `nav-search`).
2. **BottomNav / tabnav / Screen-wrapper** — Navi's `Screen`/`TabScreen` mount Navi's BottomNav.
   Best has its OWN permanent bottom nav — wire Explore into Best's shell instead of copying Navi's.
3. **Theme tokens** — remap `colors/fonts/spacing/radius` names to Best's V2 theme.
4. **api.ts** — merge only the Explore methods/types into Best's client; keep Best's base + endpoints.
5. **Destinations (league/team/player/game)** — Best keeps its V2 pages. Only ensure the routes/params
   match what Explore pushes: `/league/<code>`, `/team/<abbr>?league=<code>`, `/player/<id>?league=&name=&pos=`, `/game/<id>`.
6. **Provider registry** — if Best already has providers, don't duplicate; just ensure the same
   `_AVAILABLE_BY_HLID` mapping + `team_entities()` exist so search + availability match.
