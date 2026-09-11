# HIGHLIGHTLY COVERAGE & UTILIZATION AUDIT (read-only, no build)
Date: Jun 2026. Live Desk V1 frozen (awaiting Elite Prospects). No redesign, no features added.

## HEADLINE FINDING
**The Ticker ingests ZERO Highlightly data today.** There is no Highlightly key, client,
base URL, or a single call anywhere in backend or frontend (grep-clean). The app runs
entirely on FREE public feeds:
- **NHL** → `api-web.nhle.com/v1` (+ `search.d3.nhle.com`, `assets.nhle.com`). No key.
- **WHL / OHL / QMJHL** → HockeyTech/Leaguestat `lscluster.hockeytech.com`. Free public key.

So "maximize the Highlightly data we're already paying for" = we are paying for a
provider we have not wired in at all. Nothing to squeeze yet — it must first be connected.

## WHAT IS CONNECTED (providers/registry.py)
| League | Provider | standings | leaders | recaps | schedule | team_page | player_page | media(video) |
|---|---|---|---|---|---|---|---|---|
| NHL | NHL public API | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ media=False |
| WHL | HockeyTech | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ media=False |
| OHL/QMJHL | HockeyTech (same adapter, not registered as separate) | — | — | — | — | — | — | ❌ |
| AHL, ECHL, USHL, NCAA, PWHL, KHL/SHL/etc | **NOT CONNECTED** | — | — | — | — | — | — | ❌ |

`media=False` on EVERY provider ⇒ no video/highlights ingested or shown anywhere.
All highlight UI slots (Game, Team, Player, Reels) are capability-gated and render nothing.
The only "highlights" strings in code are legacy MASL residue (masl_data.py) — not real video.

## WHAT HIGHLIGHTLY ACTUALLY OFFERS (from highlightly.net/hockey-api docs, Jun 2026)
Base: `https://sports.highlightly.net` or `https://highlightly.net`. Auth: `x-rapidapi-key` + `x-rapidapi-host`.
Coverage: 170+ hockey leagues / 30+ countries. Explicitly incl:
**NHL, AHL, ECHL, USHL, SPHL, FPHL, NCAA, OHL, WHL, QMJHL, LNAH, Memorial Cup, PWHL,
KHL, SHL, Liiga, DEL, NL(Swiss), Extraliga CZ/SK, CHL Europe, IIHF Worlds/U20/U18/Olympics.**

Endpoints / data fields:
- `/highlights` — VIDEO: goals, saves, big hits, game recaps, press conferences, interviews.
  Verified sources, 0–48h after game (some near-real-time). Filter by date/league/country/team.
  Pagination limit ≤40. Field ex: {type:"VERIFIED", title, url, embedUrl, source}.
- `/matches`, `/matches/{id}`, `/matches/{id}/statistics` — live scores period-by-period,
  OT/SO; match stats: goals, assists, penalties, shots on goal, power plays.
- `/standings` — needs leagueId + season. W/L/OTL/points/qualification.
- `/teams`, `/teams/{id}/statistics` (needs fromDate) — team data, logos, season stats.
- `/last-five-games`, `/head-to-head` (last 10 meetings) — form/preview widgets.
- Momentum indicators (shot attempts, PP efficiency, scoring bursts, period trends).
- NHL & NCAAH dedicated modules: player profiles, rosters, momentum.

What Highlightly does NOT emphasize / likely NOT provide well:
- Deep play-by-play EVENT feeds, LINEUPS, INJURIES/TRANSACTIONS — not advertised.
  (For NHL/WHL we already get richer roster + box/scoring depth free from NHL API & HockeyTech.)

## PRICING = CALLS, NOT DEPTH (critical)
All paid tiers expose the IDENTICAL data set ("all leagues coverage" + "unlimited highlights
from all leagues"). Tiers only change request ceiling + rate limit:
- Basic $0 = 100/day · Pro $6.99 = 7,500/day (12 rps) · Ultra $16.99 = 25,000/day (20 rps) · Mega $39.99 = 50,000/day.
NUANCE: highlightly.net Basic advertises all-league highlights, BUT the RapidAPI Basic listing
EXCLUDES highlights for NHL/AHL/OHL/NCAA/SHL/KHL — i.e. major-league highlights need a PAID tier.
⇒ The free→ANY-paid jump is what unlocks NHL/AHL/OHL/NCAA highlights.
⇒ 5k→25k (Pro→Ultra) adds NO new fields/leagues/content — only more daily calls for higher traffic.

## AVAILABLE → INGESTED → SHOWN → MISSING (league by league)
Legend: A=available from Highlightly, I=currently ingested (any provider), S=shown in Ticker.

### NHL
- Scores/schedule/standings/team/rosters/player stats/box: A✅ I✅(NHL API) S✅
- Play-by-play/events: A~(match stats) I✅(NHL API box) S(partial)
- VIDEO highlights: A✅(paid) **I❌ S❌** ← MISSING. NHL feels "under-populated" because NO video is wired, not because Highlightly lacks it.
- Momentum/H2H/last-5: A✅ I~(we derive some) S~

### AHL / ECHL / USHL
- Everything: A✅ **I❌ S❌** — these leagues are NOT connected to any provider. Blank because unconnected, not because data is unavailable.

### WHL
- Standings/leaders/recaps/schedule/team: A✅ I✅(HockeyTech) S✅
- Player page: A✅(Highlightly) I❌(HockeyTech gated off) S❌ ← Highlightly could fill this
- VIDEO highlights: A✅ **I❌ S❌**

### OHL / QMJHL
- A✅ ; HockeyTech adapter supports them but they're NOT registered as separate providers ⇒ I❌ S❌ today. VIDEO A✅ I❌ S❌.

### NCAA (men's)
- A✅ (dedicated module: profiles/rosters/momentum) **I❌ S❌** — not connected.

## DIRECT ANSWERS TO THE THREE QUESTIONS
1. NHL video under-populated? → Highlightly HAS it (paid). We simply don't ingest ANY video. Fixable by connecting `/highlights`.
2. AHL/ECHL/others empty? → Not connected to any provider at all. Highlightly covers them. "Available, not ingested, not shown."
3. Highlights = ingest-but-don't-surface? → NO. We do not ingest highlights at all. media=False everywhere.

## RECOMMENDATION (audit conclusion — do NOT build yet)
Before buying Elite Prospects (or a bigger Highlightly call tier), the biggest unused asset we
ALREADY pay for is Highlightly VIDEO + multi-league scores/standings — currently 0% used.
Highest-value, lowest-cost next move = wire Highlightly's `/highlights` in (one adapter, media
capability flips true) to bring video energy to My Hockey / Recap / Team / Player / Live Desk,
and register AHL/ECHL/OHL/QMJHL/NCAA scores+standings. A paid tier (any) unlocks major-league
highlights; the specific 5k vs 25k choice is a TRAFFIC decision, not a data decision.
