import React from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl } from "react-native";
import { useRouter } from "expo-router";

import { colors, fonts, spacing } from "@/src/theme";
import { api, NhlStandRow } from "@/src/lib/api";
import { useApi } from "@/src/lib/useApi";
import { TabScreen, Loader, ErrorState, SectionTitle } from "@/src/components/ui";
import { NhlSlate } from "@/src/components/NhlSlate";
import { NhlLogo } from "@/src/components/NhlLogo";

export default function Scores() {
  const router = useRouter();
  const board = useApi(() => api.nhlScoreboard());
  const standings = useApi(() => api.nhlStandings());

  const games = board.data?.games || [];
  const loading = board.loading || standings.loading;
  const hasStandings = !!(standings.data && (standings.data.Eastern.length || standings.data.Western.length));

  return (
    <TabScreen>
      {loading ? (
        <Loader label="Loading scores…" />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl tintColor={colors.blue} refreshing={false} onRefresh={() => { board.reload(); standings.reload(); }} />}
        >
          <Text style={styles.h1}>Scores & Standings</Text>

          {/* SCOREBOARD */}
          {games.length ? (
            <View style={styles.section}>
              <SectionTitle title="Scoreboard" accent={colors.blue} action={board.data?.date ? <Text style={styles.date}>{board.data.date}</Text> : undefined} />
              <NhlSlate games={games} onFinalPress={(id) => router.push(`/recap/${id}`)} />
            </View>
          ) : null}

          {/* STANDINGS */}
          {hasStandings ? (
            (["Eastern", "Western"] as const).map((conf) => (
              <View key={conf} style={styles.section}>
                <SectionTitle title={`${conf} Conference`} accent={colors.blue} />
                <View style={styles.tableHead}>
                  <Text style={[styles.th, styles.colTeam]}>TEAM</Text>
                  <Text style={[styles.th, styles.colNum]}>GP</Text>
                  <Text style={[styles.th, styles.colNum]}>W</Text>
                  <Text style={[styles.th, styles.colNum]}>L</Text>
                  <Text style={[styles.th, styles.colNum]}>OT</Text>
                  <Text style={[styles.th, styles.colPts]}>PTS</Text>
                </View>
                {standings.data![conf].map((r: NhlStandRow) => (
                  <View key={r.abbr} style={styles.tr} testID={`standing-${r.abbr}`}>
                    <View style={[styles.colTeam, styles.teamCell]}>
                      <Text style={styles.rank}>{r.conf_rank}</Text>
                      <NhlLogo abbr={r.abbr} url={r.logo} size={24} />
                      <Text style={styles.teamName}>{r.short}</Text>
                    </View>
                    <Text style={[styles.td, styles.colNum]}>{r.gp}</Text>
                    <Text style={[styles.td, styles.colNum]}>{r.wins}</Text>
                    <Text style={[styles.td, styles.colNum]}>{r.losses}</Text>
                    <Text style={[styles.td, styles.colNum]}>{r.ot}</Text>
                    <Text style={[styles.tdPts, styles.colPts]}>{r.points}</Text>
                  </View>
                ))}
              </View>
            ))
          ) : null}

          {!games.length && !hasStandings ? (
            <ErrorState message="NHL data is unavailable right now" onRetry={() => { board.reload(); standings.reload(); }} />
          ) : null}
        </ScrollView>
      )}
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: 110, gap: spacing.xl },
  h1: { color: colors.white, fontFamily: fonts.display, fontSize: 30, fontWeight: "800" },
  section: { gap: spacing.sm },
  date: { color: colors.textFaint, fontFamily: fonts.accent, fontSize: 11, fontWeight: "600", letterSpacing: 1 },
  tableHead: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  th: { color: colors.textFaint, fontFamily: fonts.accent, fontSize: 10, fontWeight: "600", letterSpacing: 0.5, textAlign: "center" },
  tr: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  colTeam: { flex: 1 },
  colNum: { width: 30, textAlign: "center" },
  colPts: { width: 40, textAlign: "center" },
  teamCell: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  rank: { color: colors.textFaint, fontFamily: fonts.display, fontSize: 14, fontWeight: "700", width: 18 },
  teamName: { color: colors.text, fontFamily: fonts.display, fontSize: 15, fontWeight: "700", letterSpacing: 0.3 },
  td: { color: colors.textDim, fontFamily: fonts.display, fontSize: 15, fontWeight: "600" },
  tdPts: { color: colors.blue, fontFamily: fonts.display, fontSize: 17, fontWeight: "800" },
});
