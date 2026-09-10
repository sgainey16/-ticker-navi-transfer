import React, { useMemo, useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { colors, fonts, spacing, radius } from "@/src/theme";
import { api } from "@/src/lib/api";
import { useApi } from "@/src/lib/useApi";
import { TabScreen, Loader, ErrorState, SectionTitle } from "@/src/components/ui";
import { slateLabel } from "@/src/components/NhlSlate";
import { TickerDesk } from "@/src/components/TickerDesk";
import { GameRail } from "@/src/components/GameRail";
import { GameDepth } from "@/src/components/GameDepth";
import { NhlLogo } from "@/src/components/NhlLogo";

function niceDate(iso?: string | null) {
  if (!iso) return "";
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

export default function Next() {
  const router = useRouter();
  // Available leagues (NHL always; WHL etc. appear once registered on the backend).
  const leaguesQ = useApi(() => api.leagues());
  const leagues = leaguesQ.data?.leagues || [{ code: "nhl", name: "National Hockey League", capabilities: {} }];
  const [league, setLeague] = useState("nhl");

  const board = useApi(() => (league === "nhl" ? api.nhlScoreboard() : api.leagueScoreboard(league)), [league]);

  const games = useMemo(() => board.data?.games || [], [board.data]);
  const isFuture = !!board.data?.is_future;
  const isNhl = league === "nhl";

  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (games.length && !games.find((g) => g.id === selectedId)) setSelectedId(games[0].id);
  }, [games, selectedId]);
  const selected = games.find((g) => g.id === selectedId);

  return (
    <TabScreen>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl tintColor={colors.blue} refreshing={false} onRefresh={() => board.reload()} />}
      >
        {/* league switcher — only when more than one league is connected */}
        {leagues.length > 1 ? (
          <View style={styles.switcher}>
            {leagues.map((l) => {
              const on = l.code === league;
              return (
                <Pressable
                  key={l.code}
                  testID={`league-${l.code}`}
                  style={[styles.segment, on && styles.segmentOn]}
                  onPress={() => { if (!on) { Haptics.selectionAsync(); setSelectedId(undefined); setLeague(l.code); } }}
                >
                  <Text style={[styles.segmentText, on && styles.segmentTextOn]}>{l.code.toUpperCase()}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {/* SHOW — Reggie + Marc, grounded in the selected league */}
        <TickerDesk surface="next" league={league} fallbackTitle="NEXT ON THE TICKER" />

        {board.loading ? (
          <Loader label="Tuning in the desk…" />
        ) : board.error ? (
          <ErrorState message="Couldn't load the slate" onRetry={() => board.reload()} />
        ) : (
          <>
            {isFuture ? (
              <Text style={styles.note}>
                No {league.toUpperCase()} games today ({niceDate(board.data?.today)}). Here&apos;s what&apos;s coming — {niceDate(board.data?.date)}.
              </Text>
            ) : null}

            {games.length ? (
              <View style={styles.section}>
                <View style={styles.railHead}>
                  <SectionTitle title={isFuture ? "The Slate Ahead" : "Today's Slate"} accent={colors.blue} />
                  <Text style={styles.kicker}>{isNhl ? slateLabel(games[0]?.game_type) : "WHL"}</Text>
                </View>
                <GameRail games={games} selectedId={selectedId} onSelect={setSelectedId} />
              </View>
            ) : (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>No {league.toUpperCase()} games scheduled.</Text>
                <Text style={styles.emptySub}>Reggie and Marc will have the next slate ready soon.</Text>
              </View>
            )}

            {/* DEPTH — NHL keeps the full game depth; other leagues show a light,
                honest matchup card (no fabricated depth, no NHL-only deep links). */}
            {selected ? (
              isNhl ? (
                <View style={styles.section}><GameDepth summary={selected} /></View>
              ) : (
                <View style={styles.section}><LiteMatchup game={selected} onOpen={() => router.push(`/game/${selected.id}?league=${league}`)} /></View>
              )
            ) : null}
          </>
        )}

        <View style={{ height: spacing.xxxl }} />
      </ScrollView>
    </TabScreen>
  );
}

function LiteMatchup({ game, onOpen }: { game: any; onOpen: () => void }) {
  const upcoming = game.group === "upcoming";
  const when = game.start_utc
    ? new Date(game.start_utc).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : "";
  return (
    <Pressable style={styles.lite} testID="lite-matchup" onPress={onOpen}>
      <Text style={styles.liteKicker}>SELECTED GAME · TAP FOR DETAILS</Text>
      <View style={styles.liteBoard}>
        <View style={styles.liteSide}>
          <NhlLogo abbr={game.away.abbr} url={game.away.logo} size={34} />
          <Text style={styles.liteAbbr}>{game.away.abbr}</Text>
        </View>
        <View style={styles.liteMid}>
          {upcoming ? <Text style={styles.liteVs}>@</Text> : <Text style={styles.liteScore}>{game.away.score} – {game.home.score}</Text>}
          <Text style={styles.liteStatus}>{(game.state || "").toUpperCase() || (upcoming ? "UPCOMING" : "")}</Text>
        </View>
        <View style={styles.liteSide}>
          <NhlLogo abbr={game.home.abbr} url={game.home.logo} size={34} />
          <Text style={styles.liteAbbr}>{game.home.abbr}</Text>
        </View>
      </View>
      <Text style={styles.liteNote}>
        {game.away.record && game.home.record ? `${game.away.abbr} ${game.away.record}  ·  ${game.home.abbr} ${game.home.record}\n` : ""}
        {when ? `${when}. ` : ""}Reggie &amp; Marc have the WHL desk up top.
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: 110, gap: spacing.md },
  switcher: { flexDirection: "row", backgroundColor: colors.surface, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, padding: 3, alignSelf: "flex-start", gap: 2 },
  segment: { paddingHorizontal: spacing.lg, paddingVertical: 8, borderRadius: radius.pill },
  segmentOn: { backgroundColor: colors.blue },
  segmentText: { color: colors.textDim, fontFamily: fonts.display, fontSize: 13, fontWeight: "800", letterSpacing: 1 },
  segmentTextOn: { color: colors.white },
  note: { color: colors.textDim, fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18 },
  section: { gap: spacing.sm },
  railHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  kicker: { color: colors.blue, fontFamily: fonts.accent, fontSize: 11, fontWeight: "700", letterSpacing: 2 },
  empty: { alignItems: "center", paddingVertical: spacing.xxxl, gap: 6 },
  emptyText: { color: colors.textDim, fontFamily: fonts.display, fontSize: 16, fontWeight: "700" },
  emptySub: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 13 },

  lite: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.sm },
  liteKicker: { color: colors.blue, fontFamily: fonts.accent, fontSize: 11, fontWeight: "700", letterSpacing: 2 },
  liteBoard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  liteSide: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flex: 1 },
  liteAbbr: { color: colors.text, fontFamily: fonts.display, fontSize: 18, fontWeight: "800", letterSpacing: 0.3 },
  liteMid: { alignItems: "center", minWidth: 84 },
  liteScore: { color: colors.white, fontFamily: fonts.display, fontSize: 24, fontWeight: "800", letterSpacing: 1 },
  liteVs: { color: colors.textFaint, fontFamily: fonts.display, fontSize: 18, fontWeight: "700" },
  liteStatus: { color: colors.textFaint, fontFamily: fonts.accent, fontSize: 9, fontWeight: "700", letterSpacing: 1, marginTop: 2 },
  liteNote: { color: colors.textDim, fontFamily: fonts.body, fontSize: 12, lineHeight: 18 },
});
