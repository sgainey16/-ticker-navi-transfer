"""WHL provider (universal provider chassis) — proof cut regression tests.

Covers:
- /api/leagues returns both NHL and WHL with capabilities
- /api/league/whl/scoreboard returns real WHL games
- /api/search aggregates across leagues (NHL + WHL) with subtitle 'WHL' for WHL results
- /api/ticker/segment?surface=next&league=whl returns beats grounded in WHL
- NHL regression: /api/nhl/scoreboard and /api/nhl/standings still 200
"""
import os
import pytest
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent.parent / "frontend" / ".env")
BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://team-nav-rail.preview.emergentagent.com").rstrip("/")

TIMEOUT = 45


# --- /api/leagues -----------------------------------------------------------
class TestLeagues:
    def test_leagues_returns_nhl_and_whl(self):
        r = requests.get(f"{BASE_URL}/api/leagues", timeout=TIMEOUT)
        assert r.status_code == 200
        data = r.json()
        codes = [l.get("code") for l in data.get("leagues", [])]
        assert "nhl" in codes
        assert "whl" in codes

    def test_leagues_have_capabilities(self):
        r = requests.get(f"{BASE_URL}/api/leagues", timeout=TIMEOUT)
        leagues = {l["code"]: l for l in r.json()["leagues"]}
        whl = leagues["whl"]
        assert whl.get("capabilities", {}).get("schedule") is True
        assert whl.get("capabilities", {}).get("search") is True
        # These are intentionally OFF for the proof cut:
        assert whl.get("capabilities", {}).get("team_page") is False
        assert whl.get("capabilities", {}).get("player_page") is False


# --- /api/league/whl/scoreboard --------------------------------------------
class TestWhlScoreboard:
    def test_scoreboard_has_real_games(self):
        r = requests.get(f"{BASE_URL}/api/league/whl/scoreboard", timeout=TIMEOUT)
        assert r.status_code == 200
        data = r.json()
        assert data.get("league_name") == "Western Hockey League"
        games = data.get("games", [])
        assert len(games) > 0
        g0 = games[0]
        # Each game must have real HockeyTech identifiers + logos.
        assert g0.get("id")
        assert g0["away"].get("abbr")
        assert g0["home"].get("abbr")
        away_logo = g0["away"].get("logo") or ""
        home_logo = g0["home"].get("logo") or ""
        assert "leaguestat.com" in away_logo or "leaguestat.com" in home_logo


# --- /api/search ------------------------------------------------------------
class TestUniversalSearch:
    def test_search_wheat_returns_whl_brandon(self):
        r = requests.get(f"{BASE_URL}/api/search", params={"q": "wheat"}, timeout=TIMEOUT)
        assert r.status_code == 200
        results = r.json().get("results", [])
        whl_teams = [x for x in results if x.get("type") == "team" and x.get("league_code") == "whl"]
        names = [t.get("name", "") for t in whl_teams]
        assert any("Brandon Wheat Kings" in n for n in names), f"Expected Brandon Wheat Kings, got {names}"

    def test_search_edmonton_returns_both_leagues(self):
        r = requests.get(f"{BASE_URL}/api/search", params={"q": "edmonton"}, timeout=TIMEOUT)
        assert r.status_code == 200
        results = r.json().get("results", [])
        nhl_hit = any(
            x.get("type") == "team" and x.get("league_code") == "nhl" and "Oilers" in (x.get("name") or "")
            for x in results
        )
        whl_hit = any(
            x.get("type") == "team" and x.get("league_code") == "whl" and "Oil Kings" in (x.get("name") or "")
            for x in results
        )
        assert nhl_hit, "Missing NHL Edmonton Oilers"
        assert whl_hit, "Missing WHL Edmonton Oil Kings"

    def test_search_regina_returns_whl_pats(self):
        r = requests.get(f"{BASE_URL}/api/search", params={"q": "regina"}, timeout=TIMEOUT)
        assert r.status_code == 200
        results = r.json().get("results", [])
        pats = [x for x in results if x.get("type") == "team" and x.get("league_code") == "whl" and "Regina Pats" in (x.get("name") or "")]
        assert pats, "Missing Regina Pats"
        # Subtitle should indicate WHL for the onboarding UI.
        assert pats[0].get("subtitle") == "WHL"


# --- /api/ticker/segment (WHL desk) ----------------------------------------
class TestWhlDeskSegment:
    def test_next_whl_segment_ready(self):
        r = requests.get(
            f"{BASE_URL}/api/ticker/segment",
            params={"surface": "next", "league": "whl"},
            timeout=90,
        )
        assert r.status_code == 200
        data = r.json()
        assert data.get("surface") == "next"
        assert data.get("subject") == "whl"
        # Should be either 'ready' (with beats) or 'unavailable' if LLM slow.
        # We require ready given backend is cached in Mongo per the request.
        assert data.get("state") == "ready", f"WHL desk state={data.get('state')}"
        beats = data.get("beats") or []
        assert len(beats) >= 2
        joined = " ".join(b.get("text", "") for b in beats).lower()
        # Grounding check: WHL cues should appear somewhere in the desk beats.
        assert "whl" in joined or "western hockey" in joined


# --- NHL regression ---------------------------------------------------------
class TestNhlRegression:
    def test_nhl_scoreboard_200(self):
        r = requests.get(f"{BASE_URL}/api/nhl/scoreboard", timeout=TIMEOUT)
        assert r.status_code == 200
        data = r.json()
        assert "games" in data

    def test_nhl_standings_200(self):
        r = requests.get(f"{BASE_URL}/api/nhl/standings", timeout=TIMEOUT)
        assert r.status_code == 200
