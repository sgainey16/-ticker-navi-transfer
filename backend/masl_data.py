"""
MASL — Powered by Ticker : curated 2025-26 prototype dataset + arena-soccer knowledge layer.

The 2025-26 MASL season (Nov 28, 2025 - Mar 29, 2026) is complete. For this prototype
it is framed as the "current" season. All data below is curated to be internally
consistent and to honour the locked storylines from the build brief:
  - Rian Marques (San Diego Sockers) leads the league with 52 goals
  - Milwaukee's 17-2 demolition of Utica (record scoreline)
  - Utica's 11-game losing skid
  - The Ron Newman Cup playoff race
"""

# ---------------------------------------------------------------------------
# ARENA SOCCER KNOWLEDGE LAYER  (injected into Rayo & Casey's system prompt)
# ---------------------------------------------------------------------------

ARENA_KNOWLEDGE = """
=== ARENA SOCCER — RULES, FORMAT & TERMINOLOGY (MASL) ===

THE SPORT:
- Arena soccer (also called indoor/arena soccer) is its OWN sport — fast, high-scoring, played
  on field turf inside a hockey-sized arena surrounded by walls called the BOARDS (or dasher boards).
- The ball stays in play off the boards. Working the ball off the wall is "playing the boards."
- It is NOT outdoor soccer with fewer players. There is no open pitch, no throw-ins, no corner kicks
  in the outdoor sense — the boards keep the ball live.

FORMAT:
- SIX players per side: five outfield players PLUS a goalkeeper (6v6 including the keeper).
- FOUR quarters of 15 minutes each (60 minutes of game time). NOT halves, NOT periods — QUARTERS.
- UNLIMITED on-the-fly substitutions, hockey-style line changes through a substitution zone.
- No offside in arena soccer.
- THREE-LINE RULE: a player cannot pass or clear the ball in the air across all three lines
  (crossing both the red line and the far line on the fly) without it being touched — that is a
  "three-line violation," resulting in a free kick for the other team.
- BLUE CARD: a 2-minute time penalty. The offending player serves it in the PENALTY BOX and the
  team plays a man down — this creates a POWER PLAY (man-up) for the opponent and a PENALTY KILL
  (man-down) for the penalized team. Yellow = caution, Red = ejection.
- A goal is worth ONE point.
- Teams can PULL THE GOALKEEPER for a SIXTH ATTACKER late in games to chase a goal (leaving an empty net).
- Overtime is sudden-death GOLDEN GOAL.

POSITIONS: Goalkeeper (GK), Defenders, Midfielders, Forwards (a "target forward" is the focal
attacker). Because of unlimited subs, players rotate constantly.

KEY STATS TRACKED: Goals, Assists, Points (G+A), Shots, Shots on Goal (SOG), Possession %,
Power Play (conversions on the man-up), Saves, Save %, Goals-Against Average (GAA) for keepers.

CORRECT TERMINOLOGY (USE THESE): boards / dasher boards, quarter, power play, man-up / man-down,
penalty kill, penalty box, blue card, three-line violation, sixth attacker, golden goal,
the turf, the arena, goalkeeper / keeper, target forward, playing the boards, board-ball,
a goalmouth scramble, service into the box.

NEVER USE HOCKEY LANGUAGE. Banned words: puck, ice, rink, blue line / red line as HOCKEY lines,
slapshot, wrist shot, faceoff, icing, offsides (hockey), body-check, top shelf, five-hole,
zamboni. This is arena SOCCER — it's a BALL on TURF, shots and goals, not pucks on ice.
(Note: "power play," "penalty box," and "penalty kill" DO exist in arena soccer and are correct.)

HISTORY / LINEAGE: The modern game traces through the MISL (Major Indoor Soccer League) and
PASL eras. MASL is the top flight today, sitting atop a pyramid with M2, M3 and MASL W (women's)
below it. The championship trophy is the RON NEWMAN CUP, named for the legendary indoor coach.
""".strip()


# ---------------------------------------------------------------------------
# TEAMS
# ---------------------------------------------------------------------------

