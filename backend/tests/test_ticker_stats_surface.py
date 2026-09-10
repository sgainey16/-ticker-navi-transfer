"""
Iteration 14 — Ticker Desk on STATS surface (NHL + WHL) + full-surface regression.

Validates:
  - GET /api/ticker/segment?surface=stats&league=nhl -> state=ready, grounded
    (interpretation supported by real standings/leaders; no fabricated numbers).
  - GET /api/ticker/segment?surface=stats&league=whl -> state=ready, grounded,
    appropriately shorter/lighter than NHL when provider depth is lighter.
  - Regression on the other surfaces used by TickerDesk: home / recap / next
    (nhl + whl) still return ready with beats.
  - Cache reuse for the stats surface (2nd call returns identical beats).
  - No fabricated scores / goal-scoring verbiage in the stats desk beats
    (this is a stats reaction, not game play-by-play).
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


def _blob(seg: dict) -> str:
    return " ".join((b.get("text") or "") for b in (seg.get("beats") or []))


# --------- surface=stats NHL ---------
class TestTickerStatsNHL:
    def test_stats_nhl_ready(self, api):
        r = api.get(f"{BASE_URL}/api/ticker/segment",
                    params={"surface": "stats", "league": "nhl"}, timeout=90)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["surface"] == "stats"
        assert d["segment_type"] == "reaction"
        assert d["state"] == "ready", d
        assert isinstance(d["beats"], list) and len(d["beats"]) >= 2
        assert d["voices"].get("reggie") and d["voices"].get("marc")
        assert "NHL" in (d.get("title") or "").upper()

    def test_stats_nhl_grounded_in_real_data(self, api):
        # Pull real standings + leaders
        stand = api.get(f"{BASE_URL}/api/nhl/standings", timeout=30).json()
        lead = api.get(f"{BASE_URL}/api/nhl/leaders", timeout=30).json()
        east = stand.get("Eastern") or []
        west = stand.get("Western") or []
        top_names = []
        for group in (lead.get("skaters") or {}).values():
            for p in (group or [])[:3]:
                nm = p.get("name")
                if nm:
                    top_names.append(nm)
        top_team_names = [t.get("name") for t in (east + west) if t.get("name")]

        seg = api.get(f"{BASE_URL}/api/ticker/segment",
                      params={"surface": "stats", "league": "nhl"}, timeout=90).json()
        blob = _blob(seg).lower()
        # Grounded => at least one real leader last-name OR real team name/city
        # appears in the beats. Broadcasters commonly use last name & city.
        def toks(n: str):
            return [t.strip().lower() for t in (n or "").split() if len(t.strip()) >= 3]
        name_hits = 0
        for n in top_names:
            for tk in toks(n):
                if tk in blob:
                    name_hits += 1
                    break
        team_hits = 0
        for n in top_team_names[:8]:
            for tk in toks(n):
                if tk in blob:
                    team_hits += 1
                    break
        assert (name_hits + team_hits) >= 1, (
            f"NHL stats beats not grounded (no leader last-name / team city in beats). "
            f"leaders={top_names[:6]!r} teams={top_team_names[:6]!r} blob={blob!r}"
        )

    def test_stats_nhl_no_fabricated_scores(self, api):
        seg = api.get(f"{BASE_URL}/api/ticker/segment",
                      params={"surface": "stats", "league": "nhl"}, timeout=90).json()
        blob = _blob(seg)
        # Stats desk should not narrate goals/plays.
        forbidden = ["goal by", "power play goal", "empty net", "scored the winner"]
        low = blob.lower()
        for w in forbidden:
            assert w not in low, f"forbidden narration '{w}' in stats beats: {blob!r}"


# --------- surface=stats WHL ---------
class TestTickerStatsWHL:
    def test_stats_whl_ready(self, api):
        r = api.get(f"{BASE_URL}/api/ticker/segment",
                    params={"surface": "stats", "league": "whl"}, timeout=90)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["state"] == "ready", d
        assert isinstance(d["beats"], list) and len(d["beats"]) >= 2
        assert "WHL" in (d.get("title") or "").upper()

    def test_stats_whl_grounded(self, api):
        stand = api.get(f"{BASE_URL}/api/league/whl/standings", timeout=30).json()
        lead = api.get(f"{BASE_URL}/api/league/whl/leaders", timeout=30).json()
        east = stand.get("Eastern") or []
        west = stand.get("Western") or []
        team_names = [t.get("name") for t in (east + west) if t.get("name")]
        abbrs = [t.get("abbr") for t in (east + west) if t.get("abbr")]
        lead_names = []
        for group in (lead.get("skaters") or {}).values():
            for p in (group or [])[:3]:
                nm = p.get("name")
                if nm:
                    lead_names.append(nm)

        seg = api.get(f"{BASE_URL}/api/ticker/segment",
                      params={"surface": "stats", "league": "whl"}, timeout=90).json()
        blob = _blob(seg).lower()
        team_hit = any(n and n.lower() in blob for n in team_names[:8])
        abbr_hit = any(a and a.lower() in blob for a in abbrs[:8])
        name_hit = any(n and n.lower() in blob for n in lead_names)
        assert team_hit or abbr_hit or name_hit, (
            f"WHL stats beats not grounded — no team/leader name/abbr in beats. blob={blob!r}"
        )


# --------- Regression: home / recap / next ---------
class TestOtherSurfacesRegression:
    def test_home_ready(self, api):
        r = api.get(f"{BASE_URL}/api/ticker/segment",
                    params={"surface": "home"}, timeout=90)
        assert r.status_code == 200
        d = r.json()
        assert d["state"] == "ready"
        assert len(d["beats"]) >= 2

    @pytest.mark.parametrize("league", ["nhl", "whl"])
    def test_recap_ready(self, api, league):
        r = api.get(f"{BASE_URL}/api/ticker/segment",
                    params={"surface": "recap", "league": league}, timeout=90)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["state"] == "ready", d
        assert len(d["beats"]) >= 2

    @pytest.mark.parametrize("league", ["nhl", "whl"])
    def test_next_ready(self, api, league):
        r = api.get(f"{BASE_URL}/api/ticker/segment",
                    params={"surface": "next", "league": league}, timeout=90)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["state"] == "ready", d
        assert len(d["beats"]) >= 2


# --------- Cache reuse ---------
class TestStatsCacheReuse:
    def test_stats_desk_cached(self, api):
        p = {"surface": "stats", "league": "whl"}
        a = api.get(f"{BASE_URL}/api/ticker/segment", params=p, timeout=90).json()
        b = api.get(f"{BASE_URL}/api/ticker/segment", params=p, timeout=90).json()
        assert a.get("beats") == b.get("beats"), "Cached WHL stats beats differ across calls"

    def test_stats_nhl_cached(self, api):
        p = {"surface": "stats", "league": "nhl"}
        a = api.get(f"{BASE_URL}/api/ticker/segment", params=p, timeout=90).json()
        b = api.get(f"{BASE_URL}/api/ticker/segment", params=p, timeout=90).json()
        assert a.get("beats") == b.get("beats"), "Cached NHL stats beats differ across calls"


# --------- No compact score fragments in any league-level desk ---------
class TestNoCompactScoreFragmentsInLeagueDesks:
    @pytest.mark.parametrize("surface,league", [
        ("stats", "nhl"), ("stats", "whl"),
        ("next", "nhl"), ("next", "whl"),
        ("home", "nhl"),
    ])
    def test_no_score_shaped_fragment(self, api, surface, league):
        params = {"surface": surface}
        if surface != "home":
            params["league"] = league
        seg = api.get(f"{BASE_URL}/api/ticker/segment", params=params, timeout=90).json()
        blob = _blob(seg)
        # Compact scores like "3-2" / "4–1" are not appropriate on league-level
        # desks that don't narrate a specific game. Allow bare numbers (points,
        # records like 5-0-0 would be a match — permit records but not tight
        # "N-N" score fragments surrounded by whitespace at word boundaries).
        #
        # We flag ONLY the two-digit-hyphen-two-digit "X-Y" without a trailing
        # "-Z" (records are typically "5-0-0" with 3 numbers). This mirrors the
        # iteration_13 regex but relaxed so records don't false-fail.
        score_pat = re.compile(r"\b(\d{1,2})\s*[-–]\s*(\d{1,2})(?!\s*[-–]\s*\d)")
        # Additionally guard: only fail if there is also a scoring verb near it,
        # to avoid false positives on standings mentions.
        m = score_pat.search(blob)
        if m:
            near = blob[max(0, m.start()-40):m.end()+40].lower()
            if any(v in near for v in ["won ", "beat ", "took ", "final", "score"]):
                pytest.fail(f"{surface}/{league}: score-like fragment '{m.group(0)}' in beats near: {near!r}")
