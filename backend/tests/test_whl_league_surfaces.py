"""WHL league-surface expansion tests (iteration 11).

Covers the WHL wiring into RECAP + STATS backed by real HockeyTech, plus the
league-aware recap desk segment, and confirms NHL regression.
"""
import os
import pytest
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent.parent / "frontend" / ".env")
BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://team-nav-rail.preview.emergentagent.com").rstrip("/")

TIMEOUT = 60


# --- /api/league/whl/standings ---------------------------------------------
class TestWhlStandings:
    def test_standings_has_both_conferences(self):
        r = requests.get(f"{BASE_URL}/api/league/whl/standings", timeout=TIMEOUT)
        assert r.status_code == 200
        data = r.json()
        assert "Eastern" in data and "Western" in data
        east = data["Eastern"]
        west = data["Western"]
        assert isinstance(east, list) and isinstance(west, list)
        assert len(east) > 0, "WHL Eastern conference standings empty"
        assert len(west) > 0, "WHL Western conference standings empty"

    def test_standings_rows_have_real_records(self):
        r = requests.get(f"{BASE_URL}/api/league/whl/standings", timeout=TIMEOUT)
        data = r.json()
        row = data["Eastern"][0]
        # Real record shape (numeric points/wins etc.)
        for k in ("abbr", "name", "wins", "losses", "points"):
            assert k in row, f"Missing key {k} in standings row: {row}"
        assert isinstance(row["points"], int)
        assert isinstance(row["wins"], int)

    def test_regina_pats_present_in_eastern(self):
        r = requests.get(f"{BASE_URL}/api/league/whl/standings", timeout=TIMEOUT)
        data = r.json()
        abbrs = [x.get("abbr") for x in data["Eastern"]]
        assert "REG" in abbrs, f"Expected REG in Eastern, got {abbrs}"


# --- /api/league/whl/leaders -----------------------------------------------
class TestWhlLeaders:
    def test_leaders_skaters_points_populated(self):
        r = requests.get(f"{BASE_URL}/api/league/whl/leaders", timeout=TIMEOUT)
        assert r.status_code == 200
        data = r.json()
        pts = data.get("skaters", {}).get("points", [])
        assert len(pts) > 0, "WHL skaters points empty"
        p0 = pts[0]
        assert p0.get("name"), "leader missing name"
        assert p0.get("team_abbr"), "leader missing team_abbr"
        assert isinstance(p0.get("value"), int), f"leader value not int: {p0}"

    def test_leaders_goalies_wins_populated(self):
        r = requests.get(f"{BASE_URL}/api/league/whl/leaders", timeout=TIMEOUT)
        data = r.json()
        wins = data.get("goalies", {}).get("wins", [])
        assert len(wins) > 0, "WHL goalie wins empty"
        g0 = wins[0]
        assert g0.get("name")
        assert isinstance(g0.get("value"), int)


# --- /api/league/whl/recaps ------------------------------------------------
class TestWhlRecaps:
    def test_recaps_returns_finals_with_scores(self):
        r = requests.get(f"{BASE_URL}/api/league/whl/recaps", timeout=TIMEOUT)
        assert r.status_code == 200
        games = r.json().get("games", [])
        assert len(games) > 0, "No WHL recent finals returned"
        g = games[0]
        # Verified scores present on finals (no fabrication)
        assert g["away"].get("score") is not None
        assert g["home"].get("score") is not None
        assert g.get("group") == "final"


# --- /api/ticker/segment?surface=recap&league=whl --------------------------
class TestWhlRecapDesk:
    def test_recap_whl_desk_ready(self):
        r = requests.get(
            f"{BASE_URL}/api/ticker/segment",
            params={"surface": "recap", "league": "whl"},
            timeout=120,
        )
        assert r.status_code == 200
        data = r.json()
        assert data.get("surface") == "recap"
        assert data.get("subject") == "whl"
        assert data.get("state") == "ready", f"WHL recap desk not ready: {data}"
        beats = data.get("beats") or []
        assert len(beats) >= 2

    def test_recap_nhl_desk_still_ready(self):
        r = requests.get(
            f"{BASE_URL}/api/ticker/segment",
            params={"surface": "recap", "league": "nhl"},
            timeout=120,
        )
        assert r.status_code == 200
        data = r.json()
        assert data.get("state") == "ready", f"NHL recap desk regressed: {data}"


# --- NHL regression --------------------------------------------------------
class TestNhlRegression:
    def test_nhl_standings(self):
        r = requests.get(f"{BASE_URL}/api/nhl/standings", timeout=TIMEOUT)
        assert r.status_code == 200
        data = r.json()
        assert len(data.get("Eastern", [])) > 0

    def test_nhl_leaders(self):
        r = requests.get(f"{BASE_URL}/api/nhl/leaders", timeout=TIMEOUT)
        assert r.status_code == 200
        data = r.json()
        assert len(data.get("skaters", {}).get("points", [])) > 0

    def test_nhl_recaps(self):
        r = requests.get(f"{BASE_URL}/api/nhl/recaps", timeout=TIMEOUT)
        assert r.status_code == 200
        assert len(r.json().get("games", [])) > 0
