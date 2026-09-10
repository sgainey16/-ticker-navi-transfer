# Second-league recon (Sep 10, 2026) — awaiting approval to build

Goal: fastest REAL second league to plug into the provider registry so Reggie+Marc talk about hockey happening now (before NHL opens Sep 29 / preseason Sep 19).

## Connected today
- ONLY NHL (api-web.nhle.com). No Highlightly / Sportlogiq / Elite Prospects keys in this fork.

## Verified LIVE (real calls)
### WHL via HockeyTech / Leaguestat  ← RECOMMENDED, fastest
- Free PUBLIC key, no signup, no key needed from user.
- Base: `https://lscluster.hockeytech.com/feed/index.php?feed=modulekit&key=f1aa699db3d81487&client_code=whl&fmt=json&lang=en&view={view}`
  - OHL: client_code=ohl, key=f1aa699db3d81487
  - QMJHL: client_code=lhjmq, key=f322673b6bcae299
- Verified views (WHL, season_id 295 = "2026-27 Regular Season", starts 2026-09-18; 294 = preseason Aug30-Sep13 PLAYING NOW):
  - `view=scorebar&numberofdaysahead=&numberofdaysback=` → live/recent/upcoming games (real preseason games returned)
  - `view=seasons` → season list w/ start/end dates
  - `view=teamsbyseason` → real clubs + divisions (Brandon Wheat Kings, Saskatoon Blades…)
  - `view=roster&team_id=&season_id=` → roster (players populate in-season)
  - `view=statviewtype&type=topscorers&season_id=` → leaders (empty pre-season, populates once games played)
  - standings via `feed=statviewfeed&view=teams&groupTeamsBy=division&season={id}&...` → JSONP-wrapped standings (strip wrapper)
- Maps to canonical League→Team→Player→Game. One adapter also unlocks OHL/QMJHL (change client_code).

### Elite Prospects API — Champions HL / Liiga / SHL / DEL (+900 leagues)
- PAID annual subscription + manual key request (email api@eliteprospects.com). NOT free, slower.
- Endpoints: https://api.eliteprospects.com/v1/leagues/{slug}/standings|teams (slugs: champions-hl, liiga…). Bearer key.
- => later wave, not the proving ground.

## Recommendation
Build `WHLProvider` (HockeyTech) as the real second league. Free, no user key, playing now.
Build plan (pending user OK): WHLProvider adapter -> register in providers/registry.py -> capabilities-gated surfaces (missing => hide, no fake) -> light frontend league context so NHL/WHL coexist -> Reggie+Marc read WHL through same contract.
