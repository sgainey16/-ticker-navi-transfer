"""Provider registry — the single plug point for leagues.

To add a league later: import its adapter and add one line to `_PROVIDERS`.
Nothing else in the app changes. NHL is the first (and currently only) provider.
"""
from __future__ import annotations

from providers.base import HockeyProvider
from providers.nhl import NHLProvider

DEFAULT_LEAGUE = "nhl"

_PROVIDERS: dict[str, HockeyProvider] = {
    "nhl": NHLProvider(),
    # "chl": CHLProvider(),        # <- future league plugs in here, no page rewrites
    # "khl": KHLProvider(),
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
    """Aggregate verified search results across every provider that supports it.

    A future league becomes searchable here automatically once registered — the
    onboarding doorway then spans the whole connected hockey world, with zero
    fabricated results (providers return only what they can verify).
    """
    out: list[dict] = []
    for p in list_providers():
        if not p.capabilities.get("search"):
            continue
        try:
            out.extend(await p.search(q, limit=limit))
        except Exception:
            pass
    return out[:limit]
