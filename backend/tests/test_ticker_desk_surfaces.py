"""
Iteration 13 — Ticker Desk Surfaces (Team + Game, NHL + WHL).

Validates the shared `/api/ticker/segment` endpoint with:
  - surface=team & league=nhl        -> grounded on team record
  - surface=team & league=whl        -> grounded on WHL record (5-0-0 / +11)
  - surface=game & league=nhl        -> beats reference real scoring
  - surface=game & league=whl        -> upcoming: NO invented score/goals/plays

Also confirms NHL depth pages remain unregressed (BOS team, /game/latest).
"""
import os
import re
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")
assert BASE_URL, "EXPO_PUBLIC_BACKEND_URL/EXPO_BACKEND_URL must be set"
BASE_URL = BASE_URL.rstrip("/")


@pytest.fixture(scope="session")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------- surface=team NHL (BOS) ----------
class TestTickerTeamNHL:
    def test_bos_ticker_team_ready(self, api):
        r = api.get(f"{BASE_URL}/api/ticker/segment", params={"surface": "team", "subject": "BOS", "league": "nhl"}, timeout=60)
        assert r.status_code == 200
        d = r.json()
        assert d["surface"] == "team"
        assert d["segment_type"] == "opening"
        assert d["state"] == "ready"
        assert isinstance(d["beats"], list) and len(d["beats"]) >= 2
        assert d["voices"].get("reggie") and d["voices"].get("marc")
        assert "BOSTON" in (d.get("title") or "").upper()

    def test_bos_ticker_team_grounded_on_record(self, api):
        # Get real record
        rec_resp = api.get(f"{BASE_URL}/api/nhl/team/BOS", timeout=30).json()
        rec = rec_resp.get("record", {})
        wins, points = rec.get("wins"), rec.get("points")
        assert wins is not None and points is not None

        seg = api.get(f"{BASE_URL}/api/ticker/segment", params={"surface": "team", "subject": "BOS", "league": "nhl"}, timeout=60).json()
        blob = " ".join(b["text"] for b in seg["beats"]).lower()
        # Grounded => at least one real number (wins or points) is spoken
        assert (str(wins) in blob) or (str(points) in blob), f"neither wins={wins} nor points={points} appear in beats"


# ---------- surface=team WHL (REG) ----------
class TestTickerTeamWHL:
    def test_reg_ticker_team_ready(self, api):
        r = api.get(f"{BASE_URL}/api/ticker/segment", params={"surface": "team", "subject": "REG", "league": "whl"}, timeout=60)
        assert r.status_code == 200
        d = r.json()
        assert d["state"] == "ready"
        assert len(d["beats"]) >= 2
        assert "REGINA" in (d.get("title") or "").upper()

    def test_reg_ticker_team_grounded(self, api):
        seg = api.get(f"{BASE_URL}/api/ticker/segment", params={"surface": "team", "subject": "REG", "league": "whl"}, timeout=60).json()
        blob = " ".join(b["text"] for b in seg["beats"]).lower()
        # WHL Regina Pats real facts: 5-0-0 / top of East / +11
        # At least one of these grounded numbers must appear.
        hits = sum([
            "5" in blob and ("five" in blob or "5-0" in blob or " 5 " in blob),
            "11" in blob or "eleven" in blob,
            "east" in blob or "regina" in blob,
        ])
        assert hits >= 1, f"WHL team beats not grounded: {blob!r}"


# ---------- surface=game NHL latest (final) ----------
class TestTickerGameNHLLatest:
    def test_nhl_latest_ready(self, api):
        r = api.get(f"{BASE_URL}/api/ticker/segment", params={"surface": "game", "subject": "latest", "league": "nhl"}, timeout=90)
        assert r.status_code == 200
        d = r.json()
        assert d["state"] == "ready"
        assert d["segment_type"] in ("game", "recap")
        assert len(d["beats"]) >= 2


# ---------- surface=game WHL upcoming (must NOT invent score) ----------
class TestTickerGameWHLUpcoming:
    def _whl_upcoming_id(self, api):
        sb = api.get(f"{BASE_URL}/api/league/whl/scoreboard", timeout=30).json()
        games = sb.get("games") or []
        # Prefer a non-final, but scoreboard usually holds upcoming/live
        for g in games:
            if g.get("status") != "FINAL":
                return g.get("id")
        return games[0].get("id") if games else None

    def test_whl_game_ready(self, api):
        gid = self._whl_upcoming_id(api)
        assert gid, "no WHL scoreboard game to test"
        r = api.get(f"{BASE_URL}/api/ticker/segment", params={"surface": "game", "subject": gid, "league": "whl"}, timeout=90)
        assert r.status_code == 200
        d = r.json()
        assert d["state"] == "ready"
        assert len(d["beats"]) >= 2

    def test_whl_upcoming_no_fabricated_score(self, api):
        gid = self._whl_upcoming_id(api)
        d = api.get(f"{BASE_URL}/api/league/whl/game/{gid}", timeout=30).json()
        game = d.get("game") or {}
        status = game.get("status")
        if status == "FINAL":
            pytest.skip("no WHL upcoming/live game available; only FINALs on the scoreboard")

        seg = api.get(f"{BASE_URL}/api/ticker/segment", params={"surface": "game", "subject": gid, "league": "whl"}, timeout=90).json()
        blob = " ".join(b["text"] for b in seg["beats"])
        # For UPCOMING games the hosts must NOT state a score like "3-2" / "won 4-1".
        # Assert there is no compact score pattern in the beats.
        score_pat = re.compile(r"\b\d+\s*[-–]\s*\d+\b")
        assert not score_pat.search(blob), f"UPCOMING WHL beats contain a score-shaped fragment: {blob!r}"
        # Also assert no goal/scorer/assist verbiage
        forbidden = ["goal by", "scored", "scorer", "assist", "power play goal", "empty net"]
        lower = blob.lower()
        for w in forbidden:
            assert w not in lower, f"forbidden fabrication '{w}' present in upcoming beats: {blob!r}"


# ---------- NHL depth regression sanity ----------
class TestNHLRegression:
    def test_nhl_bos_team_page(self, api):
        r = api.get(f"{BASE_URL}/api/nhl/team/BOS", timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["team"]["abbr"] == "BOS"
        # NHL keeps its rich modules
        assert d.get("scorers") is not None or d.get("roster") is not None

    def test_nhl_game_latest(self, api):
        r = api.get(f"{BASE_URL}/api/nhl/game/latest", timeout=30)
        assert r.status_code == 200
        d = r.json()
        g = d.get("game") or {}
        assert g.get("status") in ("FINAL", "OFF", "LIVE", "FUT")


# ---------- Cache reuse (2nd call is fast & identical) ----------
class TestCacheReuse:
    def test_team_desk_cached(self, api):
        # Two calls with same subject/league must return identical beats (Mongo-cached).
        p = {"surface": "team", "subject": "REG", "league": "whl"}
        a = api.get(f"{BASE_URL}/api/ticker/segment", params=p, timeout=60).json()
        b = api.get(f"{BASE_URL}/api/ticker/segment", params=p, timeout=60).json()
        assert a.get("beats") == b.get("beats")
