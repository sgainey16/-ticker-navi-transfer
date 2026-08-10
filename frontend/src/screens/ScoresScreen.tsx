import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { useRouter } from "expo-router";

import { colors, fonts, spacing, radius } from "@/src/theme";
import { api, StandingRow, Team } from "@/src/lib/api";
import { useApi } from "@/src/lib/useApi";
import { TabScreen, Loader, ErrorState, SectionTitle } from "@/src/components/ui";
import { TeamLogo } from "@/src/components/TeamLogo";
import { ScoreRow } from "@/src/components/ScoreRow";

export default function Scores() {
  const router = useRouter();
  const standings = useApi(() => api.standings());
  const games = useApi(() => api.games());
  const teams = useApi(() => api.teams());

  const teamMap = useMemo(() => {
    const m: Record<string, Team> = {};
    teams.data?.teams.forEach((t) => (m[t.id] = t));
    return m;
  }, [teams.data]);

  const loading = standings.loading || games.loading || teams.loading;
  const error = standings.error || games.error || teams.error;

  return (
    <TabScreen>
      {loading ? (
        <Loader />
      ) : error ? (
        <ErrorState message="Couldn't load scores" onRetry={() => { standings.reload(); games.reload(); }} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.h1}>Scores & Standings</Text>

          {(["Eastern", "Western"] as const).map((conf) => (
            <View key={conf} style={styles.confBlock}>
              <View style={styles.confHead}>
                <View style={styles.confBar} />
                <Text style={styles.confTitle}>{conf.toUpperCase()} CONFERENCE</Text>
              </View>
              <View style={styles.tableHead}>
                <Text style={[styles.th, styles.colTeam]}>TEAM</Text>
                <Text style={[styles.th, styles.colNum]}>W</Text>
                <Text style={[styles.th, styles.colNum]}>L</Text>
                <Text style={[styles.th, styles.colNum]}>GF</Text>
                <Text style={[styles.th, styles.colNum]}>GA</Text>
                <Text style={[styles.th, styles.colStreak]}>STRK</Text>
                <Text style={[styles.th, styles.colPts]}>PTS</Text>
              </View>
              {standings.data![conf].map((r: StandingRow) => (
                <Pressable key={r.id} style={styles.tr} onPress={() => router.push(`/team/${r.id}`)} testID={`standing-${r.id}`}>
                  <View style={[styles.colTeam, styles.teamCell]}>
                    <Text style={styles.rank}>{r.rank}</Text>
                    <TeamLogo abbr={r.abbr} primary={r.primary} secondary={r.secondary} size={26} />
                    <Text style={styles.teamName}>{r.short}</Text>
                  </View>
                  <Text style={[styles.td, styles.colNum]}>{r.wins}</Text>
                  <Text style={[styles.td, styles.colNum]}>{r.losses}</Text>
                  <Text style={[styles.td, styles.colNum]}>{r.gf}</Text>
                  <Text style={[styles.td, styles.colNum]}>{r.ga}</Text>
                  <Text style={[styles.td, styles.colStreak, { color: r.streak.startsWith("W") ? colors.green : colors.red }]}>{r.streak}</Text>
                  <Text style={[styles.tdPts, styles.colPts]}>{r.points}</Text>
                </Pressable>
              ))}
            </View>
          ))}

          <View style={styles.section}>
            <SectionTitle title="Results" />
            <View style={{ gap: spacing.sm }}>
              {games.data!.games.map((g) => (
                <ScoreRow
                  key={g.id}
                  home={teamMap[g.home_id]}
                  away={teamMap[g.away_id]}
                  homeScore={g.home_score}
                  awayScore={g.away_score}
                  date={g.date}
                  onPress={() => router.push(`/game/${g.id}`)}
                />
              ))}
            </View>
          </View>
        </ScrollView>
      )}
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: 110, gap: spacing.xl },
  h1: { color: colors.white, fontFamily: fonts.display, fontSize: 30, fontWeight: "800" },
  confBlock: { gap: spacing.sm },
  confHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  confBar: { width: 4, height: 16, borderRadius: 2, backgroundColor: colors.green },
  confTitle: { color: colors.text, fontFamily: fonts.display, fontSize: 16, fontWeight: "700", letterSpacing: 1 },
  tableHead: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  th: { color: colors.textFaint, fontFamily: fonts.accent, fontSize: 10, fontWeight: "600", letterSpacing: 0.5, textAlign: "center" },
  tr: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  colTeam: { flex: 1 },
  colNum: { width: 30, textAlign: "center" },
  colStreak: { width: 40, textAlign: "center" },
  colPts: { width: 40, textAlign: "center" },
  teamCell: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  rank: { color: colors.textFaint, fontFamily: fonts.display, fontSize: 14, fontWeight: "700", width: 16 },
  teamName: { color: colors.text, fontFamily: fonts.display, fontSize: 15, fontWeight: "700", letterSpacing: 0.3 },
  td: { color: colors.textDim, fontFamily: fonts.display, fontSize: 15, fontWeight: "600" },
  tdPts: { color: colors.green, fontFamily: fonts.display, fontSize: 17, fontWeight: "800" },
  section: { gap: spacing.sm },
});
