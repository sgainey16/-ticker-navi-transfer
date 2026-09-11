"""Backend tests for the universal Highlightly rollout + game-centered highlights.

Covers:
  * GET /api/highlights?league=nhl&limit=5    (shape + fields)
  * GET /api/highlights?league=ahl&limit=3    (real clips, AHL live)
  * GET /api/highlights/match  (NHL Cup Final Game 6 recap == 3jbQ58HKtXA)
  * GET /api/highlights/match  (nonsense teams -> graceful null/[])
  * GET /api/leagues           (capabilities.video for nhl + whl)
"""
import os
import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# --- feed shape ------------------------------------------------------------
class TestHighlightsFeed:
    def test_nhl_feed_shape(self, api):
        r = api.get(f"{BASE_URL}/api/highlights", params={"league": "nhl", "limit": 5}, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("league") == "nhl"
        clips = body.get("clips")
        assert isinstance(clips, list)
        # NHL is a highly-covered league — should return at least 1 clip
        assert len(clips) >= 1, "NHL should have at least 1 recent clip"
        assert len(clips) <= 5
        c = clips[0]
        # each clip should have these fields (may be None but keys must exist)
        for k in ["youtube_id", "thumbnail", "title", "category", "date", "home", "away"]:
            assert k in c, f"missing field '{k}' in clip: {c}"

    def test_ahl_feed_returns_real_clips(self, api):
        r = api.get(f"{BASE_URL}/api/highlights", params={"league": "ahl", "limit": 3}, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("league") == "ahl"
        clips = body.get("clips")
        assert isinstance(clips, list)
        # AHL Calder Cup active — expect real clips
        assert len(clips) >= 1, "AHL should have real clips during Calder Cup active window"
        assert len(clips) <= 3
        # at least one clip should have a title
        assert any(c.get("title") for c in clips)


# --- match matching --------------------------------------------------------
class TestMatchHighlights:
    def test_cup_final_game6_recap(self, api):
        r = api.get(f"{BASE_URL}/api/highlights/match", params={
            "league": "nhl",
            "home": "Vegas Golden Knights",
            "away": "Carolina Hurricanes",
            "date": "2026-06-15T00:00:00Z",
        }, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("league") == "nhl"
        recap = body.get("recap")
        assert recap is not None, f"expected recap for Cup Final Game 6, got {body}"
        yid = recap.get("youtube_id")
        assert yid == "3jbQ58HKtXA", f"expected youtube_id '3jbQ58HKtXA', got {yid!r}"

    def test_nonsense_teams_graceful(self, api):
        r = api.get(f"{BASE_URL}/api/highlights/match", params={
            "league": "nhl",
            "home": "Zzz",
            "away": "Qqq",
        }, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("recap") is None
        assert body.get("clips") == []


# --- leagues registry ------------------------------------------------------
class TestLeaguesCapabilities:
    def test_leagues_video_capabilities(self, api):
        r = api.get(f"{BASE_URL}/api/leagues", timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        leagues = body.get("leagues") or []
        assert leagues, "no leagues registered"
        by_code = {lg.get("code"): lg for lg in leagues}
        # every league should expose capabilities.video (bool)
        for code, lg in by_code.items():
            caps = lg.get("capabilities") or {}
            assert "video" in caps, f"league {code} missing capabilities.video"
            assert isinstance(caps["video"], bool)
        # nhl + whl must be true (Highlightly-covered)
        assert "nhl" in by_code, "nhl missing from /api/leagues"
        assert by_code["nhl"]["capabilities"]["video"] is True, "nhl video should be True"
        assert "whl" in by_code, "whl missing from /api/leagues"
        assert by_code["whl"]["capabilities"]["video"] is True, "whl video should be True"
