"""
Backend regression + foundation tests for THE TICKER (iteration 7).

Covers:
- Provider registry: GET /api/leagues returns NHL with media=false
- NHL game (has_video default false, league='NHL')
- Standings 16 Eastern + 16 Western
- Leaders skaters + goalies
- Depth routes: /api/nhl/scoreboard, /api/nhl/recaps, /api/nhl/home
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://league-mobile-app.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# --- Provider registry chassis ------------------------------------------
class TestProviderRegistry:
    def test_leagues_returns_nhl(self, api_client):
        r = api_client.get(f"{API}/leagues", timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "leagues" in data
        leagues = data["leagues"]
        assert isinstance(leagues, list) and len(leagues) >= 1
        codes = [l["code"] for l in leagues]
        assert "nhl" in codes, f"expected nhl in {codes}"

    def test_leagues_nhl_capabilities(self, api_client):
        r = api_client.get(f"{API}/leagues", timeout=30)
        assert r.status_code == 200
        nhl = next(l for l in r.json()["leagues"] if l["code"] == "nhl")
        assert nhl["name"] == "National Hockey League", nhl["name"]
        caps = nhl["capabilities"]
        # media must be false — no verified NHL video yet
        assert caps.get("media") is False, f"media should be False, got {caps}"
        # sanity: canonical capabilities present
        for cap in ("standings", "leaders", "recaps", "schedule", "team_page", "player_page"):
            assert cap in caps, f"missing capability {cap} in {caps}"


# --- NHL game / has_video / league --------------------------------------
class TestNHLGame:
    def test_latest_game_has_video_false(self, api_client):
        r = api_client.get(f"{API}/nhl/game/latest", timeout=60)
        assert r.status_code == 200, r.text
        payload = r.json()
        assert "game" in payload
        g = payload["game"]
        assert g.get("has_video") is False, f"has_video should default False, got {g.get('has_video')}"
        assert g.get("league") == "NHL", f"league should be 'NHL', got {g.get('league')}"
        # verify canonical shape has home/away
        assert "home" in g and "away" in g


# --- STATS: standings & leaders -----------------------------------------
class TestStandings:
    def test_standings_shape(self, api_client):
        r = api_client.get(f"{API}/nhl/standings", timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "Eastern" in data and "Western" in data
        assert len(data["Eastern"]) == 16, f"Eastern should have 16 teams, got {len(data['Eastern'])}"
        assert len(data["Western"]) == 16, f"Western should have 16 teams, got {len(data['Western'])}"


class TestLeaders:
    def test_leaders_shape(self, api_client):
        r = api_client.get(f"{API}/nhl/leaders", timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        # skaters + goalies both must be present
        assert "skaters" in data or "points" in data or "goals" in data, f"unexpected shape: {list(data.keys())[:10]}"
        # goalies must be present too
        assert "goalies" in data or "svpct" in data or any("goalie" in k.lower() for k in data.keys()), \
            f"expected goalies section, got keys {list(data.keys())}"


# --- Depth routes still resolve via registry ----------------------------
class TestDepthRoutes:
    def test_scoreboard(self, api_client):
        r = api_client.get(f"{API}/nhl/scoreboard", timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert "games" in data

    def test_home_feed(self, api_client):
        r = api_client.get(f"{API}/nhl/home", timeout=60)
        assert r.status_code == 200
        data = r.json()
        assert "slate" in data
        # hero optional; but must not crash

    def test_recaps(self, api_client):
        r = api_client.get(f"{API}/nhl/recaps", timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert "games" in data


# --- Legacy segment endpoint (old /api/segments/{page}) still exists but ---
# The frontend must NOT call it. Just verify the new /api/ticker/segment works.
class TestTickerSegment:
    def test_ticker_segment_home(self, api_client):
        r = api_client.get(f"{API}/ticker/segment", params={"surface": "home"}, timeout=90)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("surface") == "home"
        assert "state" in data
        assert "voices" in data
