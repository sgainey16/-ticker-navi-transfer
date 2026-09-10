"""Backend tests for the new universal onboarding search endpoint.

Covers GET /api/search?q= behaviors:
- bedard  -> at least one PLAYER result (Connor Bedard) with headshot + team_abbr=CHI
- canadiens -> a TEAM result for MTL (Montréal Canadiens)
- edmonton -> a TEAM result for EDM (Edmonton Oilers)
- kamloops (non-NHL) -> empty results (honest empty state)
- swiss national league (non-NHL) -> empty results
- ""  (empty)  -> empty results
- "a" (1-char) -> empty results
Also spot-checks other launch/regression endpoints stay green.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")
if not BASE_URL:
    # fall back to the frontend/.env public URL used by user
    BASE_URL = "https://league-mobile-app.preview.emergentagent.com"
BASE_URL = BASE_URL.rstrip("/")


@pytest.fixture(scope="module")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------------- /api/search ---------------- #

class TestUniversalSearch:
    def _get(self, api_client, q):
        r = api_client.get(f"{BASE_URL}/api/search", params={"q": q}, timeout=25)
        assert r.status_code == 200, f"search q={q!r} -> {r.status_code} body={r.text[:200]}"
        j = r.json()
        assert "results" in j and isinstance(j["results"], list)
        assert j.get("query") == q
        return j["results"]

    def test_search_empty_string_returns_empty(self, api_client):
        results = self._get(api_client, "")
        assert results == []

    def test_search_single_char_returns_empty(self, api_client):
        results = self._get(api_client, "a")
        assert results == []

    def test_search_bedard_returns_player(self, api_client):
        results = self._get(api_client, "bedard")
        players = [r for r in results if r.get("type") == "player"]
        assert players, f"expected a player result for 'bedard', got {results!r}"
        # Find Connor Bedard specifically
        bedard = next((p for p in players if "bedard" in (p.get("name") or "").lower()), None)
        assert bedard is not None, f"no Connor Bedard in {players!r}"
        assert bedard.get("team_abbr") == "CHI", f"expected CHI, got {bedard.get('team_abbr')!r}"
        # subtitle should be "NHL · <POS> · CHI"
        sub = bedard.get("subtitle") or ""
        assert sub.startswith("NHL"), f"subtitle should start with NHL: {sub!r}"
        assert "CHI" in sub
        # headshot present (assets.nhle.com mugs URL)
        hs = bedard.get("headshot") or ""
        assert hs.startswith("https://assets.nhle.com/mugs/"), f"bad headshot: {hs!r}"
        assert "league" in bedard and bedard["league"] == "NHL"

    def test_search_canadiens_returns_team_mtl(self, api_client):
        results = self._get(api_client, "canadiens")
        teams = [r for r in results if r.get("type") == "team"]
        assert teams, f"expected a team result for 'canadiens', got {results!r}"
        mtl = next((t for t in teams if t.get("team_abbr") == "MTL"), None)
        assert mtl is not None, f"no MTL in {teams!r}"
        assert "Canadiens" in (mtl.get("name") or "")
        assert mtl.get("subtitle") == "NHL"
        assert mtl.get("league") == "NHL"
        # id should match team_abbr per provider
        assert mtl.get("id") == "MTL"

    def test_search_edmonton_returns_team_edm(self, api_client):
        results = self._get(api_client, "edmonton")
        teams = [r for r in results if r.get("type") == "team"]
        edm = next((t for t in teams if t.get("team_abbr") == "EDM"), None)
        assert edm is not None, f"no EDM in {teams!r}"
        assert "Oilers" in (edm.get("name") or "")

    def test_search_kamloops_returns_empty_honest(self, api_client):
        # WHL / Kamloops is intentionally not connected — must be empty (no fabricated rows)
        results = self._get(api_client, "kamloops")
        # Only NHL provider — must be empty
        team_hits = [r for r in results if r.get("type") == "team"]
        player_hits = [r for r in results if r.get("type") == "player"]
        assert team_hits == [], f"kamloops should not match any NHL team, got {team_hits!r}"
        assert player_hits == [], f"kamloops should not match NHL players, got {player_hits!r}"

    def test_search_swiss_returns_empty_honest(self, api_client):
        results = self._get(api_client, "swiss national league")
        assert results == [], f"expected empty for swiss, got {results!r}"


# ---------------- Regression: keep prior surfaces green ---------------- #

class TestRegression:
    def test_leagues_lists_nhl(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/leagues", timeout=20)
        assert r.status_code == 200
        j = r.json()
        codes = [p.get("code") for p in j.get("leagues", [])]
        assert "nhl" in codes

    def test_nhl_home_200(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/nhl/home", timeout=30)
        assert r.status_code == 200
        j = r.json()
        assert "slate" in j and "voices" in j

    def test_nhl_scoreboard_200(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/nhl/scoreboard", timeout=25)
        assert r.status_code == 200
        j = r.json()
        assert "games" in j

    def test_nhl_standings_shape(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/nhl/standings", timeout=25)
        assert r.status_code == 200
        j = r.json()
        assert "Eastern" in j and "Western" in j

    def test_no_bare_segment_route(self, api_client):
        # Legacy '/api/segment' (bare) must not resolve (only /api/segments/{page} exists).
        r = api_client.get(f"{BASE_URL}/api/segment", timeout=10)
        assert r.status_code in (404, 405), f"bare /api/segment should be gone, got {r.status_code}"