TEAMS = [
    {
        "id": "san-diego", "name": "San Diego Sockers", "short": "Sockers", "abbr": "SD",
        "city": "San Diego, CA", "conference": "Western", "arena": "Frontwave Arena",
        "primary": "#F5B301", "secondary": "#0B2A5B", "founded": 2009, "coach": "Phil Salvagio",
        "wins": 20, "losses": 4, "gf": 240, "ga": 150, "streak": "W6", "last5": "WWWWW", "seed": 1,
        "blurb": "The gold standard of arena soccer. Riding Rian Marques' record-chasing season, "
                 "the Sockers own the league's best record and the deepest trophy case in the sport.",
    },
    {
        "id": "baltimore", "name": "Baltimore Blast", "short": "Blast", "abbr": "BAL",
        "city": "Baltimore, MD", "conference": "Eastern", "arena": "SECU Arena",
        "primary": "#E23A2E", "secondary": "#111318", "founded": 1980, "coach": "David Bascome",
        "wins": 18, "losses": 6, "gf": 220, "ga": 160, "streak": "W2", "last5": "WWLWW", "seed": 1,
        "blurb": "One of indoor soccer's crown-jewel franchises. The Blast grind out low-error, "
                 "high-possession games and own the Eastern's top seed.",
    },
    {
        "id": "milwaukee", "name": "Milwaukee Wave", "short": "Wave", "abbr": "MIL",
        "city": "Milwaukee, WI", "conference": "Eastern", "arena": "UW-Milwaukee Panther Arena",
        "primary": "#1FA2C4", "secondary": "#0A1A2F", "founded": 1984, "coach": "Giuliano Oliviero",
        "wins": 17, "losses": 7, "gf": 235, "ga": 165, "streak": "W3", "last5": "WWWLW", "seed": 2,
        "blurb": "The Wave can bury you in a hurry — including a jaw-dropping 17-2 night against Utica "
                 "that set a modern scoreline record. When their transition game hums, nobody keeps up.",
    },
    {
        "id": "empire", "name": "Empire Strykers", "short": "Strykers", "abbr": "EMP",
        "city": "Ontario, CA", "conference": "Western", "arena": "Toyota Arena",
        "primary": "#7A2FF0", "secondary": "#12061F", "founded": 2011, "coach": "Zoran Karic",
        "wins": 16, "losses": 8, "gf": 200, "ga": 175, "streak": "L1", "last5": "WWLWL", "seed": 2,
        "blurb": "Reigning contenders out west. The Strykers live on the power play and a suffocating "
                 "man-down penalty kill, making them a nightmare draw in the Ron Newman Cup race.",
    },
    {
        "id": "tacoma", "name": "Tacoma Stars", "short": "Stars", "abbr": "TAC",
        "city": "Tacoma, WA", "conference": "Western", "arena": "accesso ShoWare Center",
        "primary": "#2ECC71", "secondary": "#0A2018", "founded": 1983, "coach": "Darren Sawatzky",
        "wins": 13, "losses": 11, "gf": 180, "ga": 185, "streak": "W1", "last5": "WLWLW", "seed": 3,
        "blurb": "A boards-heavy, physical outfit that plays the wall as well as anyone. Fighting to "
                 "lock down a home playoff berth in a crowded Western picture.",
    },
    {
        "id": "kansas-city", "name": "Kansas City Comets", "short": "Comets", "abbr": "KC",
        "city": "Kansas City, MO", "conference": "Western", "arena": "Cable Dahmer Arena",
        "primary": "#F27023", "secondary": "#101317", "founded": 2010, "coach": "Stefan Stokic",
        "wins": 11, "losses": 13, "gf": 175, "ga": 190, "streak": "L2", "last5": "LWLWL", "seed": 4,
        "blurb": "A proud market chasing the last Western playoff spot. Young legs, on-the-fly energy, "
                 "and a home crowd that turns the arena into a pressure cooker.",
    },
    {
        "id": "st-louis", "name": "St. Louis Ambush", "short": "Ambush", "abbr": "STL",
        "city": "St. Louis, MO", "conference": "Eastern", "arena": "The Family Arena",
        "primary": "#111318", "secondary": "#C0392B", "founded": 2013, "coach": "Hewerton Moreira",
        "wins": 10, "losses": 14, "gf": 160, "ga": 205, "streak": "L3", "last5": "LLWLL", "seed": 3,
        "blurb": "Rebuilding on the fly. The Ambush flash real quality in stretches but leak goals off "
                 "the boards in transition — the difference between a scare and a win.",
    },
    {
        "id": "utica", "name": "Utica City FC", "short": "Utica City", "abbr": "UTI",
        "city": "Utica, NY", "conference": "Eastern", "arena": "Adirondack Bank Center",
        "primary": "#1E7A45", "secondary": "#0A140E", "founded": 2017, "coach": "Nnamdi Nwokocha",
        "wins": 3, "losses": 21, "gf": 120, "ga": 260, "streak": "L11", "last5": "LLLLL", "seed": 4,
        "blurb": "It's been a brutal year — an 11-game losing skid and the wrong end of a 17-2 night in "
                 "Milwaukee. But the room hasn't quit, and the boards are still their best friend at home.",
    },
]

TEAMS_BY_ID = {t["id"]: t for t in TEAMS}


def _pct(w, l):
    g = w + l
    return round(w / g, 3) if g else 0.0


for _t in TEAMS:
    _t["pct"] = _pct(_t["wins"], _t["losses"])
    _t["gd"] = _t["gf"] - _t["ga"]
    _t["points"] = _t["wins"] * 3


# ---------------------------------------------------------------------------
# PLAYERS
# ---------------------------------------------------------------------------

