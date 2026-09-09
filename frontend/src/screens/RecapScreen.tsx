import React, { useMemo, useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";

import { colors, fonts, spacing, radius } from "@/src/theme";
import { api, NhlGameCard } from "@/src/lib/api";
import { useApi } from "@/src/lib/useApi";
import { TabScreen, Loader, ErrorState, SectionTitle } from "@/src/components/ui";
import { TickerLogo } from "@/src/components/TickerLogo";
import { GameRail } from "@/src/components/GameRail";
import { GameDepth } from "@/src/components/GameDepth";

const HERO = require("../../assets/images/broadcast-desk.png");

export default function Recap() {
  const router = useRouter();
  const q = useApi(() => api.nhlRecaps());

  const games = useMemo(() => (q.data?.games || []) as NhlGameCard[], [q.data]);

  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (selectedId) return;
    if (games.length) setSelectedId(games[0].id);
  }, [games, selectedId]);
  const selectedGame = useMemo(() => games.find((g) => g.id === selectedId), [games, selectedId]);

  return (
    <TabScreen>
      {q.loading ? (
        <Loader label="Rolling the postgame show…" />
      ) : q.error ? (
        <ErrorState message="Couldn't load recaps" onRetry={() => q.reload()} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl tintColor={colors.blue} refreshing={false} onRefresh={() => q.reload()} />}
        >
          {/* SHOW — Reggie + Marc host the postgame */}
          <View style={styles.show}>
            <Image source={HERO} style={StyleSheet.absoluteFill} contentFit="cover" />
            <LinearGradient colors={["rgba(5,7,12,0.45)", "rgba(5,7,12,0.86)"]} style={StyleSheet.absoluteFill} />
            <View style={styles.showTop}>
              <TickerLogo width={104} />
              <View style={styles.badge}><Text style={styles.badgeText}>POSTGAME</Text></View>
            </View>
            <View>
              <Text style={styles.showTitle}>THE TICKER RECAP</Text>
              <Text style={styles.showSub}>What happened across your hockey world — with Reggie &amp; Marc.</Text>
            </View>
          </View>

          {games.length ? (
            <View style={styles.section}>
              <SectionTitle title="Recent Finals" accent={colors.blue} />
              {/* BROWSE — swipe completed games; selecting only changes the depth below */}
              <GameRail games={games} selectedId={selectedId} onSelect={setSelectedId} />
              {/* DEPTH — the selected game, people-first, with a deliberate Hear the Recap */}
              <GameDepth
                summary={selectedGame}
                deep
                onHearRecap={(id) => router.push(`/recap/${id}`)}
              />
            </View>
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

  show: { minHeight: 138, borderRadius: radius.lg, overflow: "hidden", borderWidth: 1, borderColor: colors.border, padding: spacing.lg, justifyContent: "space-between", gap: spacing.md },
  showTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  badge: { backgroundColor: colors.blueDim, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { color: colors.white, fontFamily: fonts.display, fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },
  showTitle: { color: colors.white, fontFamily: fonts.display, fontSize: 24, fontWeight: "800", letterSpacing: 0.5 },
  showSub: { color: colors.textDim, fontFamily: fonts.body, fontSize: 13, lineHeight: 18, marginTop: 2 },

  section: { gap: spacing.sm },
  empty: { alignItems: "center", paddingVertical: spacing.xxxl, gap: 6 },
  emptyText: { color: colors.textDim, fontFamily: fonts.display, fontSize: 16, fontWeight: "700" },
  emptySub: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 13 },
});
