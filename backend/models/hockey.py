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
    assists: List[str] = []
    strength: str = "ev"  # ev | pp | sh | en
    empty_net: bool = False


class GoalieLine(BaseModel):
    name: str
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
    team_abbr: str
    note: Optional[str] = None


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
    status: str  # e.g. "FINAL"
    venue: Optional[str] = None
    home: TeamRef
    away: TeamRef
    scoring: List[ScoringPlay] = []
    goalies: List[GoalieLine] = []
    three_stars: List[StarLine] = []
    team_stats: dict = {}
    series: Optional[SeriesContext] = None