def _p(pid, name, team, num, pos, g=0, a=0, gp=24, saves=None, sv_pct=None, gaa=None, blurb=""):
    player = {
        "id": pid, "name": name, "team_id": team, "number": num, "position": pos,
        "games": gp, "goals": g, "assists": a, "points": g + a, "blurb": blurb,
    }
    if pos == "GK":
        player.update({"saves": saves, "save_pct": sv_pct, "gaa": gaa, "goals": 0, "assists": a, "points": a})
    return player


PLAYERS = [
    # San Diego Sockers
    _p("rian-marques", "Rian Marques", "san-diego", 10, "F", g=52, a=21, blurb="The face of the league. 52 goals in a single campaign — a target forward with a first touch that turns a board-ball into a finish before keepers can set."),
    _p("kraig-chiles", "Kraig Chiles", "san-diego", 7, "F", g=31, a=18, blurb="A relentless second scoring threat who thrives on the man-up power play."),
    _p("nick-perera-sd", "Leonardo De Oliveira", "san-diego", 11, "M", g=22, a=29, blurb="The Sockers' metronome — dictates possession and feeds Marques in the box."),
    _p("william-vanzela", "William Vanzela", "san-diego", 1, "GK", saves=420, sv_pct=0.842, gaa=6.25, a=2, blurb="A wall in goal. His save percentage anchors the league's stingiest defense."),
    _p("brandon-escoto", "Brandon Escoto", "san-diego", 4, "D", g=6, a=15, blurb="Two-way defender who springs the transition off the boards."),

    # Baltimore Blast
    _p("juan-pereira", "Juan Pereira", "baltimore", 9, "F", g=44, a=19, blurb="Second in the league in goals — a cold-blooded finisher in tight."),
    _p("william-eskay", "William Eskay", "baltimore", 8, "M", g=19, a=33, blurb="Assist machine who runs Baltimore's patient board-possession game."),
    _p("vini-dantas", "Vini Dantas", "baltimore", 14, "F", g=27, a=14, blurb="A power-play specialist who lives in the pocket."),
    _p("william-vieira", "William Vieira", "baltimore", 1, "GK", saves=395, sv_pct=0.829, gaa=6.67, a=1, blurb="Steady hands behind the Eastern's best record."),

    # Milwaukee Wave
    _p("ian-bennett", "Ian Bennett", "milwaukee", 10, "F", g=41, a=25, blurb="A blur in transition. Bennett torched Utica in the 17-2 rout and never let up."),
    _p("marcio-leite", "Marcio Leite", "milwaukee", 7, "F", g=33, a=20, blurb="Deadly off the wall — turns board-balls into instant offense."),
    _p("max-touloute", "Max Touloute", "milwaukee", 5, "M", g=17, a=28, blurb="The engine of Milwaukee's run-and-gun attack."),
    _p("mateus-vieira", "Mateus Vieira", "milwaukee", 1, "GK", saves=410, sv_pct=0.821, gaa=6.88, a=0, blurb="Aggressive keeper who starts the break the second he gloves it."),

    # Empire Strykers
    _p("franck-tayou", "Franck Tayou", "empire", 11, "F", g=38, a=22, blurb="A physical target forward who bullies defenders on the man-up."),
    _p("nico-gonzalez", "Nico Gonzalez", "empire", 8, "M", g=20, a=24, blurb="Sets the tempo and quarterbacks the power play."),
    _p("hugo-silva", "Hugo Silva", "empire", 9, "F", g=26, a=16, blurb="Late-game closer with a knack for golden-goal moments."),
    _p("victor-parreiras", "Victor Parreiras", "empire", 1, "GK", saves=388, sv_pct=0.812, gaa=7.29, a=0, blurb="Elite on the penalty kill — the backbone of the Strykers' man-down."),

    # Tacoma Stars
    _p("nick-perera", "Nick Perera", "tacoma", 10, "F", g=35, a=23, blurb="A veteran finisher and the heartbeat of Tacoma's board-heavy attack."),
    _p("mohammed-alattas", "Mohammed Alattas", "tacoma", 7, "F", g=22, a=12, blurb="Speed to burn on the counter — don't blink."),
    _p("nils-vinberg", "Nils Vinberg", "tacoma", 1, "GK", saves=402, sv_pct=0.804, gaa=7.71, a=1, blurb="Faces a ton of rubber and keeps the Stars in games."),

    # Kansas City Comets
    _p("guy-abend", "Guy Abend", "kansas-city", 9, "F", g=29, a=17, blurb="A tireless worker who drags the Comets into the playoff race."),
    _p("leo-gibson", "Leo Gibson", "kansas-city", 8, "M", g=18, a=26, blurb="Franchise cornerstone and the smartest passer in the building."),
    _p("john-sosa", "John Sosa", "kansas-city", 1, "GK", saves=430, sv_pct=0.799, gaa=7.92, a=0, blurb="Busiest keeper in the league — a one-man penalty kill on some nights."),

    # St. Louis Ambush
    _p("zach-reget", "Zach Reget", "st-louis", 11, "F", g=25, a=15, blurb="A crafty finisher trying to keep a rebuilding Ambush relevant."),
    _p("stefan-stokic-p", "Lucas Roque", "st-louis", 8, "M", g=16, a=21, blurb="Creative spark plug who shines when the Ambush actually keep the ball."),
    _p("paulo-nascimento", "Paulo Nascimento", "st-louis", 1, "GK", saves=445, sv_pct=0.785, gaa=8.54, a=0, blurb="Peppered nightly behind a leaky transition defense."),

    # Utica City FC
    _p("slobodan-cvetkovic", "Slobodan Cvetkovic", "utica", 10, "F", g=21, a=12, blurb="The lone bright spot in a brutal year — still competes every shift."),
    _p("nikola-vignjevic", "Nikola Vignjevic", "utica", 7, "M", g=13, a=15, blurb="Young playmaker learning on the job in a losing season."),
    _p("chris-toth", "Chris Toth", "utica", 1, "GK", saves=470, sv_pct=0.742, gaa=10.83, a=0, blurb="No keeper in the league has faced more — the man in the barrel behind the 11-game skid."),
]

