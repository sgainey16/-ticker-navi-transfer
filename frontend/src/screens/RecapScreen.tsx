import React, { useMemo, useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl } from "react-native";
import { useRouter } from "expo-router";

import { colors, fonts, spacing } from "@/src/theme";
import { api, NhlGameCard } from "@/src/lib/api";
import { useApi } from "@/src/lib/useApi";
import { TabScreen, Loader, ErrorState, SectionTitle } from "@/src/components/ui";
import { TickerDesk } from "@/src/components/TickerDesk";
import { GameRail } from "@/src/components/GameRail";
import { GameDepth } from "@/src/components/GameDepth";

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
          {/* SHOW — Reggie + Marc host the postgame (prepared/cached league recap show) */}
          <TickerDesk surface="recap" fallbackTitle="THE TICKER RECAP" />

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

  section: { gap: spacing.sm },
  empty: { alignItems: "center", paddingVertical: spacing.xxxl, gap: 6 },
  emptyText: { color: colors.textDim, fontFamily: fonts.display, fontSize: 16, fontWeight: "700" },
  emptySub: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 13 },
});
