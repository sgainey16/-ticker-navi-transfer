"""Multi-source retrieval layer for the Live Desk.

The desk must NOT be hard-wired to one league feed. A team's context is ASSEMBLED
from the primary league provider PLUS any registered enrichment sources (Elite
Prospects, analytics, youth feeds, …). Each source contributes verified facts that
merge into the same `tp` dict the desk already understands, so richer data makes the
conversation richer automatically — with no change to the Live Desk itself.

Contract (never fabricate — a source returns only what it can verify):
  EnrichmentSource.supports(league)         -> bool
  EnrichmentSource.enrich_team(league, tp)   -> dict of ADDITIVE fields, e.g.
     {"coach": ..., "player_bio": {player_id: {height,weight,age,shoots,born,history}},
      "scorers": [...], "roster": {...}}
Merge is shallow + safe: an enrichment only fills gaps or adds new keys; it never
overwrites a non-empty verified value from the primary provider.
"""
from __future__ import annotations
import logging

logger = logging.getLogger("ticker.retrieval")


class EnrichmentSource:
    name: str = "base"

    def supports(self, league: str) -> bool:  # pragma: no cover - interface
        return False

    async def enrich_team(self, league: str, tp: dict) -> dict:  # pragma: no cover - interface
        return {}


# Sources are tried in order; add EliteProspects/analytics/youth here later.
ENRICHMENT_SOURCES: list[EnrichmentSource] = []


def register_source(src: EnrichmentSource) -> None:
    ENRICHMENT_SOURCES.append(src)
    logger.info("retrieval: registered enrichment source %r", src.name)


def _is_empty(v) -> bool:
    return v is None or v == "" or v == [] or v == {}


def _merge(tp: dict, extra: dict) -> None:
    """Additive, gap-filling merge. player_bio dicts merge per-player."""
    for k, v in (extra or {}).items():
        if _is_empty(v):
            continue
        if k == "player_bio":
            bio = tp.setdefault("player_bio", {})
            for pid, info in v.items():
                bio.setdefault(str(pid), {}).update({kk: vv for kk, vv in info.items() if not _is_empty(vv)})
        elif k == "roster" and isinstance(v, dict) and isinstance(tp.get("roster"), dict):
            for grp, lst in v.items():
                if lst and not tp["roster"].get(grp):
                    tp["roster"][grp] = lst
        elif _is_empty(tp.get(k)):
            tp[k] = v
        # else: keep the primary provider's verified value (never overwrite)


async def assemble_team_context(provider, league: str, subject: str) -> dict:
    """Primary team_page + every applicable enrichment source, merged safely."""
    tp = await provider.team_page(subject)
    for src in ENRICHMENT_SOURCES:
        try:
            if src.supports(league):
                _merge(tp, await src.enrich_team(league, tp))
        except Exception:
            logger.exception("enrichment source %r failed (non-fatal)", src.name)
    return tp


# ---------------------------------------------------------------------------
# Elite Prospects — stub wired but INERT until a key + client are provided.
# When enabled it will contribute player_bio (height/weight/age/shoots/born/
# history) across WHL/CHL/NCAA and eventually youth. Returns nothing today, so
# nothing is ever fabricated. This proves the layer accepts EP with no Live Desk
# changes — only this source's enrich_team() needs a real implementation.
# ---------------------------------------------------------------------------
import os


class EliteProspectsSource(EnrichmentSource):
    name = "eliteprospects"

    def __init__(self):
        self.api_key = os.environ.get("ELITEPROSPECTS_API_KEY", "").strip()

    def supports(self, league: str) -> bool:
        # EP has strong junior/college coverage; enable for WHL/CHL/NCAA when keyed.
        return bool(self.api_key) and league in ("whl", "chl", "ohl", "qmjhl", "ncaa")

    async def enrich_team(self, league: str, tp: dict) -> dict:
        if not self.api_key:
            return {}
        # TODO(EP): fetch team roster bios and return
        #   {"player_bio": {pid: {"height":..,"weight":..,"age":..,"shoots":..,
        #                          "born":..,"history":[...]}}, "coach": ...}
        return {}


register_source(EliteProspectsSource())