PLAYERS_BY_ID = {p["id"]: p for p in PLAYERS}


def players_for_team(team_id):
    return [p for p in PLAYERS if p["team_id"] == team_id]


# ---------------------------------------------------------------------------
# GAMES / RECAPS
# ---------------------------------------------------------------------------

def _game(gid, date, home, away, hs, as_, quarters, stats, timeline, rayo, casey, featured=False, video_id=None, status="Final", label=""):
    return {
        "id": gid, "date": date, "status": status, "label": label,
        "home_id": home, "away_id": away, "home_score": hs, "away_score": as_,
        "quarters": quarters, "stats": stats, "timeline": timeline,
        "commentary": {"rayo": rayo, "casey": casey}, "featured": featured,
        "video_id": video_id,
    }


GAMES = [
    _game(
        "mil-uti-17-2", "2026-03-20", "milwaukee", "utica", 17, 2,
        quarters=[[4, 1], [5, 0], [4, 1], [4, 0]],
        stats={
            "home": {"goals": 17, "shots": 52, "sog": 34, "possession": 68, "power_play": "4/5", "saves": 12},
            "away": {"goals": 2, "shots": 21, "sog": 11, "possession": 32, "power_play": "1/4", "saves": 17},
        },
        timeline=[
            {"q": 1, "time": "13:40", "team": "milwaukee", "player": "Ian Bennett", "note": "Board-ball, roofed it"},
            {"q": 1, "time": "09:12", "team": "milwaukee", "player": "Marcio Leite", "note": "Power play, man-up"},
            {"q": 2, "time": "11:05", "team": "milwaukee", "player": "Ian Bennett", "note": "Breakaway, don't blink"},
            {"q": 3, "time": "06:33", "team": "utica", "player": "Slobodan Cvetkovic", "note": "Consolation off the wall"},
            {"q": 4, "time": "02:10", "team": "milwaukee", "player": "Max Touloute", "note": "17th goal — league record"},
        ],
        rayo="Seventeen! SEVENTEEN! I've never seen a board game turn into a track meet like this — the Wave were flying and Utica couldn't get a line change to stick. That's arena soccer, baby.",
        casey="The tape says otherwise on effort — Utica just got buried by transition. Milwaukee turned 34 shots on goal into 17, and a 4-for-5 power play is the real story. That's a new MASL team record for goals in a game.",
        featured=True,
        video_id="opW7LVDvTkQ",
        label="RECORD NIGHT · 3.20.26",
    ),
    _game(
        "sd-emp-marques", "2025-11-29", "san-diego", "empire", 7, 6,
        quarters=[[2, 2], [2, 1], [2, 2], [1, 1]],
        stats={
            "home": {"goals": 7, "shots": 41, "sog": 26, "possession": 57, "power_play": "3/4", "saves": 15},
            "away": {"goals": 6, "shots": 33, "sog": 19, "possession": 43, "power_play": "2/5", "saves": 19},
        },
        timeline=[
            {"q": 1, "time": "12:20", "team": "san-diego", "player": "Rian Marques", "note": "Target-forward finish"},
            {"q": 2, "time": "08:47", "team": "san-diego", "player": "Rian Marques", "note": "Power play hammer"},
            {"q": 3, "time": "05:02", "team": "empire", "player": "Franck Tayou", "note": "Man-up bury"},
            {"q": 4, "time": "01:33", "team": "san-diego", "player": "Rian Marques", "note": "Hat trick, seals it"},
        ],
        rayo="¡Rayo! Marques with the hat trick and the man is REWRITING the record book. When he gets a yard in the box, it's already in — I felt that third one.",
        casey="Let's slow it down for a second: another multi-goal night keeps him on pace for fifty-plus. San Diego's 3-for-4 on the power play is why they edged it — Empire couldn't survive the man-down.",
        video_id="wrvbAD76QdE",
        label="SOCKERS EDGE STRYKERS",
    ),
    _game(
        "bal-kc-comets", "2026-03-21", "baltimore", "kansas-city", 5, 8,
        quarters=[[1, 2], [1, 2], [2, 2], [1, 2]],
        stats={
            "home": {"goals": 5, "shots": 33, "sog": 18, "possession": 52, "power_play": "1/4", "saves": 16},
            "away": {"goals": 8, "shots": 39, "sog": 24, "possession": 48, "power_play": "3/4", "saves": 13},
        },
        timeline=[
            {"q": 1, "time": "10:15", "team": "kansas-city", "player": "Leo Gibson", "note": "Fast break off the turnover"},
            {"q": 2, "time": "07:30", "team": "baltimore", "player": "Vini Dantas", "note": "Off the boards"},
            {"q": 3, "time": "04:11", "team": "kansas-city", "player": "Guy Abend", "note": "Power play dagger"},
            {"q": 4, "time": "02:02", "team": "kansas-city", "player": "Vahid Assadpour", "note": "Seals the road win"},
        ],
        rayo="Kansas City walked into Baltimore and took it, baby! Gibson pushing the tempo, Abend on the man-up — the Comets never let the Blast breathe.",
        casey="That's the upset blueprint. KC won the transition battle and cashed a 3-for-4 power play. On the road, in Baltimore — that's not luck, that's a pattern.",
        video_id="-tNpJHj-DWY",
        label="COMETS TOP BLAST",
    ),
    _game(
        "mil-stl-ot", "2025-12-14", "milwaukee", "st-louis", 6, 7,
        quarters=[[2, 1], [1, 2], [2, 2], [1, 2]],
        stats={
            "home": {"goals": 6, "shots": 44, "sog": 27, "possession": 55, "power_play": "2/4", "saves": 14},
            "away": {"goals": 7, "shots": 31, "sog": 20, "possession": 45, "power_play": "2/3", "saves": 21},
        },
        timeline=[
            {"q": 1, "time": "11:50", "team": "milwaukee", "player": "Ian Bennett", "note": "Hat trick underway"},
            {"q": 3, "time": "05:20", "team": "milwaukee", "player": "Ian Bennett", "note": "Completes the hat trick"},
            {"q": 4, "time": "03:44", "team": "st-louis", "player": "Zach Reget", "note": "Ties it off the wall"},
            {"q": 4, "time": "00:22", "team": "st-louis", "player": "Daniel Torrealba", "note": "Overtime winner"},
        ],
        rayo="A hat trick from the legend Ian Bennett and STILL Milwaukee couldn't close it! Torrealba in overtime — mano, that's why you never blink in this league.",
        casey="St. Louis' keeper stole it — twenty-one saves. When you get outshot 44 to 31 and still win in overtime, that's a goalkeeper performance, plain and simple.",
        video_id="X2vnyC1SrSE",
        status="Final (OT)",
        label="AMBUSH STEAL IT IN OT",
    ),
    _game(
        "rnc-final-g3", "2026-04-27", "san-diego", "milwaukee", 10, 3,
        quarters=[[3, 1], [2, 1], [3, 1], [2, 0]],
        stats={
            "home": {"goals": 10, "shots": 46, "sog": 30, "possession": 62, "power_play": "3/4", "saves": 18},
            "away": {"goals": 3, "shots": 28, "sog": 17, "possession": 38, "power_play": "1/5", "saves": 20},
        },
        timeline=[
            {"q": 1, "time": "12:05", "team": "san-diego", "player": "Rian Marques", "note": "Sets the tone early"},
            {"q": 2, "time": "07:41", "team": "milwaukee", "player": "Ian Bennett", "note": "Brief answer for the Wave"},
            {"q": 3, "time": "06:18", "team": "san-diego", "player": "Brandon Escoto", "note": "Blows it open"},
            {"q": 4, "time": "01:10", "team": "san-diego", "player": "Rian Marques", "note": "Ices the title"},
        ],
        rayo="TEN to THREE for the title! San Diego lifts the Ron Newman Cup and the Sockers are champions AGAIN. I felt every one of those goals, mi gente — a dynasty rolls on.",
        casey="Game 3 was a clinic. San Diego controlled possession, 3-for-4 on the power play, and Milwaukee had no answer in transition. That's how you win a championship series.",
        video_id="tlF8VAlXFyY",
        label="RON NEWMAN CUP · FINAL G3",
    ),
]

