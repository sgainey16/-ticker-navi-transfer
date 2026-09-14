"""Reels surface backend tests: /api/reels, /api/reels/search plus regressions."""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fall back to /app/frontend/.env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")
                break


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---- /api/reels browse feed -------------------------------------------------

class TestReelsBrowse:
    """Verified video collections per-league."""

    def _check_shape(self, data, expected_league):
        assert set(["league", "collections", "total", "enabled"]).issubset(data.keys()), data.keys()
        assert data["league"] == expected_league
        assert isinstance(data["collections"], list)
        assert isinstance(data["total"], int)
        # Empty collections must be omitted by design.
        for col in data["collections"]:
            assert set(["key", "label", "clips"]).issubset(col.keys())
            assert isinstance(col["clips"], list)
            assert len(col["clips"]) > 0, f"empty collection surfaced: {col['key']}"
            for c in col["clips"]:
                # Required fields on every clip
                for f in ("id", "title", "thumbnail", "playable"):
                    assert f in c, (f, c)
                # youtube_id may be None for NCAA; playable must reflect that
                assert isinstance(c["playable"], bool)

    def test_reels_nhl(self, api):
        r = api.get(f"{BASE_URL}/api/reels?league=nhl&limit=40", timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        self._check_shape(data, "nhl")
        assert data["enabled"] is True
        if not data["collections"]:
            pytest.skip("NHL Highlightly returned transient empty — non-blocking")
        # NHL should surface GAME HIGHLIGHTS (match-highlights bucket) with youtube_ids
        labels = [c["label"] for c in data["collections"]]
        assert any("HIGHLIGHT" in l.upper() for l in labels), labels
        # At least one clip has a youtube_id + playable True
        got_playable = False
        for col in data["collections"]:
            for c in col["clips"]:
                if c.get("youtube_id") and c.get("playable"):
                    got_playable = True
                    break
        assert got_playable, "expected at least one playable YouTube NHL clip"

    def test_reels_whl(self, api):
        r = api.get(f"{BASE_URL}/api/reels?league=whl&limit=40", timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        self._check_shape(data, "whl")
        assert data["enabled"] is True
        if not data["collections"]:
            pytest.skip("WHL Highlightly returned transient empty — non-blocking")
        labels = [c["label"] for c in data["collections"]]
        assert any("HIGHLIGHT" in l.upper() for l in labels), labels

    def test_reels_ncaa(self, api):
        r = api.get(f"{BASE_URL}/api/reels?league=ncaa&limit=40", timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        self._check_shape(data, "ncaa")
        assert data["enabled"] is True
        if not data["collections"]:
            pytest.skip("NCAA Highlightly returned transient empty — non-blocking")
        keys = [c["key"] for c in data["collections"]]
        # NCAA should have real category buckets (goals + saves at minimum)
        assert "goals" in keys or "saves" in keys, keys
        # Some clips may have youtube_id null (playable false) — verify that shape exists
        any_ncaa_fallback = False
        any_game_id = False
        for col in data["collections"]:
            for c in col["clips"]:
                if c.get("youtube_id") is None and c.get("playable") is False:
                    any_ncaa_fallback = True
                if c.get("game_id"):
                    any_game_id = True
        # It's OK if all had youtube_ids, but the shape must at least be legal
        # (playable in sync with youtube_id presence)
        for col in data["collections"]:
            for c in col["clips"]:
                if c.get("youtube_id") is None:
                    assert c.get("playable") is False, c


# ---- /api/reels/search ------------------------------------------------------

class TestReelsSearch:
    def test_silvertips_whl_league(self, api):
        r = api.get(f"{BASE_URL}/api/reels/search?q=Silvertips&league=whl&scope=league", timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "results" in data
        if not data["results"]:
            pytest.skip("WHL Highlightly returned transient empty — non-blocking")
        # Should mention Silvertips in title / abbrs
        joined = " ".join([c.get("title", "") + " " + (c.get("away_abbr") or "") + " " + (c.get("home_abbr") or "") for c in data["results"]]).lower()
        assert "silvertips" in joined or "evt" in joined or "everett" in joined, joined[:400]

    def test_silvertips_nhl_league_empty(self, api):
        r = api.get(f"{BASE_URL}/api/reels/search?q=Silvertips&league=nhl&scope=league", timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        # Honest empty: silvertips is not an NHL team
        assert data["results"] == [] or len(data["results"]) == 0, data.get("results")

    def test_silvertips_nhl_all_scope_finds_whl(self, api):
        r = api.get(f"{BASE_URL}/api/reels/search?q=Silvertips&league=nhl&scope=all", timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        if not data["results"]:
            pytest.skip("WHL Highlightly returned transient empty — non-blocking")
        # Should return WHL clips found via All-Hockey
        found_whl = any((c.get("league_code") or "").lower() == "whl" for c in data["results"])
        assert found_whl, data["results"][:2]

    def test_ncaa_goals_category_search(self, api):
        r = api.get(f"{BASE_URL}/api/reels/search?q=ncaa%20goals&league=nhl&scope=all", timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        # Should route into NCAA category=goals
        assert data.get("category") == "goals", data.get("category")
        if not data["results"]:
            pytest.skip("NCAA transient empty — non-blocking")
        # results should be NCAA
        assert all((c.get("league_code") or "").lower() == "ncaa" for c in data["results"]), [c.get("league_code") for c in data["results"][:5]]

    def test_short_query_empty_no_error(self, api):
        r = api.get(f"{BASE_URL}/api/reels/search?q=x&league=nhl", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("results") == [] or len(data.get("results") or []) == 0


# ---- regression sanity ------------------------------------------------------

class TestRegression:
    def test_search_montreal(self, api):
        r = api.get(f"{BASE_URL}/api/search?q=montreal", timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        # Response can be dict with "results" or list; handle both
        results = data.get("results") if isinstance(data, dict) else data
        assert results, data
        joined = " ".join([str(x) for x in results]).lower()
        assert "canadien" in joined, joined[:400]

    def test_highlights(self, api):
        r = api.get(f"{BASE_URL}/api/highlights", timeout=30)
        assert r.status_code == 200, r.text

    def test_nhl_standings(self, api):
        r = api.get(f"{BASE_URL}/api/nhl/standings", timeout=30)
        assert r.status_code == 200, r.text
