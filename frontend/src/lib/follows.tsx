import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { storage } from "@/src/utils/storage";

export type Tier = 1 | 2 | 3;
export type TeamFollow = { abbr: string; name?: string; tier?: Tier; fav?: boolean; league?: string; logo?: string | null };
export type PlayerFollow = { player_id: string; team_abbr: string; name?: string; pos?: string; tier?: Tier; fav?: boolean; league?: string };
export type Follows = { teams: TeamFollow[]; players: PlayerFollow[]; region?: string; leagues?: string[] };

const KEY = "ticker.follows";
const ONBOARDED = "ticker.onboarded";
const EMPTY: Follows = { teams: [], players: [] };

function parse(raw: string): Follows {
  if (!raw) return EMPTY;
  try {
    const v = JSON.parse(raw);
    return {
      teams: Array.isArray(v.teams) ? v.teams : [],
      players: Array.isArray(v.players) ? v.players : [],
      region: typeof v.region === "string" ? v.region : undefined,
      leagues: Array.isArray(v.leagues) ? v.leagues : undefined,
    };
  } catch {
    return EMPTY;
  }
}

type Ctx = {
  ready: boolean;
  onboarded: boolean;
  follows: Follows;
  teamTier: (abbr: string) => Tier | undefined;
  playerTier: (playerId: string) => Tier | undefined;
  isTeam: (abbr: string) => boolean;
  isPlayer: (playerId: string) => boolean;
  toggleTeam: (t: TeamFollow) => void;
  togglePlayer: (p: PlayerFollow) => void;
  saveFollows: (next: Follows) => Promise<void>;
  completeOnboarding: (next: Follows) => Promise<void>;
  resetOnboarding: () => Promise<void>;
};

const FollowsContext = createContext<Ctx | null>(null);

export function FollowsProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [onboarded, setOnboarded] = useState(false);
  const [follows, setFollows] = useState<Follows>(EMPTY);

  useEffect(() => {
    (async () => {
      const raw = await storage.getItem(KEY, "");
      const done = await storage.getItem(ONBOARDED, false);
      setFollows(parse(raw || ""));
      setOnboarded(!!done);
      setReady(true);
    })();
  }, []);

  const saveFollows = useCallback(async (next: Follows) => {
    setFollows(next);
    await storage.setItem(KEY, JSON.stringify(next));
  }, []);

  const completeOnboarding = useCallback(async (next: Follows) => {
    setFollows(next);
    await storage.setItem(KEY, JSON.stringify(next));
    setOnboarded(true);
    await storage.setItem(ONBOARDED, true);
  }, []);

  const resetOnboarding = useCallback(async () => {
    setFollows(EMPTY);
    setOnboarded(false);
    await storage.removeItem(KEY);
    await storage.removeItem(ONBOARDED);
  }, []);

  const teamTier = useCallback((abbr: string) => follows.teams.find((t) => t.abbr === abbr)?.tier, [follows]);
  const playerTier = useCallback((pid: string) => follows.players.find((p) => p.player_id === pid)?.tier, [follows]);
  const isTeam = useCallback((abbr: string) => follows.teams.some((t) => t.abbr === abbr), [follows]);
  const isPlayer = useCallback((pid: string) => follows.players.some((p) => p.player_id === pid), [follows]);

  // Follow toggles for in-app discovery (team/player pages). Personalization only — never access.
  const toggleTeam = useCallback((t: TeamFollow) => {
    const exists = follows.teams.some((x) => x.abbr === t.abbr);
    const teams = exists ? follows.teams.filter((x) => x.abbr !== t.abbr) : [...follows.teams, { ...t, tier: t.tier ?? 2 }];
    saveFollows({ ...follows, teams });
  }, [follows, saveFollows]);
  const togglePlayer = useCallback((p: PlayerFollow) => {
    const exists = follows.players.some((x) => x.player_id === p.player_id);
    const players = exists ? follows.players.filter((x) => x.player_id !== p.player_id) : [...follows.players, { ...p, tier: p.tier ?? 2 }];
    saveFollows({ ...follows, players });
  }, [follows, saveFollows]);

  const value = useMemo<Ctx>(() => ({
    ready, onboarded, follows,
    teamTier, playerTier, isTeam, isPlayer, toggleTeam, togglePlayer,
    saveFollows, completeOnboarding, resetOnboarding,
  }), [ready, onboarded, follows, teamTier, playerTier, isTeam, isPlayer, toggleTeam, togglePlayer, saveFollows, completeOnboarding, resetOnboarding]);

  return <FollowsContext.Provider value={value}>{children}</FollowsContext.Provider>;
}

export function useFollows(): Ctx {
  const ctx = useContext(FollowsContext);
  if (!ctx) throw new Error("useFollows must be used within FollowsProvider");
  return ctx;
}
