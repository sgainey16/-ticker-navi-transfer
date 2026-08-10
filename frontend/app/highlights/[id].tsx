import React from "react";
import { View, Text, StyleSheet, ScrollView, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";

import { colors, fonts, spacing, radius, hostStyle } from "@/src/theme";
import { api } from "@/src/lib/api";
import { useApi } from "@/src/lib/useApi";
import { Screen, Loader, ErrorState } from "@/src/components/ui";
import { TeamLogo } from "@/src/components/TeamLogo";
import { YTPlayer } from "@/src/components/YTPlayer";
import { BackBar } from "@/app/team/[id]";

export default function Highlights() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const q = useApi(() => api.game(id), [id]);

  if (q.loading) return <Screen><BackBar /><Loader label="Cueing the highlights…" /></Screen>;
  if (q.error || !q.data) return <Screen><BackBar /><ErrorState message="Failed to load highlights" onRetry={q.reload} /></Screen>;

  const { game, home, away } = q.data;
  const vid = game.video_id;
  const playerH = Math.round((Math.min(width, 640) - 32) * 9 / 16);

  return (
    <Screen>
      <BackBar />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {game.label ? (
          <View style={styles.kickerRow}>
            <View style={styles.liveDot} />
            <Text style={styles.kicker}>{game.label}</Text>
          </View>
        ) : null}

        {/* PLAYER */}
        {vid ? (
          <View style={styles.ytWrap} testID="highlights-player">
            <YTPlayer videoId={vid} height={playerH} />
          </View>
        ) : (
          <View style={styles.player} testID="highlights-player">
            <View style={styles.noVideo}>
              <Ionicons name="videocam-off" size={28} color={colors.textDim} />
              <Text style={styles.noVideoText}>Highlights coming soon</Text>
            </View>
          </View>
        )}
        <Text style={styles.credit}>Official highlights via MASLtv</Text>

        {/* SCORE HEADER */}
        <View style={styles.board}>
          <TeamCol team={away} score={game.away_score} win={game.away_score > game.home_score} />
          <View style={styles.center}>
            <Text style={styles.final}>{game.status?.toUpperCase() || "FINAL"}</Text>
            <Text style={styles.vs}>—</Text>
            <Text style={styles.date}>{fmt(game.date)}</Text>
          </View>
          <TeamCol team={home} score={game.home_score} win={game.home_score > game.away_score} />
        </View>

        {/* BOOTH TAKE */}
        <View style={styles.section}>
          <Text style={styles.secTitle}>FROM THE BOOTH</Text>
          <HostQuote host="rayo" name={'Mateo "Rayo" Reyes'} text={game.commentary.rayo} />
          <HostQuote host="casey" name="Casey Whitfield" text={game.commentary.casey} />
        </View>
        <View style={{ height: spacing.xxxl }} />
      </ScrollView>
    </Screen>
  );
}

function TeamCol({ team, score, win }: { team: any; score: number; win: boolean }) {
  return (
    <View style={styles.teamCol}>
      <TeamLogo abbr={team.abbr} primary={team.primary} secondary={team.secondary} size={44} />
      <Text style={styles.teamColName}>{team.short}</Text>
      <Text style={[styles.bigScore, { color: win ? colors.green : colors.text }]}>{score}</Text>
    </View>
  );
}

function HostQuote({ host, name, text }: { host: "rayo" | "casey"; name: string; text: string }) {
  const s = hostStyle[host];
  return (
    <View style={[styles.quote, { borderLeftColor: s.accent }]}>
      <Text style={[styles.quoteName, { color: s.accent }]}>{name}</Text>
      <Text style={styles.quoteText}>{text}</Text>
    </View>
  );
}

function fmt(d: string) {
  try { return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
  catch { return d; }
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  kickerRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: spacing.sm },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.red },
  kicker: { color: colors.green, fontFamily: fonts.accent, fontSize: 12, fontWeight: "700", letterSpacing: 1.5 },

  player: { width: "100%", aspectRatio: 16 / 9, borderRadius: radius.md, overflow: "hidden", backgroundColor: "#000", borderWidth: 1, borderColor: colors.border },
  ytWrap: { width: "100%", borderRadius: radius.md, overflow: "hidden", backgroundColor: "#000", borderWidth: 1, borderColor: colors.border },
  noVideo: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  noVideoText: { color: colors.textDim, fontFamily: fonts.display, fontSize: 15, fontWeight: "700" },
  credit: { color: colors.textFaint, fontFamily: fonts.accent, fontSize: 10, fontWeight: "600", letterSpacing: 1, marginTop: 6, textAlign: "center" },

  board: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: spacing.lg, marginTop: spacing.sm },
  teamCol: { alignItems: "center", gap: 4, flex: 1 },
  teamColName: { color: colors.textDim, fontFamily: fonts.display, fontSize: 13, fontWeight: "700", letterSpacing: 0.5 },
  bigScore: { fontFamily: fonts.display, fontSize: 48, fontWeight: "800", lineHeight: 50 },
  center: { alignItems: "center", gap: 2 },
  final: { color: colors.red, fontFamily: fonts.accent, fontSize: 11, fontWeight: "700", letterSpacing: 1.5 },
  vs: { color: colors.textFaint, fontFamily: fonts.display, fontSize: 18, fontWeight: "700" },
  date: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 11 },

  section: { marginTop: spacing.md, gap: spacing.sm },
  secTitle: { color: colors.textDim, fontFamily: fonts.accent, fontSize: 12, fontWeight: "700", letterSpacing: 1.5, marginBottom: 2 },
  quote: { backgroundColor: colors.surface, borderRadius: radius.md, borderLeftWidth: 3, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm },
  quoteName: { fontFamily: fonts.display, fontSize: 14, fontWeight: "800", letterSpacing: 0.3, marginBottom: 4 },
  quoteText: { color: colors.text, fontFamily: fonts.body, fontSize: 14, lineHeight: 21 },
});
