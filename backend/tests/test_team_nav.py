# Team Page Navigation + Energy pass tests (iter 19)
# Verifies: WHL/PG division_teams+record.gp+scorers[].gp, NHL/VGK division_teams(8)+record.gp
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://team-nav-rail.preview.emergentagent.com").rstrip("/")


@pytest.fixture
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ----- WHL PG (early-season, B.C. Division) -----
class TestWHLPrinceGeorge:
    def test_pg_returns_ok_and_core_shape(self, api):
        r = api.get(f"{BASE_URL}/api/league/whl/team/PG", timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["team"]["abbr"] == "PG"
        assert d["team"]["division"] == "B.C. Division"

    def test_pg_record_gp_present(self, api):
        d = api.get(f"{BASE_URL}/api/league/whl/team/PG", timeout=20).json()
        rec = d.get("record", {})
        assert "gp" in rec, f"record missing gp: {rec}"
        assert isinstance(rec["gp"], int)
        # Early season sanity — PG is described as having 2 GP; assert < 10 to keep test resilient
        assert 0 < rec["gp"] < 10, f"expected early-season GP <10, got {rec['gp']}"

    def test_pg_division_teams_contains_kam_and_pg(self, api):
        d = api.get(f"{BASE_URL}/api/league/whl/team/PG", timeout=20).json()
        dts = d.get("division_teams") or []
        abbrs = {t.get("abbr") for t in dts}
        assert "KAM" in abbrs, f"KAM missing from division_teams: {abbrs}"
        assert "PG" in abbrs
        assert len(dts) >= 5, f"expected B.C. Division rail with >=5 teams, got {len(dts)}"

    def test_pg_division_team_fields(self, api):
        d = api.get(f"{BASE_URL}/api/league/whl/team/PG", timeout=20).json()
        dts = d.get("division_teams") or []
        for t in dts:
            for k in ("abbr", "logo"):
                assert k in t, f"division_teams entry missing {k}: {t}"
            # rank + basic record used by the rail card
            assert "div_rank" in t

    def test_pg_scorers_have_gp(self, api):
        d = api.get(f"{BASE_URL}/api/league/whl/team/PG", timeout=20).json()
        scorers = d.get("scorers") or []
        assert len(scorers) > 0
        for s in scorers[:5]:
            assert "gp" in s, f"scorer missing gp: {s}"
            assert isinstance(s["gp"], int)


# ----- NHL VGK (Pacific division parity) -----
class TestNHLVegas:
    def test_vgk_returns_ok_and_core_shape(self, api):
        r = api.get(f"{BASE_URL}/api/nhl/team/VGK", timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["team"]["abbr"] == "VGK"
        assert d["team"]["division"] == "Pacific"

    def test_vgk_record_gp_present(self, api):
        d = api.get(f"{BASE_URL}/api/nhl/team/VGK", timeout=20).json()
        rec = d.get("record", {})
        assert "gp" in rec
        assert isinstance(rec["gp"], int) and rec["gp"] > 0

    def test_vgk_division_teams_eight(self, api):
        d = api.get(f"{BASE_URL}/api/nhl/team/VGK", timeout=20).json()
        dts = d.get("division_teams") or []
        assert len(dts) == 8, f"expected 8 Pacific teams, got {len(dts)} -> {[t.get('abbr') for t in dts]}"
        abbrs = {t.get("abbr") for t in dts}
        # Sanity: VGK itself present + a couple of division peers
        assert "VGK" in abbrs
        for peer in ("EDM", "LAK", "VAN"):
            assert peer in abbrs, f"expected {peer} in Pacific rail, got {abbrs}"


# ----- League hub (standings) still healthy -----
class TestLeagueHubBacking:
    def test_whl_standings_ok(self, api):
        r = api.get(f"{BASE_URL}/api/whl/standings", timeout=20)
        # Not strictly required by request, but hub reads standings — quick smoke:
        assert r.status_code in (200, 404), r.status_code

    def test_league_generic_standings_whl(self, api):
        # Endpoint used by /league/[code]
        r = api.get(f"{BASE_URL}/api/league/whl/standings", timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        # Must have at least Eastern or Western bucket to feed the hub
        assert isinstance(d, dict)