GAMES_BY_ID = {g["id"]: g for g in GAMES}


# ---------------------------------------------------------------------------
# LEADERS
# ---------------------------------------------------------------------------

def _leaders(stat, reverse=True, gk=False, limit=8):
    pool = [p for p in PLAYERS if (p["position"] == "GK") == gk]
    return sorted(pool, key=lambda p: p.get(stat, 0), reverse=reverse)[:limit]


LEADERS = {
    "goals": [{"id": p["id"], "name": p["name"], "team_id": p["team_id"], "value": p["goals"]} for p in _leaders("goals")],
    "assists": [{"id": p["id"], "name": p["name"], "team_id": p["team_id"], "value": p["assists"]} for p in _leaders("assists")],
    "points": [{"id": p["id"], "name": p["name"], "team_id": p["team_id"], "value": p["points"]} for p in _leaders("points")],
    "saves": [{"id": p["id"], "name": p["name"], "team_id": p["team_id"], "value": p["saves"]} for p in _leaders("saves", gk=True)],
}


# ---------------------------------------------------------------------------
# AVAILABILITY REPORT (injuries / discipline) — mirrors MASL's public report
# ---------------------------------------------------------------------------

AVAILABILITY = [
    {"player": "Kraig Chiles", "team_id": "san-diego", "status": "Questionable", "reason": "Lower-body (knee)", "note": "Game-time decision"},
    {"player": "Franck Tayou", "team_id": "empire", "status": "Out", "reason": "Suspension", "note": "Serving 1 game — accumulation of blue cards"},
    {"player": "Leo Gibson", "team_id": "kansas-city", "status": "Available", "reason": "Cleared", "note": "Full participant"},
    {"player": "Chris Toth", "team_id": "utica", "status": "Questionable", "reason": "Upper-body", "note": "Heavy workload, load-managed"},
    {"player": "Ian Bennett", "team_id": "milwaukee", "status": "Available", "reason": "Cleared", "note": "No restrictions"},
]


