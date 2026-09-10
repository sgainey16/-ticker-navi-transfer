"""WHL DEPTH sub-cut (iteration 12).

Verifies league-aware depth endpoints:
  - /api/league/whl/team/REG (Regina Pats real data, scorers empty, roster null)
  - /api/league/whl/game/<final_id> (real FINAL, empty scoring)
  - /api/league/whl/player/<x> -> 502 (gated by design)
  - /api/leagues capabilities: whl team_page true, player_page false
  - NHL regression on /api/nhl/team/BOS, /api/nhl/game/latest, /api/nhl/player/8478402
"""
import os
import pytest
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent.parent / "frontend" / ".env")
BASE_URL = os.environ.get(
    "EXPO_PUBLIC_BACKEND_URL",
    "https://league-mobile-app.preview.emergentagent.com",
).rstrip("/")

TIMEOUT = 60


# --- /api/leagues capabilities ---------------------------------------------
class TestLeaguesRegistry:
    def test_whl_capabilities(self):
        r = requests.get(f"{BASE_URL}/api/leagues", timeout=TIMEOUT)
        assert r.status_code == 200
        data = r.json()
        leagues = {l["code"]: l for l in data.get("leagues", [])}
        assert "whl" in leagues, f"WHL missing from /api/leagues: {leagues.keys()}"
        caps = leagues["whl"].get("capabilities", {})
        assert caps.get("team_page") is True, f"whl.team_page must be true: {caps}"
        assert caps.get("player_page") is False, f"whl.player_page must be false: {caps}"

    def test_nhl_capabilities_present(self):
        r = requests.get(f"{BASE_URL}/api/leagues", timeout=TIMEOUT)
        leagues = {l["code"]: l for l in r.json().get("leagues", [])}
        assert "nhl" in leagues


# --- /api/league/whl/team/REG ----------------------------------------------
class TestWhlTeamPage:
    @pytest.fixture(scope="class")
    def payload(self):
        r = requests.get(f"{BASE_URL}/api/league/whl/team/REG", timeout=TIMEOUT)
        assert r.status_code == 200, f"WHL team REG failed: {r.status_code} {r.text[:300]}"
        return r.json()

    def test_team_identity_is_regina_pats(self, payload):
        team = payload["team"]
        assert team["abbr"] == "REG"
        assert "Regina" in (team.get("name") or ""), f"name must contain Regina: {team.get('name')}"

    def test_record_points_ten(self, payload):
        rec = payload["record"]
        assert rec.get("points") == 10, f"Expected 10 pts, got {rec.get('points')}"
        # 5-0-0 verified
        assert rec.get("wins") == 5
        assert rec.get("losses") == 0
        assert rec.get("ot") == 0

    def test_goals_25_14_diff11(self, payload):
        g = payload["goals"]
        assert g.get("gf") == 25, f"GF expected 25 got {g.get('gf')}"
        assert g.get("ga") == 14, f"GA expected 14 got {g.get('ga')}"
        assert g.get("diff") == 11, f"DIFF expected +11 got {g.get('diff')}"

    def test_recent_present_and_next_present(self, payload):
        assert isinstance(payload.get("recent"), list) and len(payload["recent"]) > 0
        # NEXT can be None if no upcoming, but per acceptance criteria we need one
        assert payload.get("next") is not None, "NEXT GAME missing"

    def test_scorers_empty_and_roster_null(self, payload):
        assert payload.get("scorers") == [], f"scorers must be empty list: {payload.get('scorers')}"
        assert payload.get("roster") is None, f"roster must be null: {payload.get('roster')}"
        assert payload.get("goalie") is None, f"goalie must be null: {payload.get('goalie')}"

    def test_conf_rank_and_east_division(self, payload):
        rec = payload["record"]
        team = payload["team"]
        assert rec.get("conf_rank") == 1, f"Expected conf_rank 1, got {rec.get('conf_rank')}"
        assert rec.get("div_rank") == 1, f"Expected div_rank 1, got {rec.get('div_rank')}"
        assert team.get("conference") == "Eastern"


# --- /api/league/whl/game/<final_id> ---------------------------------------
class TestWhlGamePage:
    @pytest.fixture(scope="class")
    def final_id(self):
        r = requests.get(f"{BASE_URL}/api/league/whl/recaps", timeout=TIMEOUT)
        assert r.status_code == 200
        games = r.json().get("games", [])
        assert games, "No WHL finals available for game test"
        return games[0]["id"]

    def test_game_by_id_real_final(self, final_id):
        r = requests.get(f"{BASE_URL}/api/league/whl/game/{final_id}", timeout=TIMEOUT)
        assert r.status_code == 200, f"WHL game failed: {r.status_code} {r.text[:300]}"
        payload = r.json()
        g = payload["game"]
        assert g.get("status") == "FINAL", f"Status must be FINAL, got {g.get('status')}"
        assert g.get("league") == "WHL"
        assert g["away"].get("score") is not None
        assert g["home"].get("score") is not None
        assert g["away"].get("abbr")
        assert g["home"].get("abbr")
        assert g.get("date")

    def test_game_has_no_scoring_plays(self, final_id):
        """Scoring summary is intentionally not exposed for WHL — no fabrication."""
        r = requests.get(f"{BASE_URL}/api/league/whl/game/{final_id}", timeout=TIMEOUT)
        g = r.json()["game"]
        # scoring should be empty/absent (Game model default is empty list)
        scoring = g.get("scoring")
        assert scoring in (None, [], {}), f"Expected empty scoring, got {scoring}"


# --- /api/league/whl/player/<x> -> 502 gated -------------------------------
class TestWhlPlayerGated:
    def test_player_page_502(self):
        r = requests.get(f"{BASE_URL}/api/league/whl/player/12345", timeout=TIMEOUT)
        assert r.status_code == 502, f"WHL player should return 502 (gated), got {r.status_code}"


# --- NHL regression: depth pages -------------------------------------------
class TestNhlDepthRegression:
    def test_nhl_team_bos(self):
        r = requests.get(f"{BASE_URL}/api/nhl/team/BOS", timeout=TIMEOUT)
        assert r.status_code == 200, f"NHL team BOS regressed: {r.status_code}"
        data = r.json()
        assert data["team"]["abbr"] == "BOS"
        # NHL should still expose scorers/roster
        assert isinstance(data.get("scorers"), list)

    def test_nhl_game_latest(self):
        r = requests.get(f"{BASE_URL}/api/nhl/game/latest", timeout=TIMEOUT)
        assert r.status_code == 200, f"NHL latest regressed: {r.status_code}"
        g = r.json()["game"]
        assert g.get("league") == "NHL"

    def test_nhl_player_bedard(self):
        r = requests.get(f"{BASE_URL}/api/nhl/player/8484144", timeout=TIMEOUT)
        # Bedard is 8484144 but the acceptance mentions 8478402 (McDavid)
        # Use the criterion's ID:
        r2 = requests.get(f"{BASE_URL}/api/nhl/player/8478402", timeout=TIMEOUT)
        assert r2.status_code == 200, f"NHL player 8478402 regressed: {r2.status_code}"
        payload = r2.json()
        assert payload.get("player", {}).get("id") or payload.get("player_id") or payload.get("id"), \
            f"NHL player payload missing id: {payload.keys()}"
