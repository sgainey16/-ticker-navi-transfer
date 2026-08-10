"""Backend tests for MASL — Powered by Ticker."""
import re
import pytest

BANNED_HOCKEY = ["puck", "ice", "rink", "slapshot", "faceoff", "icing", "five-hole", "zamboni", "top shelf", "wrist shot", "body-check"]


def _hockey_hits(text: str):
    t = (text or "").lower()
    return [w for w in BANNED_HOCKEY if re.search(r"\b" + re.escape(w) + r"\b", t)]


# -------------------- Health --------------------
class TestHealth:
    def test_root(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/")
        assert r.status_code == 200
        d = r.json()
        assert d.get("status") == "ok"


# -------------------- Home feed --------------------
class TestHome:
    def test_home_shape(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/home")
        assert r.status_code == 200
        d = r.json()
        for k in ("cold_open", "featured_game", "ticker", "leader", "standings_snippet", "recaps"):
            assert k in d, f"missing {k}"
        # leader is Rian Marques 52
        assert d["leader"]["name"] == "Rian Marques"
        assert "52" in d["leader"]["stat"]
        assert isinstance(d["ticker"], list) and len(d["ticker"]) > 0
        assert "Eastern" in d["standings_snippet"] and "Western" in d["standings_snippet"]


# -------------------- Teams --------------------
class TestTeams:
    def test_list(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/teams")
        assert r.status_code == 200
        teams = r.json()["teams"]
        assert len(teams) == 8

    def test_team_detail(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/teams/san-diego")
        assert r.status_code == 200
        d = r.json()
        assert d["team"]["name"] == "San Diego Sockers"
        assert any(p["name"] == "Rian Marques" for p in d["roster"])
        assert isinstance(d["recaps"], list) and len(d["recaps"]) >= 1

    def test_team_404(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/teams/bogus")
        assert r.status_code == 404


# -------------------- Standings --------------------
class TestStandings:
    def test_standings(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/standings")
        assert r.status_code == 200
        d = r.json()
        assert "Eastern" in d and "Western" in d
        # Each row has needed fields
        row = d["Eastern"][0]
        for f in ("rank", "wins", "losses", "points", "streak", "gd"):
            assert f in row


# -------------------- Leaders --------------------
class TestLeaders:
    def test_leaders(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/leaders")
        assert r.status_code == 200
        d = r.json()
        for k in ("goals", "assists", "points", "saves"):
            assert k in d and len(d[k]) > 0
        # Rian Marques leads goals with 52
        top = d["goals"][0]
        assert top["name"] == "Rian Marques"
        assert top["value"] == 52


# -------------------- Games --------------------
class TestGames:
    def test_games_list(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/games")
        assert r.status_code == 200
        games = r.json()["games"]
        assert len(games) >= 5
        assert any(g["id"] == "mil-uti-17-2" for g in games)

    def test_game_detail(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/games/mil-uti-17-2")
        assert r.status_code == 200
        d = r.json()
        assert d["game"]["home_score"] == 17 and d["game"]["away_score"] == 2
        assert len(d["game"]["quarters"]) == 4
        assert d["game"]["timeline"] and d["game"]["commentary"]["rayo"] and d["game"]["commentary"]["casey"]
        # Terminology in commentary (no banned hockey)
        blob = d["game"]["commentary"]["rayo"] + " " + d["game"]["commentary"]["casey"]
        assert not _hockey_hits(blob), f"Hockey terms leaked: {_hockey_hits(blob)}"
        assert d["home"]["id"] == "milwaukee"
        assert d["away"]["id"] == "utica"

    def test_game_404(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/games/no-such")
        assert r.status_code == 404


# -------------------- Player --------------------
class TestPlayer:
    def test_player_detail(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/players/rian-marques")
        assert r.status_code == 200
        d = r.json()
        assert d["player"]["goals"] == 52
        assert d["team"]["id"] == "san-diego"

    def test_player_404(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/players/nope")
        assert r.status_code == 404


# -------------------- Cold open --------------------
class TestColdOpen:
    def test_coldopen(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/coldopen")
        assert r.status_code == 200
        d = r.json()
        assert d["beats"] and d["beats"][-1]["text"] == "WATCH LIVE ON VICTORY+"
        # No hockey leaks in the entire cold open
        blob = " ".join(b["text"] for b in d["beats"])
        assert not _hockey_hits(blob), f"Hockey terms leaked in cold open: {_hockey_hits(blob)}"
        assert d["home"]["id"] == "milwaukee"
        assert d["away"]["id"] == "utica"


# -------------------- Availability --------------------
class TestAvailability:
    def test_availability(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/availability")
        assert r.status_code == 200
        rep = r.json()["report"]
        assert len(rep) >= 3
        assert all("status" in x and "player" in x for x in rep)


# -------------------- Talk (LLM) --------------------
class TestTalk:
    def test_empty_message(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/talk", json={"message": ""})
        assert r.status_code == 400

    def test_talk_both_hosts_no_hockey(self, api_client, base_url):
        r = api_client.post(
            f"{base_url}/api/talk",
            json={"message": "How did Milwaukee beat Utica 17-2? What made the difference?"},
            timeout=120,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("session_id")
        assert d.get("rayo"), "Rayo did not answer"
        assert d.get("casey"), "Casey did not answer"
        combined = (d["rayo"] + " " + d["casey"])
        hits = _hockey_hits(combined)
        assert not hits, f"HOCKEY LEAK in /api/talk: {hits} :: {combined}"
        # Store for next test
        pytest.session_id_from_talk = d["session_id"]

    def test_talk_history_and_multiturn(self, api_client, base_url):
        sid = getattr(pytest, "session_id_from_talk", None)
        if not sid:
            pytest.skip("no session from prior test")
        # Second turn (context)
        r2 = api_client.post(
            f"{base_url}/api/talk",
            json={"message": "And who scored the most that night?", "session_id": sid},
            timeout=120,
        )
        assert r2.status_code == 200, r2.text
        d2 = r2.json()
        assert d2["session_id"] == sid
        assert d2.get("rayo") and d2.get("casey")
        hits = _hockey_hits(d2["rayo"] + " " + d2["casey"])
        assert not hits, f"HOCKEY LEAK turn2: {hits}"

        # History persisted
        h = api_client.get(f"{base_url}/api/talk/{sid}", timeout=30)
        assert h.status_code == 200
        turns = h.json()["turns"]
        # 2 user + 2 hosts turns => 4
        assert len(turns) >= 4
        roles = [t["role"] for t in turns]
        assert roles.count("user") >= 2
        assert roles.count("hosts") >= 2

    def test_talk_terminology_awareness(self, api_client, base_url):
        r = api_client.post(
            f"{base_url}/api/talk",
            json={"message": "Explain the power play and the three-line rule in arena soccer."},
            timeout=120,
        )
        assert r.status_code == 200
        d = r.json()
        combined = (d["rayo"] + " " + d["casey"]).lower()
        hits = _hockey_hits(combined)
        assert not hits, f"HOCKEY LEAK: {hits}"
        # Should mention correct terminology
        assert ("power play" in combined) or ("man-up" in combined) or ("three-line" in combined)
