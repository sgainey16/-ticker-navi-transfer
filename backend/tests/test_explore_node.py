"""Backend tests — /api/explore/node progressive drill-down (Explore Phase 1.2).

Verifies:
  * Canada chooser tree (Level / Region / League)
  * Canada level splits (Pro/Major Junior available; Junior A/University/Youth coming_soon)
  * Canada Major Junior returns whl/ohl/qmjhl available (code non-null)
  * Canada Pro returns nhl available (code=nhl) + pwhl coming_soon (code=null)
  * Canada By League fallback -> browse list w/ >=3 available
  * Sweden chooser tree (Men's Tiers / Women's / By League)
  * Finland by-league fallback returns coming_soon browse node (0 live)
  * Bogus deep path -> 404
  * /api/explore/world still returns totals + featured + countries + international
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")
if not BASE_URL:
    # frontend/.env exposes EXPO_PUBLIC_BACKEND_URL when running in the preview env.
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("EXPO_PUBLIC_BACKEND_URL"):
                BASE_URL = line.split("=", 1)[1].strip().strip('"')
                break
BASE_URL = (BASE_URL or "").rstrip("/")


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


def _node(s, path: str):
    r = s.get(f"{BASE_URL}/api/explore/node", params={"path": path}, timeout=30)
    return r


# ---------- CANADA ----------
def test_canada_root_chooser(s):
    r = _node(s, "country:Canada")
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["kind"] == "chooser"
    labels = [c["label"] for c in j["choices"]]
    assert "By Level" in labels and "By Region" in labels and "By League" in labels
    for c in j["choices"]:
        assert c["kind"] == "node" and c["path"].startswith("country:Canada/")


def test_canada_level_split(s):
    r = _node(s, "country:Canada/level")
    assert r.status_code == 200
    j = r.json()
    assert j["kind"] == "chooser"
    by_label = {c["label"]: c for c in j["choices"]}
    assert by_label["Pro"]["status"] == "available"
    assert by_label["Major Junior"]["status"] == "available"
    for soon in ("Junior A", "University", "Youth & Local"):
        assert by_label[soon]["status"] == "coming_soon", soon


def test_canada_major_junior_has_three_available(s):
    r = _node(s, "country:Canada/level/major-junior")
    assert r.status_code == 200
    j = r.json()
    assert j["kind"] == "leagues"
    codes = {c["label"].lower(): c for c in j["choices"]}
    for lg in ("whl", "ohl", "qmjhl"):
        c = codes[lg]
        assert c["status"] == "available"
        assert c["code"] == lg


def test_canada_pro_nhl_available_pwhl_soon(s):
    r = _node(s, "country:Canada/level/pro")
    assert r.status_code == 200
    j = r.json()
    by = {c["label"].lower(): c for c in j["choices"]}
    assert by["nhl"]["status"] == "available" and by["nhl"]["code"] == "nhl"
    assert by["pwhl"]["status"] == "coming_soon" and by["pwhl"]["code"] is None


def test_canada_by_league_browse_has_three_available(s):
    r = _node(s, "country:Canada/league")
    assert r.status_code == 200
    j = r.json()
    assert j["kind"] == "leagues"
    avail = [c for c in j["choices"] if c["status"] == "available"]
    assert len(avail) >= 3, f"expected >=3 available, got {len(avail)}"


# ---------- SWEDEN ----------
def test_sweden_different_tree(s):
    r = _node(s, "country:Sweden")
    assert r.status_code == 200
    j = r.json()
    assert j["kind"] == "chooser"
    labels = {c["label"] for c in j["choices"]}
    assert "Men's Tiers" in labels
    assert "Women's Hockey" in labels
    assert "By League" in labels
    # Ensure it's NOT Canada's tree
    assert "By Region" not in labels


# ---------- FINLAND (fallback) ----------
def test_finland_fallback_browse(s):
    r = _node(s, "country:Finland")
    assert r.status_code == 200
    j = r.json()
    assert j["kind"] == "leagues"
    live = [c for c in j["choices"] if c["status"] == "available"]
    assert len(live) == 0


# ---------- 404 ----------
def test_bogus_deep_path_404(s):
    r = _node(s, "country:Canada/bogus/deep")
    assert r.status_code == 404


# ---------- world regression ----------
def test_explore_world_shape(s):
    r = s.get(f"{BASE_URL}/api/explore/world", timeout=30)
    assert r.status_code == 200
    j = r.json()
    assert set(["totals", "featured", "countries", "international"]).issubset(j.keys())
    for k in ("countries", "leagues", "available"):
        assert k in j["totals"]
