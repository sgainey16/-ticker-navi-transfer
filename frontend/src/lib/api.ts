const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`);
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`);
  return res.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} -> ${res.status}`);
  return res.json();
}

// ---- Types ----
export type Team = {
  id: string; name: string; short: string; abbr: string; city: string;
  conference: string; arena: string; primary: string; secondary: string;
  founded: number; coach: string; wins: number; losses: number; gf: number; ga: number;
  gd: number; streak: string; last5: string; seed: number; pct: number; points: number; blurb: string;
};

export type Player = {
  id: string; name: string; team_id: string; number: number; position: string;
  games: number; goals: number; assists: number; points: number; blurb: string;
  saves?: number; save_pct?: number; gaa?: number;
};

export type GameStatSide = {
  goals: number; shots: number; sog: number; possession: number; power_play: string; saves: number;
};

export type Game = {
  id: string; date: string; status: string; home_id: string; away_id: string;
  home_score: number; away_score: number; quarters: number[][];
  stats: { home: GameStatSide; away: GameStatSide };
  timeline: { q: number; time: string; team: string; player: string; note: string }[];
  commentary: { rayo: string; casey: string }; featured?: boolean;
};

export type StandingRow = {
  id: string; name: string; short: string; abbr: string; primary: string; secondary: string;
  rank: number; wins: number; losses: number; pct: number; gf: number; ga: number; gd: number;
  points: number; streak: string; last5: string;
};

export type LeaderEntry = { id: string; name: string; team_id: string; value: number };

export type ColdOpenBeat = { id: number; host: "rayo" | "casey" | "system"; kicker: string; text: string };

export const api = {
  home: () => get<any>("/home"),
  teams: () => get<{ teams: Team[] }>("/teams"),
  team: (id: string) => get<{ team: Team; roster: Player[]; recaps: Game[] }>(`/teams/${id}`),
  player: (id: string) => get<{ player: Player; team: Team }>(`/players/${id}`),
  standings: () => get<{ Eastern: StandingRow[]; Western: StandingRow[] }>("/standings"),
  leaders: () => get<Record<string, LeaderEntry[]>>("/leaders"),
  games: () => get<{ games: Game[] }>("/games"),
  game: (id: string) => get<{ game: Game; home: Team; away: Team }>(`/games/${id}`),
  coldOpen: () => get<any>("/coldopen"),
  availability: () => get<{ report: any[] }>("/availability"),
  voicesBriefs: () => get<Record<string, { name: string; description: string; sample: string }>>("/voices/briefs"),
  designVoices: (host: string) => post<{ host: string; previews: { generated_voice_id: string; audio: string; duration: number | null }[] }>("/voices/design", { host }),
  selectVoice: (host: string, generated_voice_id: string) => post<{ host: string; voice_id: string }>("/voices/select", { host, generated_voice_id }),
  tts: (text: string, voice_id: string) => post<{ audio: string }>("/tts", { text, voice_id }),
  talk: (message: string, session_id: string | null) =>
    post<{ session_id: string; rayo: string; casey: string }>("/talk", { message, session_id }),
  talkHistory: (session_id: string) => get<{ session_id: string; turns: any[] }>(`/talk/${session_id}`),
};
