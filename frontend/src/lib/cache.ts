import { api } from "./api";

// Lightweight in-memory cache + prefetch so moving league <-> division <-> team
// feels instant. Short TTL keeps verified data fresh; prefetch warms the next hop
// the moment a user touches a chip/logo.
type Entry = { t: number; data: any };
const TTL = 60_000;
const teams = new Map<string, Entry>();

export async function loadTeam(league: string, id: string): Promise<any> {
  const key = `${league}:${id}`;
  const hit = teams.get(key);
  if (hit && Date.now() - hit.t < TTL) return hit.data;
  const data = league === "nhl" ? await api.nhlTeam(id) : await api.leagueTeam(league, id);
  teams.set(key, { t: Date.now(), data });
  return data;
}

export function prefetchTeam(league: string, id: string) {
  const key = `${league}:${id}`;
  const hit = teams.get(key);
  if (hit && Date.now() - hit.t < TTL) return;
  loadTeam(league, id).catch(() => {});
}
