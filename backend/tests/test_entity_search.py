"""Entity-based universal search tests — Navigation Fork P0 bug fix verification.

Covers:
 - /api/search returns correct TOP result for known entity queries (teams, players, league hub)
 - Response shape (type in [team|player|league], id, name, league_code, team_abbr)
 - Performance: warm response under 1.5s
 - Regression: /api/leagues, /api/nhl/standings, /api/nhl/team/MIN still work
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")
if not BASE_URL:
    # Fallback: read from frontend/.env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip()
                break
BASE_URL = (BASE_URL or "").rstrip("/")


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    # Warm the entity index / caches so timings reflect steady state
    try:
        s.get(f"{BASE_URL}/api/search?q=montreal", timeout=30)
    except Exception:
        pass
    return s


# ---------------- Shape ----------------

def _assert_shape(results):
    assert isinstance(results, list) and len(results) > 0, "empty results"
    for r in results:
        assert r.get("type") in ("team", "player", "league"), f"bad type: {r.get('type')}"
        assert "id" in r and r["id"] is not None
        assert r.get("name")
        # league_code always present
        assert r.get("league_code"), f"missing league_code in {r}"
        if r["type"] == "team":
            assert r.get("team_abbr"), f"team missing team_abbr: {r}"


# ---------------- Top-result expectations ----------------

CASES = [
    # (query, predicate on top result)
    ("montreal", lambda r: r["type"] == "team" and r["league_code"] == "nhl" and "canadien" in r["name"].lower()),
    ("habs", lambda r: r["type"] == "team" and r["league_code"] == "nhl" and "canadien" in r["name"].lower()),
    ("canadiens", lambda r: r["type"] == "team" and r["league_code"] == "nhl" and "canadien" in r["name"].lower()),
    ("wild", lambda r: r["type"] == "team" and r["league_code"] == "nhl" and "wild" in r["name"].lower()),
    ("dallas", lambda r: r["type"] == "team" and "dallas" in r["name"].lower()),
    ("stars", lambda r: r["type"] == "team" and "stars" in r["name"].lower() and r["league_code"] == "nhl"),
    ("kamloops", lambda r: r["type"] == "team" and r["league_code"] == "whl" and "kamloops" in r["name"].lower()),
    ("blazers", lambda r: r["type"] == "team" and r["league_code"] == "whl" and "blazers" in r["name"].lower()),
    ("golden gophers", lambda r: r["type"] == "team" and r["league_code"] == "ncaa" and "gopher" in r["name"].lower()),
    ("minnesota gophers", lambda r: r["type"] == "team" and r["league_code"] == "ncaa" and "gopher" in r["name"].lower()),
]


@pytest.mark.parametrize("query,pred", CASES)
def test_top_result(api, query, pred):
    r = api.get(f"{BASE_URL}/api/search", params={"q": query}, timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    results = body.get("results") or []
    _assert_shape(results)
    top = results[0]
    assert pred(top), f"top result for '{query}' unexpected: {top}"


def test_minnesota_includes_wild(api):
    r = api.get(f"{BASE_URL}/api/search", params={"q": "minnesota"}, timeout=15)
    assert r.status_code == 200
    results = r.json().get("results") or []
    _assert_shape(results)
    # Wild should appear (senior league preferred) — anywhere in results
    wilds = [x for x in results if x["type"] == "team" and x["league_code"] == "nhl" and "wild" in x["name"].lower()]
    assert wilds, f"Minnesota Wild missing from 'minnesota' results: {results}"


def test_kaprizov_player(api):
    r = api.get(f"{BASE_URL}/api/search", params={"q": "kaprizov"}, timeout=20)
    assert r.status_code == 200
    results = r.json().get("results") or []
    assert results, "no results for kaprizov"
    kap = [x for x in results if x["type"] == "player" and "kaprizov" in (x.get("name") or "").lower()]
    assert kap, f"Kirill Kaprizov not returned: {results}"
    assert kap[0].get("league_code") == "nhl"


def test_whl_league_hub(api):
    r = api.get(f"{BASE_URL}/api/search", params={"q": "whl"}, timeout=15)
    assert r.status_code == 200
    results = r.json().get("results") or []
    _assert_shape(results)
    leagues = [x for x in results if x["type"] == "league" and x["league_code"] == "whl"]
    assert leagues, f"WHL league hub not returned: {results}"


# ---------------- Performance ----------------

def test_warm_performance(api):
    # Warm three calls; take min of latter two (steady state)
    api.get(f"{BASE_URL}/api/search?q=montreal", timeout=15)
    times = []
    for q in ["montreal", "wild", "habs"]:
        t0 = time.time()
        r = api.get(f"{BASE_URL}/api/search", params={"q": q}, timeout=10)
        assert r.status_code == 200
        times.append(time.time() - t0)
    fastest = min(times)
    assert fastest < 1.5, f"warm search too slow: times={times}"


# ---------------- Regression ----------------

def test_leagues_regression(api):
    r = api.get(f"{BASE_URL}/api/leagues", timeout=15)
    assert r.status_code == 200
    codes = {lg.get("code") for lg in r.json().get("leagues", [])}
    for c in ("nhl", "whl", "ohl", "qmjhl", "ncaa"):
        assert c in codes, f"league {c} missing: {codes}"


def test_nhl_standings_regression(api):
    r = api.get(f"{BASE_URL}/api/nhl/standings", timeout=20)
    assert r.status_code == 200
    body = r.json()
    assert "Eastern" in body and "Western" in body
    assert isinstance(body["Eastern"], list) and isinstance(body["Western"], list)


def test_nhl_team_min_regression(api):
    r = api.get(f"{BASE_URL}/api/nhl/team/MIN", timeout=20)
    assert r.status_code == 200
    body = r.json()
    assert body.get("team", {}).get("abbr") == "MIN"
