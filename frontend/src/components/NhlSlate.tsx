import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { colors, fonts, spacing, radius } from "@/src/theme";
import { NhlGameCard as NhlGameCardType } from "@/src/lib/api";
import { NhlLogo } from "@/src/components/NhlLogo";

export function fmtTime(utc?: string | null) {
  if (!utc) return "";
  const d = new Date(utc);
  let h = d.getHours();
  const m = d.getMinutes();
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m.toString().padStart(2, "0")} ${ap}`;
}

// One shared NHL matchup card — logos, matchup, score/time and status.
export function NhlGameCard({ g, onPress }: { g: NhlGameCardType; onPress?: () => void }) {
  const isFinal = g.group === "final";
  const isLive = g.group === "live";
  const winnerAway = isFinal && (g.away.score ?? 0) > (g.home.score ?? 0);
  const winnerHome = isFinal && (g.home.score ?? 0) > (g.away.score ?? 0);

  return (
    <Pressable style={[styles.card, onPress && styles.cardTappable]} onPress={onPress} disabled={!onPress} testID={`nhl-game-${g.id}`}>
      <View style={styles.side}>
        <NhlLogo abbr={g.away.abbr} url={g.away.logo} size={30} />
        <View>
          <Text style={[styles.abbr, winnerAway && styles.winner]}>{g.away.abbr}</Text>
          {g.away.record ? <Text style={styles.rec}>{g.away.record}</Text> : null}
        </View>
      </View>

      <View style={styles.center}>
        {isFinal || isLive ? (
          <Text style={styles.score}>{g.away.score} – {g.home.score}</Text>
        ) : (
          <Text style={styles.time}>{fmtTime(g.start_utc)}</Text>
        )}
        <Text style={styles.state}>
          {isLive ? `P${g.period ?? ""} ${g.clock ?? ""}`.trim() : isFinal ? "FINAL" : "PUCK DROP"}
        </Text>
      </View>

      <View style={[styles.side, styles.sideRight]}>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={[styles.abbr, winnerHome && styles.winner]}>{g.home.abbr}</Text>
          {g.home.record ? <Text style={styles.rec}>{g.home.record}</Text> : null}
        </View>
        <NhlLogo abbr={g.home.abbr} url={g.home.logo} size={30} />
      </View>
    </Pressable>
  );
}

// Groups a slate into LIVE / UPCOMING / FINAL blocks (each hidden when empty).
export function NhlSlate({
  games,
  onFinalPress,
}: {
  games: NhlGameCardType[];
  onFinalPress?: (id: string) => void;
}) {
  const groups: { key: "live" | "upcoming" | "final"; label: string; items: NhlGameCardType[] }[] = [
    { key: "live", label: "LIVE NOW", items: games.filter((g) => g.group === "live") },
    { key: "upcoming", label: "UPCOMING", items: games.filter((g) => g.group === "upcoming") },
    { key: "final", label: "FINAL", items: games.filter((g) => g.group === "final") },
  ];
  return (
    <>
      {groups.map((grp) =>
        grp.items.length ? (
          <View key={grp.key} style={styles.group}>
            <Text style={styles.groupLabel}>{grp.label}</Text>
            <View style={{ gap: spacing.sm }}>
              {grp.items.map((g) => (
                <NhlGameCard
                  key={g.id}
                  g={g}
                  onPress={g.group === "final" && onFinalPress ? () => onFinalPress(g.id) : undefined}
                />
              ))}
            </View>
          </View>
        ) : null
      )}
    </>
  );
}

export function slateLabel(gt?: number | null) {
  if (gt === 1) return "PRESEASON";
  if (gt === 3) return "STANLEY CUP PLAYOFFS";
  return "AROUND THE NHL";
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  cardTappable: { borderColor: colors.blueDim },
  side: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  sideRight: { justifyContent: "flex-end" },
  abbr: { color: colors.text, fontFamily: fonts.display, fontSize: 17, fontWeight: "700", letterSpacing: 0.4 },
  rec: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 10 },
  winner: { color: colors.white },
  center: { alignItems: "center", minWidth: 78 },
  score: { color: colors.white, fontFamily: fonts.display, fontSize: 20, fontWeight: "800", letterSpacing: 1 },
  time: { color: colors.text, fontFamily: fonts.display, fontSize: 16, fontWeight: "700" },
  state: { color: colors.textFaint, fontFamily: fonts.accent, fontSize: 9, fontWeight: "600", letterSpacing: 1, marginTop: 2 },
  group: { gap: spacing.sm, marginTop: spacing.xs },
  groupLabel: { color: colors.textFaint, fontFamily: fonts.accent, fontSize: 10, fontWeight: "700", letterSpacing: 1.4, marginTop: spacing.xs },
});
