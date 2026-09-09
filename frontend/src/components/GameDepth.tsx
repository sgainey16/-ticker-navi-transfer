import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { colors, fonts, spacing, radius } from "@/src/theme";
import { api, NhlGameCard } from "@/src/lib/api";
import { NhlLogo } from "@/src/components/NhlLogo";

const FINAL = ["OFF", "FINAL"];

// simple module-level cache so re-selecting a game is instant (no audio, no refetch churn)
const cache: Record<string, any> = {};

function periodName(p: number, type?: string) {
  if (type === "OT") return "OT";
  if (type === "SO") return "SO";
  return ["1st", "2nd", "3rd", "4th"][p - 1] || `P${p}`;
}
function fmtStat(k: string, v: any): string {
  if (v == null) return "–";
  if (typeof v === "number" && v > 0 && v < 1) return `${(v * 100).toFixed(1)}%`;
  return String(v);
}

// BROWSE -> DEPTH: contextual detail for the selected game, without leaving the show.
export function GameDepth({ summary }: { summary?: NhlGameCard }) {
  const router = useRouter();
  const [game, setGame] = useState<any>(summary ? cache[summary.id] : null);
  const [loading, setLoading] = useState(false);
  const idRef = useRef<string | undefined>(summary?.id);

  useEffect(() => {
    const id = summary?.id;
    idRef.current = id;
    if (!id) return;
    if (cache[id]) { setGame(cache[id]); return; }
    setLoading(true);
    (async () => {
      try {
        const res = await api.nhlGame(id);
        cache[id] = res.game;
        if (idRef.current === id) setGame(res.game);
      } catch {
        // keep previous content; depth simply won't enrich
      } finally {
        if (idRef.current === id) setLoading(false);
      }
    })();
  }, [summary?.id]);

  if (!summary) return null;

  const detail = game && game.id === summary.id ? game : null;
  const isFinal = FINAL.includes(summary.group === "final" ? "FINAL" : (detail?.status || summary.state || ""));
  const scoring = (detail?.scoring || []).slice(0, 4);
  const statRows: [string, string][] = [
    ["SOG", "sog"], ["PP", "powerPlay"], ["FO%", "faceoffWinningPctg"],
  ].filter(([, k]) => detail?.team_stats?.[k]) as [string, string][];
  const teamByAbbr = (abbr: string) => {
    if (!detail) return summary.away.abbr === abbr ? summary.away : summary.home;
    return detail.home.abbr === abbr ? detail.home : detail.away;
  };

  return (
    <View style={styles.wrap} testID="game-depth">
      <View style={styles.head}>
        <Text style={styles.kicker}>SELECTED GAME</Text>
        {loading && !detail ? <ActivityIndicator size="small" color={colors.blue} /> : null}
      </View>

      {/* mini scoreboard */}
      <View style={styles.board}>
        <View style={styles.side}>
          <NhlLogo abbr={summary.away.abbr} url={summary.away.logo} size={30} />
          <Text style={styles.abbr}>{summary.away.abbr}</Text>
        </View>
        <View style={styles.mid}>
          {isFinal ? (
            <Text style={styles.score}>{summary.away.score} – {summary.home.score}</Text>
          ) : (
            <Text style={styles.vs}>@</Text>
          )}
          <Text style={styles.status}>{isFinal ? "FINAL" : (detail?.start_utc || summary.start_utc ? "UPCOMING" : (summary.state || "").toUpperCase())}</Text>
        </View>
        <View style={styles.side}>
          <NhlLogo abbr={summary.home.abbr} url={summary.home.logo} size={30} />
          <Text style={styles.abbr}>{summary.home.abbr}</Text>
        </View>
      </View>

      {detail?.series?.round_label ? (
        <Text style={styles.series}>{detail.series.round_label}{detail.series.game_number ? ` · Game ${detail.series.game_number}` : ""}</Text>
      ) : null}

      {/* DEPTH */}
      {isFinal && scoring.length ? (
        <View style={styles.block}>
          <Text style={styles.blockLabel}>KEY MOMENTS</Text>
          {scoring.map((s: any, i: number) => {
            const t = teamByAbbr(s.team_abbr);
            return (
              <View key={i} style={styles.momentRow}>
                <Text style={styles.momentTime}>{periodName(s.period, s.period_type)} {s.time}</Text>
                <NhlLogo abbr={t.abbr} url={t.logo} size={18} />
                <Text style={styles.momentName} numberOfLines={1}>
                  {s.scorer}{s.empty_net ? " (EN)" : s.strength === "pp" ? " (PP)" : s.strength === "sh" ? " (SH)" : ""}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}

      {isFinal && statRows.length ? (
        <View style={styles.statsRow}>
          {statRows.map(([label, k]) => (
            <View key={k} style={styles.statCell}>
              <Text style={styles.statLabel}>{label}</Text>
              <Text style={styles.statVals}>{fmtStat(k, detail.team_stats[k].away)} · {fmtStat(k, detail.team_stats[k].home)}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {!isFinal ? (
        <Text style={styles.note}>
          {summary.away.record && summary.home.record ? `${summary.away.abbr} ${summary.away.record}  ·  ${summary.home.abbr} ${summary.home.record}\n` : ""}
          Full recap, box score and the Reggie &amp; Marc call unlock at puck drop.
        </Text>
      ) : null}

      {/* deliberate deeper action -> full canonical Game Page */}
      <Pressable
        style={styles.openBtn}
        testID="open-game"
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(`/game/${summary.id}`); }}
      >
        <Text style={styles.openText}>OPEN GAME</Text>
        <Ionicons name="arrow-forward" size={15} color={colors.white} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.sm },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  kicker: { color: colors.blue, fontFamily: fonts.accent, fontSize: 11, fontWeight: "700", letterSpacing: 2 },
  board: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  side: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flex: 1 },
  abbr: { color: colors.text, fontFamily: fonts.display, fontSize: 18, fontWeight: "800", letterSpacing: 0.3 },
  mid: { alignItems: "center", minWidth: 84 },
  score: { color: colors.white, fontFamily: fonts.display, fontSize: 24, fontWeight: "800", letterSpacing: 1 },
  vs: { color: colors.textFaint, fontFamily: fonts.display, fontSize: 18, fontWeight: "700" },
  status: { color: colors.textFaint, fontFamily: fonts.accent, fontSize: 9, fontWeight: "700", letterSpacing: 1, marginTop: 2 },
  series: { color: colors.textDim, fontFamily: fonts.display, fontSize: 12, fontWeight: "700", textAlign: "center" },

  block: { gap: 6, marginTop: 2 },
  blockLabel: { color: colors.textFaint, fontFamily: fonts.accent, fontSize: 10, fontWeight: "700", letterSpacing: 1.2 },
  momentRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  momentTime: { color: colors.textDim, fontFamily: fonts.display, fontSize: 12, fontWeight: "700", width: 62 },
  momentName: { color: colors.text, fontFamily: fonts.display, fontSize: 14, fontWeight: "700", flex: 1 },

  statsRow: { flexDirection: "row", gap: spacing.sm, marginTop: 2 },
  statCell: { flex: 1, backgroundColor: colors.surfaceHi, borderRadius: radius.sm, paddingVertical: 8, alignItems: "center", gap: 2 },
  statLabel: { color: colors.textFaint, fontFamily: fonts.accent, fontSize: 9, fontWeight: "700", letterSpacing: 1 },
  statVals: { color: colors.text, fontFamily: fonts.display, fontSize: 13, fontWeight: "700" },

  note: { color: colors.textDim, fontFamily: fonts.body, fontSize: 12, lineHeight: 18 },

  openBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.blue, borderRadius: radius.pill, paddingVertical: 12, marginTop: spacing.xs },
  openText: { color: colors.white, fontFamily: fonts.display, fontSize: 14, fontWeight: "800", letterSpacing: 1 },
});
