"""Backend regression for the NCAA (Highlightly + EP) provider, OHL/QMJHL registration,
and cross-league personalization on the shared HockeyTech chassis.

Scope (mirrors the iteration-21 review request):
  * NCAA structure endpoints: standings / team_page / scoreboard / game / player (EP)
  * Onboarding search: NCAA + OHL/QMJHL + EP player
  * Personalization: home_segment + home_show accept a mixed 5-league Draft Board
  * Bridges: NCAA subject resolves through the grounded Reggie & Marc rail
  * Regression: NHL/WHL/OHL/QMJHL team pages still return valid shapes
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/")
assert BASE_URL, "EXPO_PUBLIC_BACKEND_URL must be set in /app/frontend/.env"

TIMEOUT = 45  # NCAA/Highlightly + EP calls can be slow on cold cache


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------------------------------------------------------- Onboarding search
class TestSearch:
    """/api/search must span NCAA + junior + EP without hardcoding NHL."""

    @pytest.mark.parametrize("q,abbr", [
        ("Denver", "DEN"),
        ("Michigan", "MICH"),
        ("Minnesota", "MINN"),
        ("Boston University", "BU"),
    ])
    def test_ncaa_team_search(self, api, q, abbr):
        r = api.get(f"{BASE_URL}/api/search", params={"q": q}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        payload = r.json()
        results = payload.get("results") if isinstance(payload, dict) else payload
        assert isinstance(results, list)
        ncaa_teams = [x for x in results if x.get("type") == "team" and x.get("league_code") == "ncaa"]
        assert ncaa_teams, f"No NCAA teams returned for {q!r}: {results!r}"
        assert any(x.get("id") == abbr or x.get("team_abbr") == abbr for x in ncaa_teams), \
            f"Expected NCAA team abbr {abbr} for {q!r}, got {[x.get('id') for x in ncaa_teams]}"

    def test_barrie_returns_ohl(self, api):
        r = api.get(f"{BASE_URL}/api/search", params={"q": "Barrie"}, timeout=TIMEOUT)
        assert r.status_code == 200
        results = r.json().get("results") or []
        ohl = [x for x in results if x.get("type") == "team" and (x.get("league_code") or "").lower() == "ohl"]
        assert ohl, f"Expected an OHL team for Barrie, got {results!r}"
        assert any((x.get("id") or "").upper() == "BAR" or (x.get("team_abbr") or "").upper() == "BAR" for x in ohl)

    def test_halifax_returns_qmjhl(self, api):
        r = api.get(f"{BASE_URL}/api/search", params={"q": "Halifax"}, timeout=TIMEOUT)
        assert r.status_code == 200
        results = r.json().get("results") or []
        qmj = [x for x in results if x.get("type") == "team" and (x.get("league_code") or "").lower() == "qmjhl"]
        assert qmj, f"Expected a QMJHL team for Halifax, got {results!r}"

    def test_celebrini_returns_ep_player(self, api):
        r = api.get(f"{BASE_URL}/api/search", params={"q": "Celebrini"}, timeout=TIMEOUT)
        assert r.status_code == 200
        results = r.json().get("results") or []
        players = [x for x in results if x.get("type") == "player"]
        assert players, f"Expected at least one player result for 'Celebrini': {results!r}"
        assert any("celebrini" in (x.get("name") or "").lower() for x in players)


# ---------------------------------------------------------- NCAA endpoints
class TestNCAAStructure:
    def test_ncaa_standings(self, api):
        r = api.get(f"{BASE_URL}/api/league/ncaa/standings", timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "Eastern" in data
        assert isinstance(data["Eastern"], list)
        assert len(data["Eastern"]) >= 40, f"Expected ~62 NCAA teams under Eastern, got {len(data['Eastern'])}"
        assert isinstance(data.get("groups"), list) and data["groups"], "groups[] with conferences must be present"
        conf_names = {g.get("name") for g in data["groups"]}
        # At least one canonical NCAA conference should be present
        assert any(k in conf_names for k in ("Big Ten", "NCHC", "Hockey East", "ECAC Hockey", "Atlantic Hockey")), \
            f"No recognizable NCAA conference in groups: {conf_names!r}"

    def test_ncaa_team_denver(self, api):
        r = api.get(f"{BASE_URL}/api/league/ncaa/team/DEN", timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        d = r.json()
        # Team identity
        assert d["team"]["abbr"] == "DEN"
        assert "Denver" in (d["team"]["name"] or "")
        # Honest missing fields
        assert d["goals"]["gf"] is None, "NCAA gf must be null (honest)"
        assert d["goals"]["ga"] is None, "NCAA ga must be null (honest)"
        assert d["scorers"] == [], "NCAA scorers must be empty [] (no roster source)"
        # Record + div rank
        rec = d["record"]
        assert isinstance(rec["wins"], int) and isinstance(rec["losses"], int)
        assert isinstance(rec.get("div_rank"), int) and rec["div_rank"] >= 1
        # Conference rail
        assert isinstance(d.get("division_teams"), list) and len(d["division_teams"]) >= 4
        assert any(t.get("abbr") == "DEN" for t in d["division_teams"])
        # recent[] should have finals for a program with 20+ wins
        assert isinstance(d.get("recent"), list)
        # `next` may be null (offseason)
        assert "next" in d

    def test_ncaa_scoreboard(self, api):
        r = api.get(f"{BASE_URL}/api/league/ncaa/scoreboard", timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("league_name") == "NCAA"
        assert isinstance(d.get("games"), list) and len(d["games"]) > 0, "NCAA games[] must be populated"

    def test_ncaa_game_by_id(self, api):
        # Pull a game id from DEN's recent finals
        team_r = api.get(f"{BASE_URL}/api/league/ncaa/team/DEN", timeout=TIMEOUT)
        assert team_r.status_code == 200
        recent = team_r.json().get("recent") or []
        if not recent:
            pytest.skip("Denver had no recent finals to test game_by_id")
        gid = recent[0]["id"]
        r = api.get(f"{BASE_URL}/api/league/ncaa/game/{gid}", timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        payload = r.json()
        g = payload.get("game") if isinstance(payload, dict) and "game" in payload else payload
        assert g.get("status") == "FINAL"
        assert isinstance(g.get("home"), dict) and isinstance(g.get("away"), dict)
        assert isinstance(g["home"].get("score"), int) and isinstance(g["away"].get("score"), int)
        assert g.get("has_video") is True, "expected has_video=true for NCAA final"

    def test_ncaa_player_ep(self, api):
        r = api.get(
            f"{BASE_URL}/api/league/ncaa/player/xyz",
            params={"name": "Macklin Celebrini", "pos": "F"},
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert isinstance(d.get("ep"), dict) and d["ep"], "expected an 'ep' block with EP bio/draft/career"


# ---------------------------------------------------------- Personalization
class TestPersonalization:
    MIXED_BOARD = {
        "teams": [
            {"abbr": "MTL", "league": "nhl", "tier": 1},
            {"abbr": "KAM", "league": "whl", "tier": 1},
            {"abbr": "BAR", "league": "ohl", "tier": 2},
            {"abbr": "Hal", "league": "qmjhl", "tier": 2},
            {"abbr": "DEN", "league": "ncaa", "tier": 2},
        ],
        "players": [],
    }

    def test_home_segment_mixed_board(self, api):
        r = api.post(f"{BASE_URL}/api/ticker/home_segment", json=self.MIXED_BOARD, timeout=90)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("state") == "ready", f"expected state=ready, got {d.get('state')}: {d!r}"
        assert isinstance(d.get("beats"), list) and d["beats"], "beats must be populated"
        # voices object
        assert "voices" in d and "reggie" in d["voices"] and "marc" in d["voices"]

    def test_home_show_mixed_board(self, api):
        r = api.post(f"{BASE_URL}/api/ticker/home_show", json=self.MIXED_BOARD, timeout=120)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("personalized") is True, f"expected personalized=true: {d!r}"
        stories = d.get("stories") or []
        assert stories, "stories must be populated"
        # Every league in the board should resolve to at least one story (no NHL-hardcoding drop)
        leagues_seen = {(s.get("league") or "").lower() for s in stories}
        expected = {"nhl", "whl", "ohl", "qmjhl", "ncaa"}
        missing = expected - leagues_seen
        assert not missing, f"leagues missing from stories (NHL-hardcoding regression?): {missing}. Saw: {leagues_seen}"
        # Every story has reggie + marc beats
        for s in stories:
            hosts = {b.get("host") for b in (s.get("beats") or [])}
            assert {"reggie", "marc"} <= hosts, f"missing hosts in {s.get('subject')}: {hosts}"


# ---------------------------------------------------------- Bridges
class TestBridges:
    def test_ncaa_bridges(self, api):
        r = api.get(
            f"{BASE_URL}/api/ticker/bridges",
            params={"subject": "DEN", "league": "ncaa"},
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        lines = d.get("lines") or []
        assert isinstance(lines, list) and lines, f"expected NCAA bridge lines[]: {d!r}"


# ---------------------------------------------------------- Regression
class TestNoRegressions:
    @pytest.mark.parametrize("path", [
        "/api/league/whl/team/KAM",
        "/api/league/ohl/team/BAR",
        "/api/league/qmjhl/team/Hal",
        "/api/nhl/team/MTL",
    ])
    def test_team_pages_still_ok(self, api, path):
        r = api.get(f"{BASE_URL}{path}", timeout=TIMEOUT)
        assert r.status_code == 200, f"{path} broken: {r.text[:400]}"
        d = r.json()
        assert isinstance(d.get("team"), dict) and d["team"].get("abbr"), f"missing team.abbr on {path}"
        assert isinstance(d.get("record"), dict), f"missing record on {path}"
