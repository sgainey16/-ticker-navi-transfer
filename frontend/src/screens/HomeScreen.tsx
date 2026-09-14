import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { colors, fonts, spacing, radius } from "@/src/theme";
import { api, NhlGameCard } from "@/src/lib/api";
import { useApi } from "@/src/lib/useApi";
import { useFollows, Tier, PlayerFollow, TeamFollow } from "@/src/lib/follows";
import { TabScreen, SectionTitle, Loader } from "@/src/components/ui";
import { TickerStrip } from "@/src/components/TickerStrip";
import { NhlLogo } from "@/src/components/NhlLogo";
import { HomeShow } from "@/src/components/HomeShow";
import { GameRail } from "@/src/components/GameRail";
import { GameDepth } from "@/src/components/GameDepth";

const ROUND: Record<Tier, { label: string; sub: string; color: string }> = {
  1: { label: "1ST ROUND", sub: "CAN'T-MISS", color: colors.gold },
  2: { label: "2ND ROUND", sub: "REGULARS", color: colors.blue },
  3: { label: "3RD ROUND", sub: "KEEP ME POSTED", color: "#9AA6B8" },
};

function fmtTime(utc?: string | null) {
  if (!utc) return "";
  const d = new Date(utc); let h = d.getHours(); const m = d.getMinutes();
  const ap = h >= 12 ? "PM" : "AM"; h = h % 12; if (h === 0) h = 12;
  return `${h}:${m.toString().padStart(2, "0")} ${ap}`;
}
function initials(name?: string) {
  if (!name) return "?";
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] || "") + (p[p.length - 1]?.[0] || "")).toUpperCase();
}

