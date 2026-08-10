import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { colors, fonts, spacing, radius } from "@/src/theme";
import { TeamLogo } from "./TeamLogo";
import type { Team } from "@/src/lib/api";

type LiteTeam = Pick<Team, "abbr" | "short" | "primary" | "secondary">;

export function ScoreRow({
  home,
  away,
  homeScore,
  awayScore,
  date,
  onPress,
}: {
  home?: LiteTeam;
  away?: LiteTeam;
  homeScore: number;
  awayScore: number;
  date?: string;
  onPress?: () => void;
}) {
  if (!home || !away) return null;
  const awayWon = awayScore > homeScore;
  const homeWon = homeScore > awayScore;
  return (
    <Pressable onPress={onPress} style={styles.row} testID="score-row">
      <Team t={away} score={awayScore} win={awayWon} />
      <View style={styles.mid}>
        <Text style={styles.final}>FINAL</Text>
        {date ? <Text style={styles.date}>{fmt(date)}</Text> : null}
      </View>
      <Team t={home} score={homeScore} win={homeWon} alignRight />
    </Pressable>
  );
}

function Team({ t, score, win, alignRight }: { t: LiteTeam; score: number; win: boolean; alignRight?: boolean }) {
  return (
    <View style={[styles.team, alignRight && { flexDirection: "row-reverse" }]}>
      <TeamLogo abbr={t.abbr} primary={t.primary} secondary={t.secondary} size={34} />
      <View style={[styles.teamText, alignRight && { alignItems: "flex-end" }]}>
        <Text style={styles.abbr}>{t.abbr}</Text>
        <Text style={[styles.score, { color: win ? colors.green : colors.textDim }]}>{score}</Text>
      </View>
    </View>
  );
}

function fmt(d: string) {
  try {
    return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return d;
  }
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  team: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flex: 1 },
  teamText: { gap: 0 },
  abbr: { color: colors.textDim, fontFamily: fonts.display, fontSize: 13, fontWeight: "600", letterSpacing: 0.5 },
  score: { fontFamily: fonts.display, fontSize: 26, fontWeight: "800", lineHeight: 28 },
  mid: { alignItems: "center", paddingHorizontal: spacing.sm },
  final: { color: colors.textFaint, fontFamily: fonts.accent, fontSize: 10, fontWeight: "600", letterSpacing: 1 },
  date: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 11, marginTop: 2 },
});