# ---------------------------------------------------------------------------
# STANDINGS
# ---------------------------------------------------------------------------

def standings():
    east = sorted([t for t in TEAMS if t["conference"] == "Eastern"], key=lambda t: (-t["points"], -t["gd"]))
    west = sorted([t for t in TEAMS if t["conference"] == "Western"], key=lambda t: (-t["points"], -t["gd"]))

    def row(t, rank):
        return {
            "id": t["id"], "name": t["name"], "short": t["short"], "abbr": t["abbr"],
            "primary": t["primary"], "secondary": t["secondary"],
            "rank": rank, "wins": t["wins"], "losses": t["losses"], "pct": t["pct"],
            "gf": t["gf"], "ga": t["ga"], "gd": t["gd"], "points": t["points"],
            "streak": t["streak"], "last5": t["last5"],
        }

    return {
        "Eastern": [row(t, i + 1) for i, t in enumerate(east)],
        "Western": [row(t, i + 1) for i, t in enumerate(west)],
    }


# ---------------------------------------------------------------------------
# TICKER STRIP
# ---------------------------------------------------------------------------

TICKER = [
    "FINAL: MIL 17 — UTI 2",
    "R. MARQUES (SD) leads all scorers — 52 G",
    "FINAL: SD 9 — EMP 6",
    "UTICA drops 11th straight",
    "FINAL: BAL 8 — STL 5",
    "RON NEWMAN CUP race tightens out West",
    "FINAL: TAC 7 — KC 6",
    "SAN DIEGO clinches West No.1 seed",
    "I. BENNETT (MIL) — 41 G, 25 A",
    "AVAILABILITY: F. Tayou (EMP) OUT — suspension",
]


# ---------------------------------------------------------------------------
# COLD OPEN — the Victory+ hook
# ---------------------------------------------------------------------------

COLD_OPEN = {
    "title": "MASL Cold Open",
    "subtitle": "The Wave's record night",
    "matchup": {"home": "milwaukee", "away": "utica", "home_score": 17, "away_score": 2},
    "beats": [
        {"id": 1, "host": "rayo", "kicker": "OPEN HOT",
         "text": "Seventeen to two! I've been around this sport my whole life, and I have NEVER seen the boards light up like Milwaukee did on Utica. That's arena soccer, baby — don't blink!"},
        {"id": 2, "host": "casey", "kicker": "THE STAT",
         "text": "Let's slow it down for a second. Seventeen goals on thirty-four shots on goal — a fifty percent conversion night. And a four-for-five power play. The tape says otherwise on 'fluke' — that was a clinic in transition."},
        {"id": 3, "host": "rayo", "kicker": "THE TREND",
         "text": "And the Wave aren't slowing down — three straight now, flying up the Eastern. Every line change, they come at you in waves. Don't blink."},
        {"id": 4, "host": "casey", "kicker": "THE STORYLINE",
         "text": "Meanwhile San Diego's Rian Marques just hit fifty-two goals on the season — a number this league hasn't seen in years. The Ron Newman Cup runs through him."},
        {"id": 5, "host": "rayo", "kicker": "THE HOOK",
         "text": "Records falling, a title race heating up, and the fastest game on turf. You do NOT want to miss what's next."},
        {"id": 6, "host": "system", "kicker": "",
         "text": "WATCH LIVE ON VICTORY+"},
    ],
}


