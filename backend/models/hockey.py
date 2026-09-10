"""Canonical hockey data model for THE TICKER.

One model for all leagues (NHL/CHL/NCAA/…). Provider adapters map raw feeds into
these objects. The Ticker intelligence + hosts read ONLY from this model, never from
a provider's raw shape and never from AI invention.
"""
from __future__ import annotations
from typing import List, Optional
from pydantic import BaseModel


class TeamRef(BaseModel):
    id: str
    abbr: str
    name: str
    logo: Optional[str] = None
    score: Optional[int] = None


class ScoringPlay(BaseModel):
    period: int
    period_type: str = "REG"
    time: str
    team_abbr: str
    scorer: str
    scorer_id: Optional[int] = None
    assists: List[str] = []
    strength: str = "ev"  # ev | pp | sh | en
    empty_net: bool = False


class GoalieLine(BaseModel):
    name: str
    player_id: Optional[int] = None
    team_abbr: str
    shots_against: int = 0
    saves: int = 0
    goals_against: int = 0
    toi: Optional[str] = None
    decision: Optional[str] = None  # W | L | O
    shutout: bool = False


class StarLine(BaseModel):
    star: int
    name: str
    player_id: Optional[int] = None
    team_abbr: str
    note: Optional[str] = None


class PenaltyPlay(BaseModel):
    period: int
    period_type: str = "REG"
    time: str
    team_abbr: str
    player: str = ""
    type: str = ""            # MIN | MAJ | BEN | MIS | ...
    duration: Optional[int] = None
    desc: Optional[str] = None  # e.g. "tripping"


class SkaterLine(BaseModel):
    name: str
    team_abbr: str
    player_id: Optional[int] = None   # structured for future Player pages
    position: Optional[str] = None
    goals: int = 0
    assists: int = 0
    points: int = 0
    sog: Optional[int] = None
    toi: Optional[str] = None


class SeriesContext(BaseModel):
    is_playoffs: bool = False
    round_label: Optional[str] = None   # e.g. "Stanley Cup Final"
    game_number: Optional[int] = None
    home_wins: Optional[int] = None
    away_wins: Optional[int] = None
    needed_to_win: Optional[int] = None
    clinched_by: Optional[str] = None   # team abbr that won the series, if decided


class Game(BaseModel):
    id: str
    league: str = "NHL"
    date: str
    start_utc: Optional[str] = None
    status: str  # e.g. "FINAL"
    venue: Optional[str] = None
    home: TeamRef
    away: TeamRef
    scoring: List[ScoringPlay] = []
    penalties: List[PenaltyPlay] = []
    goalies: List[GoalieLine] = []
    top_skaters: List[SkaterLine] = []
    three_stars: List[StarLine] = []
    team_stats: dict = {}
    series: Optional[SeriesContext] = None
    # Media capability — True only when a verified video clip exists for this game.
    # Providers without a verified video source leave this False; the UI then shows
    # no video module at all (never a fake / "coming soon" experience).
    has_video: bool = False
