"""Backend tests for /api/explore/world + regressions.
Verifies real Highlightly-backed inventory, honest available/coming_soon states,
and expected regression endpoints (reels, search, standings)."""
import os
import pytest
import requests

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://team-nav-rail.preview.emergentagent.com').rstrip('/')

AVAILABLE_CODES = {"nhl", "whl", "ohl", "qmjhl", "ncaa"}


@pytest.fixture(scope="module")
def world():
    r = requests.get(f"{BASE_URL}/api/explore/world", timeout=60)
    assert r.status_code == 200, f"explore/world -> {r.status_code}: {r.text[:200]}"
    return r.json()


# --- explore/world shape & totals ---
class TestExploreWorldShape:
    def test_enabled_and_totals_keys(self, world):
        assert world.get("enabled") is True
        totals = world.get("totals") or {}
        for k in ("countries", "leagues", "available"):
            assert k in totals, f"missing totals.{k}"
        print(f"TOTALS: {totals}")

    def test_totals_values(self, world):
        t = world["totals"]
        # spec: ~34 countries, ~176 leagues, exactly 5 available
        assert 20 <= t["countries"] <= 60, f"countries out of range: {t['countries']}"
        assert 100 <= t["leagues"] <= 260, f"leagues out of range: {t['leagues']}"
        assert t["available"] == 5, f"available should be 5, got {t['available']}"

    def test_top_level_arrays(self, world):
        for k in ("featured", "countries", "international"):
            assert isinstance(world.get(k), list), f"{k} not list"


class TestFeaturedCountries:
    def test_canada_available(self, world):
        canada = next((g for g in world["featured"] if g["country"] == "Canada"), None)
        assert canada, "Canada missing from featured"
        # canada owns whl/ohl/qmjhl (not nhl — nhl country is USA in Highlightly)
        assert canada["available"] >= 3, f"Canada available should be >=3, got {canada['available']}"
        print(f"Canada available={canada['available']}, total={canada['total']}")

    def test_usa_available(self, world):
        usa = next((g for g in world["featured"] if g["country"] == "USA"), None)
        assert usa, "USA missing from featured"
        assert usa["available"] >= 2, f"USA available should be >=2, got {usa['available']}"
        print(f"USA available={usa['available']}, total={usa['total']}")

    def test_available_codes_and_shape(self, world):
        codes_seen = set()
        for g in world["featured"] + world["countries"] + world["international"]:
            for l in g["leagues"]:
                for key in ("id", "name", "country", "status", "code"):
                    assert key in l, f"row missing '{key}': {l}"
                assert l["status"] in ("available", "coming_soon")
                if l["status"] == "available":
                    assert l["code"] is not None
                    assert l["code"] in AVAILABLE_CODES, f"unexpected available code: {l['code']}"
                    codes_seen.add(l["code"])
                else:
                    assert l["code"] is None, f"coming_soon row has code {l['code']} (should be null)"
        assert codes_seen == AVAILABLE_CODES, f"Missing available codes: {AVAILABLE_CODES - codes_seen}"


class TestInternationalComingSoon:
    def test_expected_intl_leagues_coming_soon(self, world):
        # Verify real international leagues appear as coming_soon
        wanted = {
            "Sweden": "shl",
            "Finland": "liiga",
            "Germany": "del",
            "Czech Republic": "extraliga",
            "Russia": "khl",
        }
        all_groups = world["featured"] + world["countries"] + world["international"]
        for country, needle in wanted.items():
            g = next((x for x in all_groups if x["country"] == country), None)
            assert g, f"{country} missing from world"
            hit = next(
                (l for l in g["leagues"] if needle in (l["name"] or "").lower()),
                None,
            )
            assert hit, f"{country}: no league name contains '{needle}' (got {[l['name'] for l in g['leagues']]})"
            assert hit["status"] == "coming_soon", f"{country} {hit['name']} not coming_soon"
            assert hit["code"] is None


# --- regressions ---
class TestRegressions:
    def test_reels_nhl_returns_collections(self):
        r = requests.get(f"{BASE_URL}/api/reels", params={"league": "nhl"}, timeout=45)
        assert r.status_code == 200
        j = r.json()
        assert j.get("league") == "nhl"
        assert isinstance(j.get("collections"), list)

    def test_search_montreal_returns_canadiens(self):
        r = requests.get(f"{BASE_URL}/api/search", params={"q": "montreal"}, timeout=30)
        assert r.status_code == 200
        results = r.json().get("results", [])
        blob = " ".join(str(x).lower() for x in results)
        assert "canadiens" in blob or "mtl" in blob, f"Canadiens not found in search: {results[:3]}"

    def test_nhl_standings_ok(self):
        r = requests.get(f"{BASE_URL}/api/league/nhl/standings", timeout=30)
        assert r.status_code == 200
        j = r.json()
        assert "Eastern" in j and "Western" in j
        assert isinstance(j["Eastern"], list)
