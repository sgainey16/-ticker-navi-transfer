import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { colors, fonts, spacing, radius } from "@/src/theme";
import { api, NhlLeader, NhlStandRow } from "@/src/lib/api";
import { useApi } from "@/src/lib/useApi";
import { useFollows } from "@/src/lib/follows";
import { TabScreen, Loader, ErrorState, SectionTitle } from "@/src/components/ui";
import { NhlLogo } from "@/src/components/NhlLogo";

const CATS = [
  { key: "points", label: "Points", group: "skaters" as const },
  { key: "goals", label: "Goals", group: "skaters" as const },
  { key: "assists", label: "Assists", group: "skaters" as const },
  { key: "wins", label: "Wins", group: "goalies" as const },
  { key: "gaa", label: "GAA", group: "goalies" as const },
  { key: "svpct", label: "SV%", group: "goalies" as const },
];

function fmtVal(key: string, v: number) {
  if (key === "svpct") return v.toFixed(3).replace(/^0/, "");
  if (key === "gaa") return v.toFixed(2);
  return `${v}`;
}
function ordinal(n?: number | null) {
  if (!n) return "";
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export default function Stats() {
  const router = useRouter();
  const { follows } = useFollows();
  const [cat, setCat] = useState("points");
  const leaders = useApi(() => api.nhlLeaders());
  const standings = useApi(() => api.nhlStandings());

  const followTeams = useMemo(() => new Set(follows.teams.map((t) => t.abbr)), [follows]);
  const followPlayers = useMemo(() => new Set(follows.players.map((p) => p.player_id)), [follows]);

  // "Where my teams sit" — verified standing for followed teams.
  const myStanding = useMemo(() => {
    const d = standings.data;
    if (!d) return [] as (NhlStandRow & { conf: string })[];
    const all = [
      ...(d.Eastern || []).map((r) => ({ ...r, conf: "Eastern" })),
      ...(d.Western || []).map((r) => ({ ...r, conf: "Western" })),
    ];
    return all.filter((r) => followTeams.has(r.abbr)).sort((a, b) => (a.conf_rank || 99) - (b.conf_rank || 99));
  }, [standings.data, followTeams]);

  const active = CATS.find((c) => c.key === cat)!;
  const rows: NhlLeader[] = leaders.data ? (leaders.data[active.group][cat] || []) : [];

  const loading = leaders.loading || standings.loading;

  return (
    <TabScreen>
      {loading ? (
        <Loader label="Pulling the numbers…" />
      ) : leaders.error ? (
        <ErrorState message="Couldn't load stats" onRetry={() => { leaders.reload(); standings.reload(); }} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.head}><View style={styles.headBar} /><Text style={styles.headTitle}>STATS</Text></View>

          {/* WHERE MY TEAMS SIT */}
          {myStanding.length ? (
            <View style={styles.section}>
              <SectionTitle title="Where My Teams Sit" accent={colors.blue} />
              {myStanding.map((r) => (
                <Pressable key={r.abbr} style={[styles.row, styles.rowMine]} onPress={() => router.push(`/team/${r.abbr}`)}>
                  <NhlLogo abbr={r.abbr} url={r.logo} size={34} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowName}>{r.name}</Text>
                    <Text style={styles.rowSub}>{ordinal(r.conf_rank)} in the {r.conf} · {r.wins}-{r.losses}-{r.ot}</Text>
                  </View>
                  <Text style={styles.rowVal}>{r.points}<Text style={styles.rowValUnit}> PTS</Text></Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {/* LEAGUE LEADERS */}
          <View style={styles.section}>
            <SectionTitle title="League Leaders" accent={colors.blue} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {CATS.map((c) => {
                const on = c.key === cat;
                return (
                  <Pressable key={c.key} onPress={() => { Haptics.selectionAsync(); setCat(c.key); }} style={[styles.chip, on && styles.chipOn]} testID={`stat-chip-${c.key}`}>
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>{c.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            {rows.map((p, i) => {
              const mine = followPlayers.has(p.id) || followTeams.has(p.team_abbr);
              return (
                <Pressable key={p.id} style={[styles.leader, mine && styles.rowMine]} onPress={() => router.push(`/player/${p.id}`)} testID={`leader-${p.id}`}>
                  <Text style={[styles.rank, i === 0 && { color: colors.gold }]}>{i + 1}</Text>
                  {p.headshot ? <Image source={p.headshot} style={styles.shot} contentFit="cover" /> : <View style={styles.shot} />}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowName} numberOfLines={1}>{p.name}</Text>
                    <Text style={styles.rowSub}>{p.pos ? `${p.pos} · ` : ""}{p.team_abbr}</Text>
                  </View>
                  <Text style={[styles.leaderVal, i === 0 && { color: colors.gold }]}>{fmtVal(cat, p.value)}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* STANDINGS */}
          {standings.data ? (
            <View style={styles.section}>
              <SectionTitle title="Standings" accent={colors.blue} />
              {(["Eastern", "Western"] as const).map((conf) => (
                <View key={conf} style={{ gap: 4 }}>
                  <Text style={styles.confLabel}>{conf.toUpperCase()}</Text>
                  {(standings.data![conf] || []).map((r, i) => {
                    const mine = followTeams.has(r.abbr);
                    return (
                      <Pressable key={r.abbr} style={[styles.standRow, mine && styles.rowMine]} onPress={() => router.push(`/team/${r.abbr}`)}>
                        <Text style={styles.standRank}>{i + 1}</Text>
                        <NhlLogo abbr={r.abbr} url={r.logo} size={22} />
                        <Text style={[styles.standName, mine && { color: colors.white }]} numberOfLines={1}>{r.short || r.name}</Text>
                        <Text style={styles.standRec}>{r.wins}-{r.losses}-{r.ot}</Text>
                        <Text style={styles.standPts}>{r.points}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
          ) : null}

          <View style={{ height: spacing.xxxl }} />
        </ScrollView>
      )}
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: 110, gap: spacing.lg },
  head: { flexDirection: "row", alignItems: "center", gap: 8 },
  headBar: { width: 4, height: 20, borderRadius: 2, backgroundColor: colors.blue },
  headTitle: { color: colors.white, fontFamily: fonts.display, fontSize: 22, fontWeight: "800", letterSpacing: 1 },

  section: { gap: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  rowMine: { borderColor: colors.blueDim, borderLeftWidth: 3, borderLeftColor: colors.blue },
  rowName: { color: colors.white, fontFamily: fonts.display, fontSize: 15.5, fontWeight: "700", letterSpacing: 0.2 },
  rowSub: { color: colors.textDim, fontFamily: fonts.body, fontSize: 12, marginTop: 1 },
  rowVal: { color: colors.text, fontFamily: fonts.display, fontSize: 20, fontWeight: "800" },
  rowValUnit: { color: colors.textFaint, fontFamily: fonts.accent, fontSize: 10, fontWeight: "700" },

  chipRow: { gap: spacing.sm, paddingVertical: 2, paddingRight: spacing.lg },
  chip: { paddingHorizontal: spacing.lg, height: 34, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  chipOn: { backgroundColor: colors.blueDim, borderColor: colors.blue },
  chipText: { color: colors.textDim, fontFamily: fonts.display, fontSize: 13.5, fontWeight: "700" },
  chipTextOn: { color: colors.white },

  leader: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  rank: { color: colors.textDim, fontFamily: fonts.display, fontSize: 16, fontWeight: "800", width: 20, textAlign: "center" },
  shot: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surfaceHi },
  leaderVal: { color: colors.blue, fontFamily: fonts.display, fontSize: 22, fontWeight: "800" },

  confLabel: { color: colors.textFaint, fontFamily: fonts.accent, fontSize: 10, fontWeight: "700", letterSpacing: 2, marginTop: spacing.xs },
  standRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 8, paddingHorizontal: spacing.md, backgroundColor: colors.surface, borderRadius: radius.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  standRank: { color: colors.textFaint, fontFamily: fonts.display, fontSize: 12, fontWeight: "700", width: 20, textAlign: "center" },
  standName: { flex: 1, color: colors.textDim, fontFamily: fonts.display, fontSize: 13.5, fontWeight: "700" },
  standRec: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 12, width: 66, textAlign: "right" },
  standPts: { color: colors.white, fontFamily: fonts.display, fontSize: 15, fontWeight: "800", width: 32, textAlign: "right" },
});