# ---------------------------------------------------------------------------
# PER-PAGE BANTER SEGMENTS
# When the panel is "on air", each tab has its own short banter segment. As the
# viewer changes pages the segment changes, while they keep browsing the page.
# Same beat shape as COLD_OPEN: {id, host, kicker, text}. Arena-soccer language only.
# ---------------------------------------------------------------------------

SEGMENTS = {
    # HOME = the full cold open (ends on the Victory+ hook).
    "home": COLD_OPEN["beats"],

    "recap": [
        {"id": 1, "host": "rayo", "kicker": "ROLL THE TAPE",
         "text": "Roll it back! Almost every one of these came in transition — one touch off the boards and it's in the back of the net. Fastest game on turf, baby!"},
        {"id": 2, "host": "casey", "kicker": "THE FINISHING",
         "text": "Look at the conversion. Thirty-plus shots on goal a night across this slate, and the top sides are burying better than one in three. That's not luck — that's a pattern."},
        {"id": 3, "host": "rayo", "kicker": "THE RECORD",
         "text": "And Milwaukee — seventeen goals on Utica. Seventeen! I've never seen a scoreline light up the boards like that. Don't blink or you miss three."},
        {"id": 4, "host": "casey", "kicker": "THE KEEPERS",
         "text": "Don't sleep on the goalkeepers, though. The saves that never make the reel are the ones swinging these games — a diving stop off the glass changes everything."},
        {"id": 5, "host": "rayo", "kicker": "THE BOARDS",
         "text": "The boards are a weapon, mano. A good side plays the ricochet before the defender even turns. That's arena soccer, baby!"},
    ],

    "tonight": [
        {"id": 1, "host": "rayo", "kicker": "THE SLATE",
         "text": "Tonight's slate is stacked. Four quarters, six a side, and nobody's playing it safe. I can already feel the building shaking."},
        {"id": 2, "host": "casey", "kicker": "SPECIAL TEAMS",
         "text": "Watch the power-play battle. The clubs converting on the man-advantage are the ones climbing the table. Special teams decide these nights."},
        {"id": 3, "host": "rayo", "kicker": "THE ROOMS",
         "text": "San Diego, Baltimore, Milwaukee — every one of these rooms thinks they can win it all. And you know what? They're not wrong."},
        {"id": 4, "host": "casey", "kicker": "THE KEY",
         "text": "The key is transition defense. Give up the fast break in this league and you're chasing the game by the second quarter."},
        {"id": 5, "host": "rayo", "kicker": "THE RACE",
         "text": "It's a knife fight for that Ron Newman Cup. Every possession matters now. Don't blink."},
    ],

    "reels": [
        {"id": 1, "host": "rayo", "kicker": "HIGHLIGHTS",
         "text": "Highlights are coming! Every ricochet off the boards, every diving keeper save, every big finish — all in one reel, mi gente."},
        {"id": 2, "host": "casey", "kicker": "FRAME BY FRAME",
         "text": "We'll break each clip down frame by frame — the read, the touch, the finish. The tape always tells the story."},
        {"id": 3, "host": "rayo", "kicker": "THE FINISHES",
         "text": "Marques, Bennett, Perera — these guys make the impossible look routine. Watch the feet, watch the angle. Pure art on turf!"},
        {"id": 4, "host": "casey", "kicker": "THE DETAIL",
         "text": "And notice the off-ball movement. The goal you see is the payoff — the real work happened three seconds earlier."},
    ],

    "scores": [
        {"id": 1, "host": "casey", "kicker": "READ THE TABLE",
         "text": "Let's slow it down and read the table. San Diego holds the top seed, Baltimore right behind, but the points gap through the middle is razor-thin."},
        {"id": 2, "host": "rayo", "kicker": "EVERY POINT",
         "text": "Every win is gold right now, baby. One three-point night and you jump three spots in the standings. That's arena soccer!"},
        {"id": 3, "host": "casey", "kicker": "THE TIEBREAKER",
         "text": "Goal differential is the tiebreaker to watch. Milwaukee's plus column exploded after that seventeen-goal night."},
        {"id": 4, "host": "rayo", "kicker": "THE BUBBLE",
         "text": "And look at the bubble — Empire, Tacoma, all scrapping for that last playoff spot. Nobody's safe, nobody's out. Don't blink!"},
        {"id": 5, "host": "casey", "kicker": "THE CUSHION",
         "text": "The top two seeds earn the first-round bye. That cushion is worth its weight in April — rest matters in a best-of-three."},
    ],

    "stats": [
        {"id": 1, "host": "rayo", "kicker": "FIFTY-TWO",
         "text": "Fifty-two goals for Rian Marques! I've never seen a target forward cook a league like this — I felt every one of them."},
        {"id": 2, "host": "casey", "kicker": "EFFICIENCY",
         "text": "And it's efficient. His finishing rate off the boards is the best in the league — he turns half-chances into goals."},
        {"id": 3, "host": "rayo", "kicker": "THE PLAYMAKERS",
         "text": "But the assist men make it sing! A perfect ball off the wall, laid right onto the boot — that's chemistry you can't fake."},
        {"id": 4, "host": "casey", "kicker": "THE KEEPERS",
         "text": "Check the save numbers too. A goalkeeper stealing two a night is worth more than another scorer in this league."},
        {"id": 5, "host": "rayo", "kicker": "LOADED",
         "text": "Top to bottom, this leaderboard is loaded. Golden era on turf — don't blink!"},
    ],
}




