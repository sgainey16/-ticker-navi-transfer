import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { colors, fonts, spacing, radius } from "@/src/theme";
import { api, NhlFinalCard } from "@/src/lib/api";
import { useApi } from "@/src/lib/useApi";
import { TabScreen, Loader, ErrorState, SectionTitle } from "@/src/components/ui";
import { NhlGameCard } from "@/src/components/NhlSlate";
import { NhlLogo } from "@/src/components/NhlLogo";

function niceDate(iso?: string | null) {
  if (!iso) return "";
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

export default function Recap() {
  const router = useRouter();
  const q = useApi(() => api.nhlRecaps());

  const games = useMemo(() => q.data?.games || [], [q.data]);
  const featured = games[0];

  // Group finals by date, preserving most-recent-first order.
  const byDate = useMemo(() => {
    const order: string[] = [];
    const map: Record<string, NhlFinalCard[]> = {};
    games.forEach((g) => {
      if (!map[g.date]) { map[g.date] = []; order.push(g.date); }
      map[g.date].push(g);
    });
    return order.map((d) => ({ date: d, items: map[d] }));
  }, [games]);

  const open = (id: string) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(`/recap/${id}`); };

  return (
    <TabScreen>
      {q.loading ? (
        <Loader label="Pulling the real games…" />
      ) : q.error ? (
        <ErrorState message="Couldn't load recaps" onRetry={() => q.reload()} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl tintColor={colors.blue} refreshing={false} onRefresh={() => q.reload()} />}
        >
          <View style={styles.head}>
            <Text style={styles.h1}>THE TICKER RECAP</Text>
            <Text style={styles.sub}>Every final — called by Reggie &amp; Marc, grounded in real NHL data.</Text>
          </View>

          {featured ? (
            <Pressable style={styles.feature} onPress={() => open(featured.id)} testID="recap-featured">
              <Text style={styles.featureKicker}>LATEST FINAL · {niceDate(featured.date)}</Text>
              <View style={styles.featureRow}>
                <View style={styles.featSide}>
                  <NhlLogo abbr={featured.away.abbr} url={featured.away.logo} size={40} />
                  <Text style={styles.featAbbr}>{featured.away.abbr}</Text>
                </View>
                <View style={styles.featScoreBox}>
                  <Text style={styles.featScore}>{featured.away.score} – {featured.home.score}</Text>
                  <Text style={styles.featFinal}>FINAL{featured.period_type && featured.period_type !== "REG" ? `/${featured.period_type}` : ""}</Text>
                </View>
                <View style={styles.featSide}>
                  <NhlLogo abbr={featured.home.abbr} url={featured.home.logo} size={40} />
                  <Text style={styles.featAbbr}>{featured.home.abbr}</Text>
                </View>
              </View>
              <View style={styles.playBtn}>
                <Ionicons name="play" size={15} color={colors.white} />
                <Text style={styles.playText}>PLAY THE CALL</Text>
              </View>
            </Pressable>
          ) : null}

          {byDate.length ? (
            byDate.map((grp) => (
              <View key={grp.date} style={styles.section}>
                <SectionTitle title={niceDate(grp.date)} accent={colors.blue} />
                <View style={{ gap: spacing.sm }}>
                  {grp.items.map((g) => (
                    <NhlGameCard key={g.id} g={g} onPress={() => open(g.id)} />
                  ))}
                </View>
              </View>
            ))
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No completed NHL games yet.</Text>
              <Text style={styles.emptySub}>Recaps appear as soon as games go final.</Text>
            </View>
          )}
        </ScrollView>
      )}
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: 110, gap: spacing.lg },
  head: { gap: 4 },
  h1: { color: colors.white, fontFamily: fonts.display, fontSize: 28, fontWeight: "800", letterSpacing: 0.5 },
  sub: { color: colors.textDim, fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },

  feature: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.blueDim, padding: spacing.lg, gap: spacing.md },
  featureKicker: { color: colors.blue, fontFamily: fonts.accent, fontSize: 11, fontWeight: "700", letterSpacing: 1.5 },
  featureRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  featSide: { alignItems: "center", gap: 6, width: 84 },
  featAbbr: { color: colors.text, fontFamily: fonts.display, fontSize: 18, fontWeight: "800", letterSpacing: 0.4 },
  featScoreBox: { alignItems: "center", gap: 2 },
  featScore: { color: colors.white, fontFamily: fonts.display, fontSize: 30, fontWeight: "800", letterSpacing: 1 },
  featFinal: { color: colors.textFaint, fontFamily: fonts.accent, fontSize: 10, fontWeight: "700", letterSpacing: 1.5 },
  playBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.blue, paddingVertical: 12, borderRadius: radius.pill },
  playText: { color: colors.white, fontFamily: fonts.display, fontSize: 14, fontWeight: "800", letterSpacing: 0.8 },

  section: { gap: spacing.sm },
  empty: { alignItems: "center", paddingVertical: spacing.xxxl, gap: 6 },
  emptyText: { color: colors.textDim, fontFamily: fonts.display, fontSize: 16, fontWeight: "700" },
  emptySub: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 13 },
});
