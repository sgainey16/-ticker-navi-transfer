"""Provider registry — the single plug point for leagues.

To add a league later: import its adapter and add one line to `_PROVIDERS`.
Nothing else in the app changes. NHL is the first (and currently only) provider.
"""
from __future__ import annotations

from providers.base import HockeyProvider
from providers.nhl import NHLProvider
from providers.whl import HockeyTechProvider
from providers.ncaa import NCAAProvider

DEFAULT_LEAGUE = "nhl"

_PROVIDERS: dict[str, HockeyProvider] = {
    "nhl": NHLProvider(),
    # Same HockeyTech/Leaguestat chassis — three real CHL leagues by registration, not rebuild.
    "whl": HockeyTechProvider("whl", "Western Hockey League", "whl", "f1aa699db3d81487"),
    "ohl": HockeyTechProvider("ohl", "Ontario Hockey League", "ohl", "f1aa699db3d81487"),
    "qmjhl": HockeyTechProvider("qmjhl", "Quebec Maritimes Junior Hockey League", "lhjmq", "f322673b6bcae299"),
    # Highlightly (structure/video) + Elite Prospects (people) — thin but honest.
    "ncaa": NCAAProvider(),
}


def get_provider(code: str | None = None) -> HockeyProvider:
    key = (code or DEFAULT_LEAGUE).lower()
    prov = _PROVIDERS.get(key)
    if prov is None:
        raise KeyError(f"No provider registered for league '{code}'")
    return prov


def list_providers() -> list[HockeyProvider]:
    return list(_PROVIDERS.values())


async def search_all(q: str, limit: int = 16) -> list[dict]:
    """Universal Ticker entity search — teams + leagues resolve IN-MEMORY (accent
    + alias aware) via the entity index, plus one fast NHL player lookup. Near-instant
    for known entities; a future league is searchable the moment it's registered.
    """
    from entity_index import search_entities
    try:
        return await search_entities(q, limit=limit)
    except Exception:
        return []