# ---------------------------------------------------------------------------
# ElevenLabs Voice Design briefs (Cold Open host voices)
# ---------------------------------------------------------------------------

VOICE_BRIEFS = {
    "rayo": {
        "name": "MASL — Rayo",
        "description": (
            "A male voice, late 20s to mid-30s, Mexican-American raised in Southern California. "
            "Warm and slightly raspy from real energy, fast-talking and rhythmic, a mid-to-low tenor "
            "with chest resonance that carries over crowd noise. A light, authentic Latino cadence with "
            "natural English-Spanish code-switching, never a heavy or exaggerated accent. High-energy "
            "sports play-by-play that always sounds one beat away from getting louder, but can drop into "
            "warm, playful banter."
        ),
        "sample": (
            "Alright, Milwaukee's rolling in hot. Casey, watch the boards here, watch the boards, this is "
            "where it gets fast. And RAYO! Oh, that's arena soccer, baby, did you see that bounce?! "
            "Vamonos, this is the sequence we've been waiting for all quarter."
        ),
    },
    "casey": {
        "name": "MASL — Casey",
        "description": (
            "A calm, dry, precise male sports analyst voice, mid-30s, American, with a measured news-desk "
            "delivery. Low-key and thoughtful, never rushed, with understated wit, the composed counterpart "
            "to an excitable play-by-play partner. Clear, grounded and articulate, letting each stat land "
            "without theatrics."
        ),
        "sample": (
            "Let's slow it down for a second. The tape says otherwise. That seventeen-goal night wasn't luck, "
            "it was a pattern: thirty-four shots on goal and a four-for-five power play. When you convert at "
            "that rate, the scoreline takes care of itself."
        ),
    },
}


def home_feed():
    st = standings()
    return {
        "cold_open": {
            "title": COLD_OPEN["title"],
            "subtitle": COLD_OPEN["subtitle"],
            "matchup": COLD_OPEN["matchup"],
        },
        "featured_game": next((g["id"] for g in GAMES if g.get("featured")), GAMES[0]["id"]),
        "ticker": TICKER,
        "leader": {
            "id": "rian-marques", "name": "Rian Marques", "team_id": "san-diego",
            "stat": "52 GOALS", "label": "League Scoring Leader",
        },
        "standings_snippet": {
            "Eastern": st["Eastern"][:2],
            "Western": st["Western"][:2],
        },
        "recaps": [
            {"id": g["id"], "home_id": g["home_id"], "away_id": g["away_id"],
             "home_score": g["home_score"], "away_score": g["away_score"], "date": g["date"]}
            for g in GAMES
        ],
    }


# ---------------------------------------------------------------------------
# SEASON SUMMARY string for the LLM knowledge layer
# ---------------------------------------------------------------------------

def season_context():
    lines = ["=== 2025-26 MASL SEASON (current-season framing) ===", "", "STANDINGS:"]
    st = standings()
    for conf in ("Eastern", "Western"):
        lines.append(f"  {conf} Conference:")
        for r in st[conf]:
            lines.append(f"    {r['rank']}. {r['name']} — {r['wins']}-{r['losses']} ({r['points']} pts), "
                         f"GF {r['gf']} / GA {r['ga']}, streak {r['streak']}")
    lines.append("")
    lines.append("SCORING LEADERS (goals): " + ", ".join(f"{d['name']} {d['value']}" for d in LEADERS["goals"][:5]))
    lines.append("ASSIST LEADERS: " + ", ".join(f"{d['name']} {d['value']}" for d in LEADERS["assists"][:4]))
    lines.append("")
    lines.append("KEY STORYLINES:")
    lines.append("  - Rian Marques (San Diego Sockers) leads the league with 52 goals — a record-chasing season.")
    lines.append("  - Milwaukee Wave beat Utica City FC 17-2, a modern record scoreline.")
    lines.append("  - Utica City FC are mired in an 11-game losing skid.")
    lines.append("  - San Diego (West) and Baltimore (East) hold the top seeds in the Ron Newman Cup race.")
    lines.append("")
    lines.append("AVAILABILITY REPORT: " + "; ".join(
        f"{a['player']} ({TEAMS_BY_ID[a['team_id']]['abbr']}) — {a['status']} ({a['reason']})" for a in AVAILABILITY))
    return "\n".join(lines)
