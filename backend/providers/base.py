"""Provider contract for THE TICKER's universal hockey chassis.

Every league (NHL first, then CHL / KHL / NCAA / international …) is exposed to the
app through ONE interface. A provider adapter turns a raw feed into the canonical
model (models.hockey) and declares which capabilities it supports. The API layer
and the hosts read ONLY through this contract — never a provider's raw shape.

Adding a second league = write one adapter that subclasses HockeyProvider and
register it in providers/registry.py. No screen, route or model is duplicated.
"""
from __future__ import annotations
from abc import ABC, abstractmethod

from models.hockey import Game


class HockeyProvider(ABC):
    """Canonical surface a league adapter must implement.

    `code`         : short league key used in the registry (e.g. "nhl").
    `name`         : human label (e.g. "National Hockey League").
    `capabilities` : which universal modules this provider can actually fill.
                     Missing capability => the UI hides that module (never fakes it).
                     `media` gates REELS/video and defaults False until a verified
                     video source exists for that league (no fake highlights).
    """

    code: str = ""
    name: str = ""
    capabilities: dict = {
        "standings": False,
        "leaders": False,
        "recaps": False,
        "schedule": False,
        "team_page": False,
        "player_page": False,
        "media": False,
    }

    def describe(self) -> dict:
        return {"code": self.code, "name": self.name, "capabilities": self.capabilities}

    # --- completed games (RECAP) -------------------------------------------
    @abstractmethod
    async def latest_game(self) -> Game: ...

    @abstractmethod
    async def game_by_id(self, game_id: str) -> Game: ...

    @abstractmethod
    async def recent_finals_now(self, limit: int = 15) -> list[dict]: ...

    # --- upcoming / live (NEXT / HOME slate) -------------------------------
    @abstractmethod
    async def scoreboard_now(self) -> dict: ...

    # --- STATS -------------------------------------------------------------
    @abstractmethod
    async def standings_now(self) -> dict: ...

    @abstractmethod
    async def leaders_now(self, limit: int = 8) -> dict: ...

    # --- depth pages -------------------------------------------------------
    @abstractmethod
    async def team_page(self, tri: str) -> dict: ...

    @abstractmethod
    async def player_page(self, pid: str) -> dict: ...
