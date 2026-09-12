import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";

import { colors, fonts, spacing, radius } from "@/src/theme";
import { api, NhlStandRow } from "@/src/lib/api";
import { useApi } from "@/src/lib/useApi";
import { Screen, Loader, ErrorState } from "@/src/components/ui";
import { NhlLogo } from "@/src/components/NhlLogo";
import { BackBar } from "@/app/team/[id]";
import { prefetchTeam } from "@/src/lib/cache";
import { setContextLeague } from "@/src/lib/context";

const LEAGUE_NAMES: Record<string, string> = {
  nhl: "National Hockey League", whl: "Western Hockey League",
  ohl: "Ontario Hockey League", qmjhl: "QMJHL", ahl: "American Hockey League",
  echl: "ECHL", ncaa: "NCAA Hockey",
};

export default function LeagueHub() {
  const { code, division } = useLocalSearchParams<{ code: string; division?: string }>();
  const lg = (code || "nhl").toLowerCase();
  const isNhl = lg === "nhl";
  const lq = isNhl ? "" : `?league=${lg}`;
  const router = useRouter();
  const q = useApi(() => api.leagueStandings(lg), [lg]);
  React.useEffect(() => { setContextLeague(lg); }, [lg]);

  const groups = useMemo(() => {
    if (!q.data) return [];
    const rows = [...(q.data.Eastern || []), ...(q.data.Western || [])];
    const byDiv = new Map<string, NhlStandRow[]>();
    for (const r of rows) {
      const d = r.division || r.conference || "Standings";
      if (!byDiv.has(d)) byDiv.set(d, []);
      byDiv.get(d)!.push(r);
    }
    let out = Array.from(byDiv.entries()).map(([name, list]) => ({
      name, list: [...list].sort((a, b) => (b.points ?? 0) - (a.points ?? 0)),
    }));
    // if we arrived from a division chip, float that division to the top
    if (division) out = out.sort((a, b) => (a.name === division ? -1 : b.name === division ? 1 : 0));
    return out;
  }, [q.data, division]);

  if (q.loading) return <Screen><BackBar /><Loader label="Loading the league…" /></Screen>;
  if (q.error || !q.data) return <Screen><BackBar /><ErrorState message="Failed to load league" onRetry={q.reload} /></Screen>;

  return (
    <Screen>
      <BackBar />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.head}>
          <Text style={styles.kicker}>LEAGUE</Text>
          <Text style={styles.name}>{LEAGUE_NAMES[lg] || lg.toUpperCase()}</Text>
          <Text style={styles.sub}>Tap any team to jump in — wander the whole league.</Text>
        </View>

        {groups.map((g) => (
          <View key={g.name} style={[styles.section, division === g.name && styles.sectionHi]}>
            <Text style={styles.divTitle}>{g.name}</Text>
            <View style={styles.card}>
              {g.list.map((r, i) => (
                <Pressable
                  key={r.abbr}
                  style={styles.row}
                  onPressIn={() => prefetchTeam(lg, r.abbr)}
                  onPress={() => router.push(`/team/${r.abbr}${lq}`)}
                  testID={`league-team-${r.abbr}`}
                >
                  <Text style={styles.rank}>{i + 1}</Text>
                  <NhlLogo abbr={r.abbr} url={r.logo} size={26} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tName} numberOfLines={1}>{r.name}</Text>
                    <Text style={styles.tRec}>{r.wins ?? 0}-{r.losses ?? 0}{r.ot != null ? `-${r.ot}` : ""}{r.gp != null ? ` · ${r.gp} GP` : ""}</Text>
                  </View>
                  <Text style={styles.pts}>{r.points ?? 0}</Text>
                  <Text style={styles.ptsLabel}>PTS</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
                </Pressable>
              ))}
            </View>
          </View>
        ))}
        <View style={{ height: spacing.xxxl }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxxl, gap: spacing.md },
  head: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: 4 },
  kicker: { color: colors.blue, fontFamily: fonts.accent, fontSize: 11, fontWeight: "700", letterSpacing: 2 },
  name: { color: colors.white, fontFamily: fonts.display, fontSize: 24, fontWeight: "800", letterSpacing: 0.3 },
  sub: { color: colors.textDim, fontFamily: fonts.body, fontSize: 12.5 },

  section: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  sectionHi: {},
  divTitle: { color: colors.textDim, fontFamily: fonts.accent, fontSize: 11, fontWeight: "700", letterSpacing: 1.5 },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },

  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  rank: { color: colors.blue, fontFamily: fonts.display, fontSize: 14, fontWeight: "800", width: 18, textAlign: "center" },
  tName: { color: colors.text, fontFamily: fonts.display, fontSize: 15, fontWeight: "700" },
  tRec: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 11, marginTop: 1 },
  pts: { color: colors.white, fontFamily: fonts.display, fontSize: 17, fontWeight: "800", width: 34, textAlign: "right" },
  ptsLabel: { color: colors.textFaint, fontFamily: fonts.accent, fontSize: 8, fontWeight: "700", letterSpacing: 0.5, marginRight: 2 },
});
