"""Backend tests for POST /api/ticker/home_show — the personalized Home Sports Desk rundown.

Contract under test:
 - With followed teams (junior + NHL), response has personalized=true and stories[] where
   each story has title, subtitle, stat, beats (reggie+marc), optional highlight; junior
   (Kamloops) and NHL (Edmonton) are both present.
 - With empty follows, response must still return a non-empty fallback stories[] so the show
   always runs (and personalized=false).
"""
import os
import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")


@pytest.fixture(scope="module")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


class TestHomeShowPersonalized:
    """Personalized rundown with a WHL + NHL Draft Board."""

    @pytest.fixture(scope="class")
    def resp(self, api_client):
        body = {
            "teams": [
                {"abbr": "KAM", "league": "whl", "tier": 1},
                {"abbr": "EDM", "league": "nhl", "tier": 2},
            ],
            "players": [],
        }
        r = api_client.post(f"{BASE_URL}/api/ticker/home_show", json=body, timeout=120)
        assert r.status_code == 200, r.text
        return r.json()

    def test_personalized_flag_true(self, resp):
        assert resp.get("personalized") is True

    def test_stories_non_empty(self, resp):
        assert isinstance(resp.get("stories"), list)
        assert len(resp["stories"]) >= 1

    def test_story_shape(self, resp):
        for s in resp["stories"]:
            assert isinstance(s.get("title"), str) and s["title"]
            assert isinstance(s.get("subtitle"), str)
            # stat is optional but when present must have label+value
            if s.get("stat"):
                assert "label" in s["stat"] and "value" in s["stat"]
            # beats must be list of {host, text} with reggie + marc entries
            beats = s.get("beats") or []
            assert isinstance(beats, list) and len(beats) >= 2
            hosts = {b.get("host") for b in beats}
            assert "reggie" in hosts and "marc" in hosts
            for b in beats:
                assert isinstance(b.get("text"), str)

    def test_contains_kamloops_and_edmonton(self, resp):
        subjects = {s.get("subject") for s in resp["stories"]}
        leagues = {s.get("league") for s in resp["stories"]}
        assert "KAM" in subjects, f"Kamloops missing; subjects={subjects}"
        assert "EDM" in subjects, f"Edmonton missing; subjects={subjects}"
        assert "whl" in leagues and "nhl" in leagues

    def test_voices_shape(self, resp):
        v = resp.get("voices") or {}
        # Keys must be present (values may be null in test env without ELEVENLABS)
        assert "reggie" in v and "marc" in v


class TestHomeShowFallback:
    """Empty follows: fallback league stories still keep the show running."""

    @pytest.fixture(scope="class")
    def resp(self, api_client):
        body = {"teams": [], "players": []}
        r = api_client.post(f"{BASE_URL}/api/ticker/home_show", json=body, timeout=120)
        assert r.status_code == 200, r.text
        return r.json()

    def test_personalized_false(self, resp):
        assert resp.get("personalized") is False

    def test_fallback_stories_non_empty(self, resp):
        # When there are recent NHL finals available, the fallback must fill the show.
        assert isinstance(resp.get("stories"), list)
        assert len(resp["stories"]) >= 1, "fallback stories should be non-empty so the show always runs"

    def test_fallback_story_shape(self, resp):
        for s in resp["stories"]:
            assert s.get("title")
            beats = s.get("beats") or []
            hosts = {b.get("host") for b in beats}
            assert "reggie" in hosts and "marc" in hosts
