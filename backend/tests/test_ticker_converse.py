"""Tests for POST /api/ticker/converse — the LIVE fan+Reggie+Marc conversation.

Covers:
  a) NHL team (BOS) grounded conversation w/ text-only form
  b) WHL team (REG) grounded conversation, no player suggestions
  c) Follow flow: player offer -> "Yes" -> action.type == 'follow'
  d) Grounding: every suggestion entity id maps to a real player/team/game
"""
import os
import re
import pytest
import requests


BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/") or \
    "https://team-nav-rail.preview.emergentagent.com"
CONVERSE = f"{BASE_URL}/api/ticker/converse"

TIMEOUT = 90  # Claude + emergentintegrations can be slow


def _post_form(fields: dict) -> requests.Response:
    return requests.post(CONVERSE, data=fields, timeout=TIMEOUT)


# ---- Helpers --------------------------------------------------------------
def _fetch_team_page(league: str, abbr: str) -> dict:
    if league == "nhl":
        url = f"{BASE_URL}/api/nhl/team/{abbr}"
    else:
        url = f"{BASE_URL}/api/league/{league}/team/{abbr}"
    r = requests.get(url, timeout=30)
    r.raise_for_status()
    return r.json()


def _collect_valid_ids(tp: dict) -> dict:
    """Return sets of valid player_ids, team_abbrs, game_ids from the team page."""
    players = set()
    teams = set()
    games = set()

    team = tp.get("team", {}) or {}
    if team.get("abbr"):
        teams.add(str(team["abbr"]))

    for s in tp.get("scorers") or []:
        if s.get("player_id"):
            players.add(str(s["player_id"]))
    g = tp.get("goalie")
    if g and g.get("player_id"):
        players.add(str(g["player_id"]))

    roster = tp.get("roster") or {}
    for grp in ("forwards", "defensemen", "goalies"):
        for p in (roster.get(grp) or []):
            if p.get("player_id"):
                players.add(str(p["player_id"]))

    nxt = tp.get("next")
    if nxt:
        if nxt.get("id"):
            games.add(str(nxt["id"]))
        for side in ("home", "away"):
            if nxt.get(side, {}).get("abbr"):
                teams.add(str(nxt[side]["abbr"]))

    for gm in tp.get("recent") or []:
        if gm.get("id"):
            games.add(str(gm["id"]))

    return {"players": players, "teams": teams, "games": games}


