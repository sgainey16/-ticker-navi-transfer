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
  id: string; date: string; status: string; label?: string; home_id: string; away_id: string;
  home_score: number; away_score: number; quarters: number[][];
  stats: { home: GameStatSide; away: GameStatSide };
  timeline: { q: number; time: string; team: string; player: string; note: string }[];
  commentary: { rayo: string; casey: string }; featured?: boolean; video_id?: string | null;
};

export type StandingRow = {
  id: string; name: string; short: string; abbr: string; primary: string; secondary: string;
  rank: number; wins: number; losses: number; pct: number; gf: number; ga: number; gd: number;
  points: number; streak: string; last5: string;
};

export type LeaderEntry = { id: string; name: string; team_id: string; value: number };
export type Star = {
  player_id: string; tag: string; accent: "gold" | "blue" | "green"; tagline: string;
  stat_label: string; spotlight: string; stat_value: number;
  player: Player; team: Team;
};

export type RecapBeat = { host: "reggie" | "marc"; text: string };
export type RecapResponse = {
  game: any;
  beats: RecapBeat[];
  voices: { reggie: string | null; marc: string | null };
};

export type ColdOpenBeat = { id: number; host: "rayo" | "casey" | "system"; kicker: string; text: string };

// ---- Real NHL (THE TICKER Home) ----
export type NhlTeamRef = { abbr: string; name: string; logo?: string | null; score?: number | null; record?: string | null };
export type NhlGameCard = {
  id: string; state: string; group: "live" | "upcoming" | "final";
  start_utc?: string | null; game_type?: number | null;
  period?: number | null; period_type?: string | null; clock?: string | null; in_intermission?: boolean | null;
  away: NhlTeamRef; home: NhlTeamRef;
};
export type NhlHomeResponse = {
  hero: {
    game: any;
    context: RecapBeat[];
  } | null;
  slate: { date: string | null; games: NhlGameCard[] };
  voices: { reggie: string | null; marc: string | null };
};

export type NhlStandRow = {
  abbr: string; name: string; short: string; logo?: string | null;
  conference: string; division?: string | null;
  gp?: number | null; wins?: number | null; losses?: number | null; ot?: number | null;
  points?: number | null; gf?: number | null; ga?: number | null; streak?: string | null;
  conf_rank?: number | null;
};

export type NhlScoreboard = { date: string | null; today?: string | null; is_future?: boolean; games: NhlGameCard[] };
export type NhlFinalCard = NhlGameCard & { date: string; period_type?: string | null };

export const api = {
  home: () => get<any>("/home"),
  nhlHome: () => get<NhlHomeResponse>("/nhl/home"),
  nhlScoreboard: () => get<NhlScoreboard>("/nhl/scoreboard"),
  nhlStandings: () => get<{ Eastern: NhlStandRow[]; Western: NhlStandRow[] }>("/nhl/standings"),
  nhlRecaps: () => get<{ games: NhlFinalCard[] }>("/nhl/recaps"),
  nhlGame: (id: string) => get<{ game: any }>(`/nhl/game/${id}`),
  nhlTeam: (tri: string) => get<any>(`/nhl/team/${tri}`),
  teams: () => get<{ teams: Team[] }>("/teams"),
  team: (id: string) => get<{ team: Team; roster: Player[]; recaps: Game[] }>(`/teams/${id}`),
  player: (id: string) => get<{ player: Player; team: Team }>(`/players/${id}`),
  standings: () => get<{ Eastern: StandingRow[]; Western: StandingRow[] }>("/standings"),
  leaders: () => get<Record<string, LeaderEntry[]>>("/leaders"),
  games: () => get<{ games: Game[] }>("/games"),
  game: (id: string) => get<{ game: Game; home: Team; away: Team }>(`/games/${id}`),
  coldOpen: () => get<any>("/coldopen"),
  segment: (page: string) => get<{ page: string; beats: ColdOpenBeat[] }>(`/segments/${page}`),
  stars: () => get<{ stars: Star[] }>("/stars"),
  recap: (gameId: string) => get<RecapResponse>(`/recap/${gameId}`),
  availability: () => get<{ report: any[] }>("/availability"),
  voicesBriefs: () => get<Record<string, { name: string; description: string; sample: string }>>("/voices/briefs"),
  designVoices: (host: string) => post<{ host: string; previews: { generated_voice_id: string; audio: string; duration: number | null }[] }>("/voices/design", { host }),
  selectVoice: (host: string, generated_voice_id: string) => post<{ host: string; voice_id: string }>("/voices/select", { host, generated_voice_id }),
  voicesSelected: () => get<{ rayo: string | null; casey: string | null }>("/voices/selected"),
  tts: (text: string, voice_id: string, speed?: number) => post<{ audio: string }>("/tts", { text, voice_id, speed }),
  talk: (message: string, session_id: string | null) =>
    post<{ session_id: string; rayo: string; casey: string }>("/talk", { message, session_id }),
  talkHistory: (session_id: string) => get<{ session_id: string; turns: any[] }>(`/talk/${session_id}`),
};
