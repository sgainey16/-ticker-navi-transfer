# The Ticker — Navigation Worlds & Explore Architecture (captured for Phase 3)

Captured June 2026 during the Navigation Fork so Phase 3 (Explore/Globe + world-aware
onboarding) does not have to rebuild an NHL-only structure.

## The four complementary ways to move through The Ticker
1. GLOBAL nav — bottom bar: My Ticker · My Hockey · Games · Explore · Profile.
2. CONTEXTUAL nav — top MODE tabs (only when needed) + league/category RAIL.
3. CONTENT-IS-NAVIGATION — tap a player/team/game/league → go straight there.
4. EXPLORE/GLOBE nav — deliberately travel the hockey universe geographically + by competition.
SEARCH sits across all four as a universal shortcut to any known entity (entity_index.py).

## Locked grammar
- Bottom = major destination. Top = mode (ONLY when genuinely needed — don't force equal tab counts). Rail = league/category/filter. Then content itself is navigation.
- Max visible hierarchy: destination → mode → league/category → content. No tabs-in-tabs-forever.

## TWO DISCOVERY WORLDS (ecosystem classification, NOT player age)
Youth/local must NOT be just another league button beside NHL/WHL. There are two worlds:
- WORLD 1 — JUNIOR / ELITE / PRO (working name): NHL · PWHL · CHL(WHL/OHL/QMJHL) · NCAA · junior · European pro/elite · national/international.
- WORLD 2 — YOUTH / LOCAL: minor hockey · girls hockey · AAA/AA/A · local associations · academies · appropriate high-school · tournaments · age-group · community teams.
- A hockey family follows BOTH (e.g. NHL team + WHL team + their kid's U13). Ticker must model all relationships. Support an explicit "I follow both".

### Capture in code so far
- `entity_index.LEAGUE_WORLD` classifies every registered league (all "elite" today). Each search entity now carries `world`. Youth entities will carry `world="youth"` when that world is wired. `follows` store can gain optional `world`/`worlds` later (additive) without breaking existing data.

## Onboarding (future, keep FAST — not a questionnaire)
Where are you? → What hockey world matters? [Junior/Elite/Pro | Youth/Local | Both] → select leagues/teams/players/local hockey → Enter. Draft Board keeps learning after entry.
- Elite path is competition-first: Canada → NHL → Montreal Canadiens; USA → NCAA → Minnesota Golden Gophers.
- Youth path is geography-first: Canada → British Columbia → Kamloops → association/league → team → player/game.

## Search (future world-awareness)
Stay UNIVERSAL, but the chosen world can improve RANKING/context:
- Elite context: montreal→Canadiens, wild→Minnesota Wild, golden gophers→Minnesota NCAA.
- Youth context: kamloops→local associations/teams/competitions, U15→relevant local U15.
- The user must ALWAYS be able to escape the filter and search "All Hockey".

## Explore / Globe model (Phase 3 target)
EXPLORE THE TICKER
→ [Junior/Elite/Pro | Youth/Local | All Hockey]
→ World / Country / Region
→ League / Association / Competition
→ Team
→ Player / Game
Examples:
- Elite → Canada → NHL → Central → Minnesota Wild → Player/Game
- Youth → Canada → BC → Kamloops → Association/League → Team → Player/Game
- Elite → Sweden → SHL → Team → Player/Game
Do NOT hard-code every country into a North-American hierarchy — geography + competition structure vary worldwide; keep the model data-driven and extensible.