export default function Home() {
  const router = useRouter();
  const { follows } = useFollows();

  const feed = useApi(() => api.nhlHome());
  const recapsQ = useApi(() => api.nhlRecaps());

  const followTeamSet = useMemo(() => new Set(follows.teams.map((t) => t.abbr)), [follows]);
  const followPlayerTeams = useMemo(() => new Set(follows.players.map((p) => p.team_abbr)), [follows]);

  const slateGames = useMemo(() => feed.data?.slate?.games || [], [feed.data]);
  const finals = useMemo(() => recapsQ.data?.games || [], [recapsQ.data]);

  // WHAT'S HAPPENING AROUND MY HOCKEY — events touching followed teams first, then league.
  const mine = (g: NhlGameCard) =>
    followTeamSet.has(g.away.abbr) || followTeamSet.has(g.home.abbr) ||
    followPlayerTeams.has(g.away.abbr) || followPlayerTeams.has(g.home.abbr);

  const happening = useMemo(() => {
    const live = slateGames.filter((g) => g.group === "live");
    const pool: NhlGameCard[] = [...live, ...finals] as NhlGameCard[];
    const seen = new Set<string>();
    const dedup = pool.filter((g) => (seen.has(g.id) ? false : (seen.add(g.id), true)));
    // followed events first
    return [...dedup.filter(mine), ...dedup.filter((g) => !mine(g))];
  }, [slateGames, finals, followTeamSet, followPlayerTeams]); // eslint-disable-line react-hooks/exhaustive-deps

  const upcoming = useMemo(() => {
    const up = slateGames.filter((g) => g.group === "upcoming") as NhlGameCard[];
    return [...up.filter(mine), ...up.filter((g) => !mine(g))];
  }, [slateGames, followTeamSet, followPlayerTeams]); // eslint-disable-line react-hooks/exhaustive-deps

  const [selectedId, setSelectedId] = React.useState<string | undefined>(undefined);
  React.useEffect(() => {
    if (selectedId && happening.some((g) => g.id === selectedId)) return;
    if (happening.length) setSelectedId(happening[0].id);
  }, [happening, selectedId]);
  const selectedGame = useMemo(() => happening.find((g) => g.id === selectedId), [happening, selectedId]);

  const tickerItems = useMemo(() => slateGames.map((x) => {
    if (x.group === "final") return `${x.away.abbr} ${x.away.score}, ${x.home.abbr} ${x.home.score} · FINAL`;
    if (x.group === "live") return `${x.away.abbr} ${x.away.score}-${x.home.score} ${x.home.abbr} · P${x.period} ${x.clock}`;
    return `${x.away.abbr} @ ${x.home.abbr} · ${fmtTime(x.start_utc)}`;
  }), [slateGames]);

  // Draft Board groupings
  const byRound = (tier?: Tier) => ({
    teams: follows.teams.filter((t) => t.tier === tier),
    players: follows.players.filter((p) => p.tier === tier),
  });
  const r1 = byRound(1), r2 = byRound(2), r3 = byRound(3);
  const unranked = { teams: follows.teams.filter((t) => !t.tier), players: follows.players.filter((p) => !p.tier) };
  const hasFollows = follows.teams.length > 0 || follows.players.length > 0;

  const goTeam = (abbr: string, lg?: string) => { Haptics.selectionAsync(); router.push(`/team/${abbr}${lg && lg !== "nhl" ? `?league=${lg}` : ""}`); };
  const goPlayer = (id: string, lg?: string) => { if (lg && lg !== "nhl") return; Haptics.selectionAsync(); router.push(`/player/${id}`); };

  return (
    <TabScreen>
      {tickerItems.length ? <TickerStrip items={tickerItems} /> : null}
      {feed.loading ? (
        <Loader label="Tuning in your hockey…" />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl tintColor={colors.blue} refreshing={false} onRefresh={() => { feed.reload(); recapsQ.reload(); }} />}
        >
          {/* 1. MY TICKER — the produced, personalized auto-advancing Sports Desk */}
          <HomeShow />

          {/* 2. MY DRAFT BOARD */}
          {hasFollows ? (
            <View style={styles.section}>
              <View style={styles.boardHead}>
                <View style={styles.boardBar} />
                <Text style={styles.boardTitle}>MY DRAFT BOARD</Text>
              </View>
              {r1.teams.length + r1.players.length > 0 ? (
                <RoundRail tier={1} data={r1} big onTeam={goTeam} onPlayer={goPlayer} />
              ) : null}
              {r2.teams.length + r2.players.length > 0 ? (
                <RoundRail tier={2} data={r2} onTeam={goTeam} onPlayer={goPlayer} />
              ) : null}
              {r3.teams.length + r3.players.length > 0 ? (
                <RoundRail tier={3} data={r3} onTeam={goTeam} onPlayer={goPlayer} />
              ) : null}
              {unranked.teams.length + unranked.players.length > 0 ? (
                <FollowingRow data={unranked} onTeam={goTeam} onPlayer={goPlayer} />
              ) : null}
            </View>
          ) : (
            <Pressable style={styles.buildCard} onPress={() => router.replace("/onboarding?reset=1")}>
              <Ionicons name="albums-outline" size={20} color={colors.blue} />
              <Text style={styles.buildText}>Build your Draft Board to personalize The Ticker.</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
            </Pressable>
          )}

          {/* 3. WHAT'S HAPPENING AROUND MY HOCKEY */}
          {happening.length ? (
            <View style={styles.section}>
              <SectionTitle title={hasFollows ? "Around My Hockey" : "Around the NHL"} accent={colors.blue} />
              <GameRail games={happening} selectedId={selectedId} onSelect={setSelectedId} />
              <GameDepth summary={selectedGame} />
            </View>
          ) : null}

          {/* Coming up (followed events first) */}
          {upcoming.length ? (
            <View style={styles.section}>
              <SectionTitle title="Coming Up" accent={colors.blue} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.upRow}>
                {upcoming.map((g) => (
                  <Pressable key={g.id} style={[styles.upCard, mine(g) && styles.upCardMine]} onPress={() => router.push(`/game/${g.id}`)}>
                    <Text style={styles.upTime}>{fmtTime(g.start_utc)}</Text>
                    <View style={styles.upTeams}>
                      <NhlLogo abbr={g.away.abbr} size={18} />
                      <Text style={styles.upAbbr}>{g.away.abbr}</Text>
                      <Text style={styles.upAt}>@</Text>
                      <Text style={styles.upAbbr}>{g.home.abbr}</Text>
                      <NhlLogo abbr={g.home.abbr} size={18} />
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}

          <View style={{ height: spacing.xxxl }} />
        </ScrollView>
      )}
    </TabScreen>
  );
}

function RoundRail({ tier, data, big, onTeam, onPlayer }: {
  tier: Tier; data: { teams: TeamFollow[]; players: PlayerFollow[] };
  big?: boolean; onTeam: (a: string, lg?: string) => void; onPlayer: (id: string, lg?: string) => void;
}) {
  const r = ROUND[tier];
  const logo = big ? 52 : 38;
  const av = big ? 52 : 38;
  return (
    <View style={styles.round}>
      <View style={styles.roundHead}>
        <View style={[styles.roundPip, { backgroundColor: r.color }]} />
        <Text style={[styles.roundLabel, big && { fontSize: 15 }]}>{r.label}</Text>
        <Text style={styles.roundSub}>{r.sub}</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.railRow}>
        {data.teams.map((t) => (
          <Pressable key={`t${t.abbr}`} style={[styles.tile, big && styles.tileBig, { borderColor: r.color + "55" }]} onPress={() => onTeam(t.abbr, t.league)} testID={`board-team-${t.abbr}`}>
            <NhlLogo abbr={t.abbr} url={t.logo} size={logo} />
            <Text style={[styles.tileName, big && { fontSize: 12 }]} numberOfLines={1}>{t.name || t.abbr}</Text>
          </Pressable>
        ))}
        {data.players.map((p) => (
          <Pressable key={`p${p.player_id}`} style={[styles.tile, big && styles.tileBig, { borderColor: r.color + "55" }]} onPress={() => onPlayer(p.player_id, p.league)} testID={`board-player-${p.player_id}`}>
            <View style={[styles.avatar, { width: av, height: av, borderRadius: av / 2, borderColor: r.color }]}>
              <Text style={[styles.avInit, big && { fontSize: 17 }]}>{initials(p.name)}</Text>
            </View>
            <Text style={[styles.tileName, big && { fontSize: 12 }]} numberOfLines={1}>{p.name || p.team_abbr}</Text>
            <Text style={styles.tileMeta}>{p.pos || ""} · {p.team_abbr}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function FollowingRow({ data, onTeam, onPlayer }: {
  data: { teams: TeamFollow[]; players: PlayerFollow[] }; onTeam: (a: string, lg?: string) => void; onPlayer: (id: string, lg?: string) => void;
}) {
  return (
    <View style={styles.round}>
      <View style={styles.roundHead}>
        <View style={[styles.roundPip, { backgroundColor: colors.textFaint }]} />
        <Text style={styles.roundLabel}>FOLLOWING</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.railRow}>
        {data.teams.map((t) => (
          <Pressable key={`ft${t.abbr}`} style={styles.miniChip} onPress={() => onTeam(t.abbr, t.league)}>
            <NhlLogo abbr={t.abbr} url={t.logo} size={22} />
            <Text style={styles.miniText}>{t.abbr}</Text>
          </Pressable>
        ))}
        {data.players.map((p) => (
          <Pressable key={`fp${p.player_id}`} style={styles.miniChip} onPress={() => onPlayer(p.player_id, p.league)}>
            <View style={styles.miniAv}><Text style={styles.miniInit}>{initials(p.name)}</Text></View>
            <Text style={styles.miniText} numberOfLines={1}>{p.name?.split(" ").slice(-1)[0] || p.team_abbr}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: 110, gap: spacing.lg },

  section: { gap: spacing.sm },

  boardHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 },
  boardBar: { width: 4, height: 18, borderRadius: 2, backgroundColor: colors.gold },
  boardTitle: { color: colors.white, fontFamily: fonts.display, fontSize: 20, fontWeight: "800", letterSpacing: 1 },

  round: { gap: spacing.sm, marginTop: spacing.sm },
  roundHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  roundPip: { width: 8, height: 8, borderRadius: 4 },
  roundLabel: { color: colors.white, fontFamily: fonts.display, fontSize: 13, fontWeight: "800", letterSpacing: 1 },
  roundSub: { color: colors.textFaint, fontFamily: fonts.accent, fontSize: 10, fontWeight: "700", letterSpacing: 1.5 },

  railRow: { gap: spacing.sm, paddingRight: spacing.lg },
  tile: { width: 78, alignItems: "center", gap: 5, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, paddingVertical: spacing.md, paddingHorizontal: 6 },
  tileBig: { width: 96, paddingVertical: spacing.lg },
  tileName: { color: colors.text, fontFamily: fonts.display, fontSize: 11, fontWeight: "700", textAlign: "center" },
  tileMeta: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 9.5 },
  avatar: { backgroundColor: colors.surfaceHi, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  avInit: { color: colors.white, fontFamily: fonts.display, fontSize: 13, fontWeight: "800" },

  miniChip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.surface, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, paddingLeft: 5, paddingRight: spacing.md, paddingVertical: 5 },
  miniAv: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.surfaceHi, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  miniInit: { color: colors.white, fontFamily: fonts.display, fontSize: 9, fontWeight: "800" },
  miniText: { color: colors.textDim, fontFamily: fonts.display, fontSize: 12, fontWeight: "700", maxWidth: 90 },

  buildCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.blueDim, padding: spacing.lg },
  buildText: { flex: 1, color: colors.text, fontFamily: fonts.body, fontSize: 13.5 },

  upRow: { gap: spacing.sm, paddingRight: spacing.lg },
  upCard: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: 6, minWidth: 132 },
  upCardMine: { borderColor: colors.blue },
  upTime: { color: colors.textFaint, fontFamily: fonts.accent, fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  upTeams: { flexDirection: "row", alignItems: "center", gap: 6 },
  upAbbr: { color: colors.text, fontFamily: fonts.display, fontSize: 13, fontWeight: "800" },
  upAt: { color: colors.textFaint, fontFamily: fonts.display, fontSize: 11 },
});
