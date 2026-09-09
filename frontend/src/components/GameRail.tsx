import React from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { colors, fonts, spacing, radius } from "@/src/theme";
import { NhlGameCard } from "@/src/lib/api";
import { NhlLogo } from "@/src/components/NhlLogo";

function fmtTime(utc?: string | null) {
  if (!utc) return "";
  const d = new Date(utc);
  let h = d.getHours(); const m = d.getMinutes();
  const ap = h >= 12 ? "PM" : "AM"; h = h % 12; if (h === 0) h = 12;
  return `${h}:${m.toString().padStart(2, "0")} ${ap}`;
}

// SHOW -> BROWSE: a horizontal, swipeable rail of the hockey world.
// Selecting a card only changes selection (no navigation, no audio).
export function GameRail({
  games,
  selectedId,
  onSelect,
}: {
  games: NhlGameCard[];
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      testID="game-rail"
    >
      {games.map((g) => {
        const selected = g.id === selectedId;
        const isFinal = g.group === "final";
        const isLive = g.group === "live";
        return (
          <Pressable
            key={g.id}
            testID={`rail-card-${g.id}`}
            onPress={() => onSelect(g.id)}
            style={[styles.card, selected && styles.cardSel]}
          >
            <View style={[styles.pill, isLive && styles.pillLive]}>
              {isLive ? <View style={styles.liveDot} /> : null}
              <Text style={[styles.pillText, isLive && { color: colors.white }]}>
                {isLive ? "LIVE" : isFinal ? "FINAL" : fmtTime(g.start_utc) || "SOON"}
              </Text>
            </View>

            <TeamLine abbr={g.away.abbr} logo={g.away.logo} score={g.away.score} show={isFinal || isLive} />
            <TeamLine abbr={g.home.abbr} logo={g.home.logo} score={g.home.score} show={isFinal || isLive} />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function TeamLine({ abbr, logo, score, show }: { abbr: string; logo?: string | null; score?: number | null; show: boolean }) {
  return (
    <View style={styles.teamLine}>
      <NhlLogo abbr={abbr} url={logo} size={22} />
      <Text style={styles.teamAbbr}>{abbr}</Text>
      <View style={{ flex: 1 }} />
      {show ? <Text style={styles.teamScore}>{score}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, paddingVertical: spacing.xs, paddingRight: spacing.lg },
  card: { width: 132, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.sm, gap: 6 },
  cardSel: { borderColor: colors.blue, backgroundColor: colors.surfaceHi },
  pill: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", backgroundColor: colors.surfaceHi, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2, marginBottom: 2 },
  pillLive: { backgroundColor: colors.red },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.white },
  pillText: { color: colors.textFaint, fontFamily: fonts.accent, fontSize: 9, fontWeight: "700", letterSpacing: 0.8 },
  teamLine: { flexDirection: "row", alignItems: "center", gap: 7 },
  teamAbbr: { color: colors.text, fontFamily: fonts.display, fontSize: 15, fontWeight: "800", letterSpacing: 0.3 },
  teamScore: { color: colors.white, fontFamily: fonts.display, fontSize: 16, fontWeight: "800" },
});