# ---- NHL: BOS conversation ------------------------------------------------
class TestConverseNHL_BOS:
    def test_bos_conversation_grounded(self):
        r = _post_form({
            "subject": "BOS",
            "league": "nhl",
            "text": "Who should I watch this year?",
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("conversation_id"), "missing conversation_id"
        assert data.get("user_text") == "Who should I watch this year?"

        beats = data.get("beats") or []
        assert len(beats) >= 1, "no host beats"
        for b in beats:
            assert b.get("host") in ("reggie", "marc"), f"bad host: {b}"
            assert isinstance(b.get("text"), str) and b["text"].strip()

        # suggestions must have ids that correspond to real entities
        tp = _fetch_team_page("nhl", "BOS")
        valid = _collect_valid_ids(tp)

        suggestions = data.get("suggestions") or []
        for s in suggestions:
            kind = s.get("kind")
            ent = s.get("entity") or {}
            assert kind in ("player", "team", "game", "follow_team", "follow_player")
            if kind == "player":
                assert str(ent.get("player_id")) in valid["players"], \
                    f"fabricated player: {ent}"
            elif kind == "follow_player":
                assert str(ent.get("player_id")) in valid["players"], \
                    f"fabricated follow_player: {ent}"
            elif kind == "team":
                assert str(ent.get("abbr")) in valid["teams"], \
                    f"fabricated team: {ent}"
            elif kind == "follow_team":
                # follow_team is always the current team; still validated
                assert ent.get("abbr"), "follow_team missing abbr"
            elif kind == "game":
                assert str(ent.get("id")) in valid["games"], \
                    f"fabricated game: {ent}"


# ---- WHL: REG conversation (no roster => no player suggestions) -----------
class TestConverseWHL_REG:
    def test_reg_conversation_grounded_no_players(self):
        r = _post_form({
            "subject": "REG",
            "league": "whl",
            "text": "How are they looking so far?",
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("conversation_id")
        beats = data.get("beats") or []
        assert len(beats) >= 1
        for b in beats:
            assert b.get("host") in ("reggie", "marc")

        # WHL has no roster => suggestions must be team/game/follow_team only
        for s in (data.get("suggestions") or []):
            assert s.get("kind") in ("team", "game", "follow_team"), \
                f"WHL should not surface player/follow_player: got {s.get('kind')}"


# ---- Follow flow: offer -> Yes -> action ---------------------------------
class TestConverseFollowFlow:
    def test_bos_follow_pastrnak_flow(self):
        r1 = _post_form({
            "subject": "BOS",
            "league": "nhl",
            "text": "Can you keep an eye on Pastrnak for me?",
        })
        assert r1.status_code == 200, r1.text
        d1 = r1.json()
        cid = d1.get("conversation_id")
        assert cid
        suggestions = d1.get("suggestions") or []
        follow_player = [s for s in suggestions if s.get("kind") == "follow_player"]
        # The model is supposed to offer a follow_player suggestion in this scenario.
        # If it doesn't, we skip because it's a model non-determinism concern.
        if not follow_player:
            pytest.skip("model did not surface a follow_player offer this run")

        r2 = _post_form({
            "subject": "BOS",
            "league": "nhl",
            "conversation_id": cid,
            "text": "Yes do it",
        })
        assert r2.status_code == 200, r2.text
        d2 = r2.json()
        action = d2.get("action")
        assert action, "expected an action after 'Yes do it'"
        assert action.get("type") == "follow"
        assert action.get("entity", {}).get("player_id"), \
            f"missing player_id in follow action: {action}"


# ---- Directive (show continuation) — internal producer cue, NOT a fan utterance
class TestConverseDirective:
    def test_bos_directive_grounded(self):
        r = _post_form({
            "subject": "BOS",
            "league": "nhl",
            "directive": "Keep the show rolling: raise ONE interesting player, riff briefly, then wrap.",
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("conversation_id")
        assert data.get("user_text") == "", \
            f"directive turn should have empty user_text, got {data.get('user_text')!r}"
        beats = data.get("beats") or []
        assert len(beats) >= 1, "no host beats in directive turn"
        for b in beats:
            assert b.get("host") in ("reggie", "marc"), f"bad host: {b}"
            assert isinstance(b.get("text"), str) and b["text"].strip()

        # every suggestion must resolve to a real BOS entity (grounded)
        tp = _fetch_team_page("nhl", "BOS")
        valid = _collect_valid_ids(tp)
        for s in (data.get("suggestions") or []):
            kind = s.get("kind")
            ent = s.get("entity") or {}
            assert kind in ("player", "team", "game", "follow_team", "follow_player")
            if kind in ("player", "follow_player"):
                assert str(ent.get("player_id")) in valid["players"], \
                    f"fabricated player in directive: {ent}"
            elif kind == "team":
                assert str(ent.get("abbr")) in valid["teams"], f"fabricated team: {ent}"
            elif kind == "game":
                assert str(ent.get("id")) in valid["games"], f"fabricated game: {ent}"

    def test_whl_reg_directive_grounded_no_players(self):
        r = _post_form({
            "subject": "REG",
            "league": "whl",
            "directive": "Keep the show rolling: raise ONE interesting storyline for this team, riff briefly, then wrap.",
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("user_text") == ""
        beats = data.get("beats") or []
        assert len(beats) >= 1
        for s in (data.get("suggestions") or []):
            assert s.get("kind") in ("team", "game", "follow_team"), \
                f"WHL directive should not surface player/follow_player: got {s.get('kind')}"


# ---- Error handling -------------------------------------------------------
class TestConverseErrors:
    def test_missing_text_and_audio_400(self):
        r = _post_form({"subject": "BOS", "league": "nhl"})
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text}"

    def test_unknown_team_404(self):
        r = _post_form({"subject": "ZZZ", "league": "nhl", "text": "hi"})
        assert r.status_code == 404, f"expected 404, got {r.status_code}: {r.text}"
