import React, { useMemo, useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl } from "react-native";

import { colors, fonts, spacing } from "@/src/theme";
import { api } from "@/src/lib/api";
import { useApi } from "@/src/lib/useApi";
import { TabScreen, Loader, ErrorState, SectionTitle } from "@/src/components/ui";
import { slateLabel } from "@/src/components/NhlSlate";
import { TickerDesk } from "@/src/components/TickerDesk";
import { GameRail } from "@/src/components/GameRail";
import { GameDepth } from "@/src/components/GameDepth";

function niceDate(iso?: string | null) {
  if (!iso) return "";
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

export default function Next() {
  const board = useApi(() => api.nhlScoreboard());

  const games = useMemo(() => board.data?.games || [], [board.data]);
  const isFuture = !!board.data?.is_future;

  // BROWSE selection — never navigates, never restarts the desk.
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (games.length && !games.find((g) => g.id === selectedId)) setSelectedId(games[0].id);
  }, [games, selectedId]);
  const selected = games.find((g) => g.id === selectedId);

  return (
    <TabScreen>
      {board.loading ? (
        <Loader label="Tuning in the desk…" />
      ) : board.error ? (
        <ErrorState message="Couldn't load the NHL slate" onRetry={() => board.reload()} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl tintColor={colors.blue} refreshing={false} onRefresh={() => board.reload()} />}
        >
          {/* SHOW — Reggie + Marc first (prepared/cached league preview) */}
          <TickerDesk surface="next" fallbackTitle="NEXT ON THE TICKER" />

          {isFuture ? (
            <Text style={styles.note}>
              No NHL games today ({niceDate(board.data?.today)}). Here&apos;s what&apos;s coming — {niceDate(board.data?.date)}.
            </Text>
          ) : null}

          {/* BROWSE — horizontal upcoming rail */}
          {games.length ? (
            <View style={styles.section}>
              <View style={styles.railHead}>
                <SectionTitle title={isFuture ? "The Slate Ahead" : "Today's Slate"} accent={colors.blue} />
                <Text style={styles.kicker}>{slateLabel(games[0]?.game_type)}</Text>
              </View>
              <GameRail games={games} selectedId={selectedId} onSelect={setSelectedId} />
            </View>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No NHL games scheduled.</Text>
              <Text style={styles.emptySub}>Reggie and Marc will have the next slate ready soon.</Text>
            </View>
          )}

          {/* DEPTH — selected matchup context (PREVIEW THIS GAME / OPEN GAME live inside) */}
          {selected ? (
            <View style={styles.section}>
              <GameDepth summary={selected} />
            </View>
          ) : null}

          <View style={{ height: spacing.xxxl }} />
        </ScrollView>
      )}
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: 110, gap: spacing.md },
  note: { color: colors.textDim, fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18 },
  section: { gap: spacing.sm },
  railHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  kicker: { color: colors.blue, fontFamily: fonts.accent, fontSize: 11, fontWeight: "700", letterSpacing: 2 },
  empty: { alignItems: "center", paddingVertical: spacing.xxxl, gap: 6 },
  emptyText: { color: colors.textDim, fontFamily: fonts.display, fontSize: 16, fontWeight: "700" },
  emptySub: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 13 },
});
