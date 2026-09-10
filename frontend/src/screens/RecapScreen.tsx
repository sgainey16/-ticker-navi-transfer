import React, { useMemo, useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl } from "react-native";
import { useRouter } from "expo-router";

import { colors, fonts, spacing, radius } from "@/src/theme";
import { api, NhlGameCard } from "@/src/lib/api";
import { useApi } from "@/src/lib/useApi";
import { TabScreen, Loader, ErrorState, SectionTitle } from "@/src/components/ui";
import { TickerDesk } from "@/src/components/TickerDesk";
import { GameRail } from "@/src/components/GameRail";
import { GameDepth } from "@/src/components/GameDepth";
import { LeagueSwitcher } from "@/src/components/LeagueSwitcher";
import { NhlLogo } from "@/src/components/NhlLogo";

export default function Recap() {
  const router = useRouter();
  const [league, setLeague] = useState("nhl");
  const isNhl = league === "nhl";
  const q = useApi(() => (isNhl ? api.nhlRecaps() : api.leagueRecaps(league)), [league]);

  const games = useMemo(() => (q.data?.games || []) as NhlGameCard[], [q.data]);

  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (games.length && !games.find((g) => g.id === selectedId)) setSelectedId(games[0].id);
  }, [games, selectedId]);
  const selectedGame = useMemo(() => games.find((g) => g.id === selectedId), [games, selectedId]);

  return (
    <TabScreen>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl tintColor={colors.blue} refreshing={false} onRefresh={() => q.reload()} />}
      >
        <LeagueSwitcher league={league} onChange={(c) => { setSelectedId(undefined); setLeague(c); }} />

        {/* SHOW — Reggie + Marc host the postgame, grounded in the selected league */}
        <TickerDesk surface="recap" league={league} fallbackTitle="THE TICKER RECAP" />

        {q.loading ? (
          <Loader label="Rolling the postgame show…" />
        ) : q.error ? (
          <ErrorState message="Couldn't load recaps" onRetry={() => q.reload()} />
        ) : games.length ? (
          <View style={styles.section}>
            <SectionTitle title="Recent Finals" accent={colors.blue} />
            <GameRail games={games} selectedId={selectedId} onSelect={setSelectedId} />
            {isNhl ? (
              <GameDepth summary={selectedGame} deep onHearRecap={(id) => router.push(`/recap/${id}`)} />
            ) : selectedGame ? (
              <FinalCard game={selectedGame} />
            ) : null}
          </View>
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No completed {league.toUpperCase()} games yet.</Text>
            <Text style={styles.emptySub}>Recaps appear as soon as games go final.</Text>
          </View>
        )}
      </ScrollView>
    </TabScreen>
  );
}

function FinalCard({ game }: { game: NhlGameCard }) {
  return (
    <View style={styles.final} testID="final-card">
      <Text style={styles.finalKicker}>SELECTED FINAL</Text>
      <View style={styles.finalBoard}>
        <View style={styles.finalSide}><NhlLogo abbr={game.away.abbr} url={game.away.logo} size={32} /><Text style={styles.finalAbbr}>{game.away.abbr}</Text></View>
        <Text style={styles.finalScore}>{game.away.score} – {game.home.score}</Text>
        <View style={styles.finalSide}><NhlLogo abbr={game.home.abbr} url={game.home.logo} size={32} /><Text style={styles.finalAbbr}>{game.home.abbr}</Text></View>
      </View>
      <Text style={styles.finalNote}>Final{(game as any).date ? ` · ${(game as any).date}` : ""}. Reggie &amp; Marc have the recap up top.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: 110, gap: spacing.lg },

  section: { gap: spacing.sm },
  empty: { alignItems: "center", paddingVertical: spacing.xxxl, gap: 6 },
  emptyText: { color: colors.textDim, fontFamily: fonts.display, fontSize: 16, fontWeight: "700" },
  emptySub: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 13 },

  final: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.sm },
  finalKicker: { color: colors.blue, fontFamily: fonts.accent, fontSize: 11, fontWeight: "700", letterSpacing: 2 },
  finalBoard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  finalSide: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flex: 1 },
  finalAbbr: { color: colors.text, fontFamily: fonts.display, fontSize: 18, fontWeight: "800" },
  finalScore: { color: colors.white, fontFamily: fonts.display, fontSize: 24, fontWeight: "800", letterSpacing: 1, minWidth: 84, textAlign: "center" },
  finalNote: { color: colors.textDim, fontFamily: fonts.body, fontSize: 12, lineHeight: 18 },
});

