import React, { useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";

import { colors, fonts, spacing, radius } from "@/src/theme";
import { api } from "@/src/lib/api";
import { useApi } from "@/src/lib/useApi";
import { Screen, Loader, ErrorState } from "@/src/components/ui";
import { BackBar } from "@/app/team/[id]";
import { playDataUri, stopAudio } from "@/src/lib/audio";

const HOSTS: Record<string, { name: string; role: string; accent: string }> = {
  reggie: { name: "Reggie Banks", role: "THE INSTIGATOR", accent: colors.green },
  marc: { name: "Marc Collins", role: "THE GUARDIAN", accent: colors.blue },
};

export default function Recap() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const gameId = id || "latest";
  const q = useApi(() => api.recap(gameId), [gameId]);

  const [playing, setPlaying] = useState(false);
  const [idx, setIdx] = useState(-1);
  const cancelRef = useRef(false);

  const stop = () => {
    cancelRef.current = true;
    stopAudio();
    setPlaying(false);
    setIdx(-1);
  };

  const play = async () => {
    if (!q.data) return;
    const { beats, voices } = q.data;
    cancelRef.current = false;
    setPlaying(true);
    for (let i = 0; i < beats.length; i++) {
      if (cancelRef.current) break;
      setIdx(i);
      const b = beats[i];
      const vid = b.host === "reggie" ? voices.reggie : voices.marc;
      if (!vid) continue; // graceful: no voice -> keep text, skip audio
      try {
        const res = await api.tts(b.text, vid, b.host === "marc" ? 1.06 : 1.0);
        if (cancelRef.current) break;
        await playDataUri(res.audio);
      } catch {
        // audio failure must never break the experience — text stays on screen
      }
    }
    if (!cancelRef.current) { setPlaying(false); setIdx(-1); }
  };

  if (q.loading) return <Screen><BackBar /><Loader label="Pulling the real game + writing the recap…" /></Screen>;
  if (q.error || !q.data) return <Screen><BackBar /><ErrorState message="Couldn't load the recap" onRetry={q.reload} /></Screen>;

  const g = q.data.game;
  const series = g.series;
  const winnerAbbr = (g.home.score || 0) > (g.away.score || 0) ? g.home.abbr : g.away.abbr;

  return (
    <Screen>
      <BackBar />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* CONTEXT */}
        {series?.round_label ? (
          <View style={styles.kickerRow}>
            <Ionicons name="trophy" size={13} color={colors.gold} />
            <Text style={styles.kicker}>{series.round_label}{series.game_number ? ` · GAME ${series.game_number}` : ""}</Text>
          </View>
        ) : null}

        {/* SCOREBOARD */}
        <View style={styles.board}>
          <TeamCol abbr={g.away.abbr} name={g.away.name} score={g.away.score} win={winnerAbbr === g.away.abbr} />
          <View style={styles.mid}>
            <Text style={styles.final}>{(g.status || "FINAL").toUpperCase()}</Text>
            <Text style={styles.dash}>—</Text>
            <Text style={styles.meta}>{fmtDate(g.date)}</Text>
          </View>
          <TeamCol abbr={g.home.abbr} name={g.home.name} score={g.home.score} win={winnerAbbr === g.home.abbr} />
        </View>
        {series?.clinched_by ? (
          <View style={styles.clinch}><Text style={styles.clinchText}>{series.clinched_by} WIN THE SERIES {seriesLine(series, g)}</Text></View>
        ) : null}
        {g.venue ? <Text style={styles.venue}>{g.venue}</Text> : null}

        {/* HOST HEADER */}
        <View style={styles.callRow}>
          <Text style={styles.callTitle}>THE CALL</Text>
          <Text style={styles.callSub}>Reggie Banks & Marc Collins</Text>
        </View>

        {/* BEATS */}
        <View style={{ gap: spacing.sm }}>
          {q.data.beats.map((b, i) => {
            const h = HOSTS[b.host] || HOSTS.marc;
            const active = i === idx;
            return (
              <View key={i} style={[styles.beat, { borderLeftColor: h.accent }, active && { backgroundColor: "rgba(255,255,255,0.05)", borderColor: h.accent + "66" }]} testID={`recap-beat-${i}`}>
                <View style={styles.beatHead}>
                  <Text style={[styles.beatName, { color: h.accent }]}>{h.name}</Text>
                  {active && playing ? (
                    <View style={styles.speaking}><View style={[styles.dot, { backgroundColor: h.accent }]} /><Text style={[styles.speakingText, { color: h.accent }]}>ON AIR</Text></View>
                  ) : (
                    <Text style={styles.beatRole}>{h.role}</Text>
                  )}
                </View>
                <Text style={styles.beatText}>{b.text}</Text>
              </View>
            );
          })}
        </View>

        <Text style={styles.grounded}>Grounded in real NHL game data · voices by Reggie & Marc</Text>
        <View style={{ height: 96 }} />
      </ScrollView>

      {/* PLAY BAR */}
      <View style={styles.playBar}>
        <Pressable style={[styles.playBtn, playing && styles.playBtnStop]} onPress={playing ? stop : play} testID="recap-play">
          {playing ? <Ionicons name="stop" size={20} color={colors.white} /> : <Ionicons name="play" size={20} color={colors.bg} />}
          <Text style={[styles.playText, playing && { color: colors.white }]}>{playing ? "STOP" : "PLAY THE RECAP"}</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

function TeamCol({ abbr, name, score, win }: { abbr: string; name: string; score: number; win: boolean }) {
  return (
    <View style={styles.teamCol}>
      <View style={[styles.crest, win && { borderColor: colors.green }]}><Text style={styles.crestText}>{abbr}</Text></View>
      <Text style={styles.teamName} numberOfLines={1}>{name}</Text>
      <Text style={[styles.score, { color: win ? colors.green : colors.text }]}>{score}</Text>
    </View>
  );
}

function seriesLine(s: any, g: any) {
  if (s.away_wins == null || s.home_wins == null) return "";
  const hi = Math.max(s.away_wins, s.home_wins), lo = Math.min(s.away_wins, s.home_wins);
  return `${hi}-${lo}`;
}
function fmtDate(d: string) {
  try { return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
  catch { return d; }
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  kickerRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.sm },
  kicker: { color: colors.gold, fontFamily: fonts.accent, fontSize: 12, fontWeight: "700", letterSpacing: 1.5 },

  board: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: spacing.md },
  teamCol: { alignItems: "center", gap: 6, flex: 1 },
  crest: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  crestText: { color: colors.white, fontFamily: fonts.display, fontSize: 15, fontWeight: "800", letterSpacing: 0.5 },
  teamName: { color: colors.textDim, fontFamily: fonts.body, fontSize: 12 },
  score: { fontFamily: fonts.display, fontSize: 46, fontWeight: "800", lineHeight: 48 },
  mid: { alignItems: "center", gap: 2, paddingHorizontal: spacing.sm },
  final: { color: colors.red, fontFamily: fonts.accent, fontSize: 11, fontWeight: "700", letterSpacing: 1.5 },
  dash: { color: colors.textFaint, fontFamily: fonts.display, fontSize: 18, fontWeight: "700" },
  meta: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 11 },
  clinch: { alignSelf: "center", backgroundColor: colors.gold, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 5, marginTop: 4 },
  clinchText: { color: colors.bg, fontFamily: fonts.display, fontSize: 12, fontWeight: "800", letterSpacing: 1 },
  venue: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 11, textAlign: "center", marginTop: 6 },

  callRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: spacing.xl, marginBottom: spacing.sm },
  callTitle: { color: colors.white, fontFamily: fonts.display, fontSize: 22, fontWeight: "800", letterSpacing: 0.5 },
  callSub: { color: colors.textDim, fontFamily: fonts.body, fontSize: 12 },

  beat: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, borderLeftWidth: 3, padding: spacing.md },
  beatHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  beatName: { fontFamily: fonts.display, fontSize: 15, fontWeight: "800", letterSpacing: 0.3 },
  beatRole: { color: colors.textFaint, fontFamily: fonts.accent, fontSize: 9, fontWeight: "700", letterSpacing: 1 },
  speaking: { flexDirection: "row", alignItems: "center", gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  speakingText: { fontFamily: fonts.display, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  beatText: { color: colors.text, fontFamily: fonts.body, fontSize: 14, lineHeight: 21 },

  grounded: { color: colors.textFaint, fontFamily: fonts.accent, fontSize: 10, fontWeight: "600", letterSpacing: 1, textAlign: "center", marginTop: spacing.lg },

  playBar: { position: "absolute", left: 0, right: 0, bottom: 0, padding: spacing.lg, backgroundColor: "rgba(5,7,12,0.9)" },
  playBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.green, borderRadius: radius.pill, paddingVertical: 15 },
  playBtnStop: { backgroundColor: colors.red },
  playText: { color: colors.bg, fontFamily: fonts.display, fontSize: 15, fontWeight: "800", letterSpacing: 1 },
});
