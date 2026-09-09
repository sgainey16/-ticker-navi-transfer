import React from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl } from "react-native";
import { useRouter } from "expo-router";

import { colors, fonts, spacing } from "@/src/theme";
import { api } from "@/src/lib/api";
import { useApi } from "@/src/lib/useApi";
import { TabScreen, Loader, ErrorState } from "@/src/components/ui";
import { NhlSlate, slateLabel } from "@/src/components/NhlSlate";

export default function Tonight() {
  const router = useRouter();
  const board = useApi(() => api.nhlScoreboard());

  const games = board.data?.games || [];

  return (
    <TabScreen>
      {board.loading ? (
        <Loader label="Loading the slate…" />
      ) : board.error ? (
        <ErrorState message="Couldn't load the NHL slate" onRetry={() => board.reload()} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl tintColor={colors.blue} refreshing={false} onRefresh={() => board.reload()} />}
        >
          <View style={styles.head}>
            <Text style={styles.h1}>{"TONIGHT'S GAMES"}</Text>
            <View style={styles.metaRow}>
              <Text style={styles.kicker}>{slateLabel(games[0]?.game_type)}</Text>
              {board.data?.date ? <Text style={styles.date}>{board.data.date}</Text> : null}
            </View>
          </View>

          {games.length ? (
            <NhlSlate games={games} onFinalPress={(id) => router.push(`/recap/${id}`)} />
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No NHL games on the schedule right now.</Text>
              <Text style={styles.emptySub}>Check back on game day.</Text>
            </View>
          )}
        </ScrollView>
      )}
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: 110, gap: spacing.md },
  head: { gap: 6 },
  h1: { color: colors.white, fontFamily: fonts.display, fontSize: 26, fontWeight: "800", letterSpacing: 0.5 },
  metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  kicker: { color: colors.blue, fontFamily: fonts.accent, fontSize: 11, fontWeight: "700", letterSpacing: 2 },
  date: { color: colors.textFaint, fontFamily: fonts.accent, fontSize: 11, fontWeight: "600", letterSpacing: 1 },
  empty: { alignItems: "center", paddingVertical: spacing.xxxl, gap: 6 },
  emptyText: { color: colors.textDim, fontFamily: fonts.display, fontSize: 16, fontWeight: "700" },
  emptySub: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 13 },
});
