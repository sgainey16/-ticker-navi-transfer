import React from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl } from "react-native";
import { useRouter } from "expo-router";

import { colors, fonts, spacing } from "@/src/theme";
import { api } from "@/src/lib/api";
import { useApi } from "@/src/lib/useApi";
import { TabScreen, Loader, ErrorState } from "@/src/components/ui";
import { NhlSlate, slateLabel } from "@/src/components/NhlSlate";

function niceDate(iso?: string | null) {
  if (!iso) return "";
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

export default function Tonight() {
  const router = useRouter();
  const board = useApi(() => api.nhlScoreboard());

  const games = board.data?.games || [];
  const isFuture = !!board.data?.is_future;

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
            <Text style={styles.h1}>{isFuture ? "NEXT ON THE ICE" : "TONIGHT'S GAMES"}</Text>
            <View style={styles.metaRow}>
              <Text style={styles.kicker}>{slateLabel(games[0]?.game_type)}</Text>
              {board.data?.date ? <Text style={styles.date}>{niceDate(board.data.date)}</Text> : null}
            </View>
            {isFuture ? (
              <Text style={styles.note}>No NHL games today ({niceDate(board.data?.today)}). Showing the next scheduled slate.</Text>
            ) : null}
          </View>

          {games.length ? (
            <NhlSlate games={games} onFinalPress={(id) => router.push(`/recap/${id}`)} />
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No NHL games scheduled.</Text>
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
  note: { color: colors.textDim, fontFamily: fonts.body, fontSize: 12, lineHeight: 17, marginTop: 2 },
  empty: { alignItems: "center", paddingVertical: spacing.xxxl, gap: 6 },
  emptyText: { color: colors.textDim, fontFamily: fonts.display, fontSize: 16, fontWeight: "700" },
  emptySub: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 13 },
});
