import { useCallback, useEffect, useState } from "react";

// Current hockey CONTEXT for the session — the league of the surface the user is in.
// Detail routes (league/team/player/game/recap) set it from their stable ?league id;
// the context-aware tabs (RECAP/NEXT/STATS) mirror it. This is what stops the silent
// NHL fallback: tabs inherit the league you're actually in, carried by id — never by name.
type Listener = () => void;
let contextLeague = "nhl";
const listeners = new Set<Listener>();

export const getContextLeague = () => contextLeague;

export const setContextLeague = (lg?: string) => {
  const v = (lg || "nhl").toLowerCase();
  if (v === contextLeague) return;
  contextLeague = v;
  listeners.forEach((l) => l());
};

export const subscribeContextLeague = (l: Listener) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

// Returns [contextLeague, setContextLeague]. A tab's own league switcher should call the
// setter so moving leagues inside a tab also becomes the carried context.
export function useContextLeague(): [string, (lg: string) => void] {
  const [lg, setLg] = useState(getContextLeague());
  useEffect(() => subscribeContextLeague(() => setLg(getContextLeague())), []);
  const set = useCallback((v: string) => setContextLeague(v), []);
  return [lg, set];
}
