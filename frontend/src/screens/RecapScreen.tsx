import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { colors, fonts, spacing, radius } from "@/src/theme";
import { api, Game, Team } from "@/src/lib/api";
import { useApi } from "@/src/lib/useApi";
import { TabScreen, Loader, ErrorState, SectionTitle } from "@/src/components/ui";
import { useBroadcast } from "@/src/lib/broadcast";
import { TeamLogo } from "@/src/components/TeamLogo";

const HERO = require("../../assets/images/broadcast-desk.png");

export default function Recap() {
  const router = useRouter();
  const broadcast = useBroadcast();
  const games = useApi(() => api.games());
  const teams = useApi(() => api.teams());

  const teamMap = useMemo(() => {
    const m: Record<string, Team> = {};
    teams.data?.teams.forEach((t) => (m[t.id] = t));
    return m;
  }, [teams.data]);

  const highlights = useMemo(() => {
    const list: { game: string; team: string; player: string; note: string; q: number; time: string }[] = [];
    games.data?.games.forEach((g) => g.timeline.forEach((e) => list.push({ game: g.id, ...e })));
    return list;
  }, [games.data]);

  const loading = games.loading || teams.loading;
  const error = games.error || teams.error;

  return (
    <TabScreen>
      {loading ? (
        <Loader label="Cueing the highlights…" />
      ) : error ? (
        <ErrorState message="Couldn't load recaps" onRetry={() => { games.reload(); teams.reload(); }} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.titleRow}>
            <Text style={styles.h1}>Highlights of the Night</Text>
            <Text style={styles.count}>{games.data!.games.length} GAMES</Text>
          </View>

          {/* ON AIR HERO */}
          <Pressable style={styles.hero} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); broadcast.start("recap"); }} testID="run-the-tape">
            <Image source={HERO} style={StyleSheet.absoluteFill} contentFit="cover" />
            <LinearGradient colors={["rgba(5,7,12,0.1)", "rgba(5,7,12,0.85)"]} style={StyleSheet.absoluteFill} />
            <View style={styles.onAir}>
              <View style={styles.onAirDot} />
              <Text style={styles.onAirText}>ON AIR</Text>
              <Text style={styles.tapTape}>TAP TO RUN THE TAPE</Text>
            </View>
          </Pressable>

          {/* GAME CARDS SCROLLER */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
            {games.data!.games.map((g: Game, i) => {
              const home = teamMap[g.home_id];
              const away = teamMap[g.away_id];
              return (
                <Pressable key={g.id} style={styles.gameCard} onPress={() => router.push(`/highlights/${g.id}`)} testID={`recap-game-${g.id}`}>
                  <View style={styles.gcTop}>
                    <TeamLogo abbr={away?.abbr || ""} primary={away?.primary || colors.green} secondary={away?.secondary} size={36} />
                    <Text style={styles.gcAt}>@</Text>
                    <TeamLogo abbr={home?.abbr || ""} primary={home?.primary || colors.green} secondary={home?.secondary} size={36} />
                  </View>
                  <Text style={styles.gcScore}>{g.away_score} - {g.home_score}</Text>
                  <Text style={styles.gcLabel} numberOfLines={1}>{g.label || `GAME ${i + 1}`}</Text>
                  <View style={styles.gcThumb}>
                    {g.video_id ? (
                      <Image source={{ uri: `https://i.ytimg.com/vi/${g.video_id}/hqdefault.jpg` }} style={StyleSheet.absoluteFill} contentFit="cover" />
                    ) : (
                      <LinearGradient colors={[(away?.primary || "#222") + "44", (home?.primary || "#222") + "44"]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
                    )}
                    <View style={styles.gcThumbShade} />
                    <View style={styles.playCircle}><Ionicons name="play" size={16} color={colors.white} /></View>
                    <Text style={styles.gcThumbText}>HIGHLIGHTS</Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* INDIVIDUAL HIGHLIGHTS */}
          <View style={styles.section}>
            <SectionTitle title="Individual Highlights" action={<Text style={styles.goals}>{highlights.length} GOALS</Text>} />
            <View style={{ gap: spacing.sm }}>
              {highlights.map((h, i) => {
                const t = teamMap[h.team];
                return (
                  <Pressable key={i} style={styles.hlRow} onPress={() => router.push(`/highlights/${h.game}`)} testID={`highlight-${i}`}>
                    <View style={styles.hlThumb}>
                      <TeamLogo abbr={t?.abbr || ""} primary={t?.primary || colors.green} secondary={t?.secondary} size={30} />
                      <View style={styles.hlPlay}><Ionicons name="play" size={10} color={colors.white} /></View>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.hlName}>{h.player}</Text>
                      <Text style={styles.hlNote}>{h.note}</Text>
                    </View>
                    <Text style={styles.hlTime}>Q{h.q} · {h.time}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </ScrollView>
      )}
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: 110, gap: spacing.lg },
  titleRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  h1: { color: colors.white, fontFamily: fonts.display, fontSize: 30, fontWeight: "800", letterSpacing: 0.3, flex: 1 },
  count: { color: colors.textDim, fontFamily: fonts.display, fontSize: 16, fontWeight: "700", letterSpacing: 1.5 },

  hero: { height: 200, borderRadius: radius.lg, overflow: "hidden", borderWidth: 1, borderColor: colors.border, justifyContent: "flex-end", alignItems: "center", paddingBottom: spacing.lg },
  onAir: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(5,7,12,0.7)", borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: 10, borderWidth: 1, borderColor: colors.borderStrong },
  onAirDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.red },
  onAirText: { color: colors.red, fontFamily: fonts.display, fontSize: 13, fontWeight: "800", letterSpacing: 1 },
  tapTape: { color: colors.white, fontFamily: fonts.display, fontSize: 15, fontWeight: "800", letterSpacing: 0.5 },

  hScroll: { gap: spacing.md, paddingRight: spacing.lg },
  gameCard: { width: 170, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: 4 },
  gcTop: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.md },
  gcAt: { color: colors.textFaint, fontFamily: fonts.display, fontSize: 14, fontWeight: "700" },
  gcScore: { color: colors.white, fontFamily: fonts.display, fontSize: 22, fontWeight: "800", textAlign: "center" },
  gcLabel: { color: colors.textFaint, fontFamily: fonts.accent, fontSize: 10, fontWeight: "600", letterSpacing: 1, textAlign: "center" },
  gcThumb: { height: 70, borderRadius: radius.sm, overflow: "hidden", marginTop: 6, alignItems: "center", justifyContent: "center" },
  gcThumbShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(5,7,12,0.35)" },
  playCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.red, alignItems: "center", justifyContent: "center" },
  gcThumbText: { position: "absolute", bottom: 6, left: 8, color: colors.white, fontFamily: fonts.display, fontSize: 11, fontWeight: "800", letterSpacing: 1 },

  section: { gap: spacing.sm },
  goals: { color: colors.blue, fontFamily: fonts.display, fontSize: 14, fontWeight: "700", letterSpacing: 1 },
  hlRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.sm },
  hlThumb: { width: 56, height: 56, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt, alignItems: "center", justifyContent: "center" },
  hlPlay: { position: "absolute", bottom: 4, right: 4, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.red, alignItems: "center", justifyContent: "center" },
  hlName: { color: colors.text, fontFamily: fonts.display, fontSize: 16, fontWeight: "700" },
  hlNote: { color: colors.textDim, fontFamily: fonts.body, fontSize: 12, fontStyle: "italic" },
  hlTime: { color: colors.textFaint, fontFamily: fonts.display, fontSize: 13, fontWeight: "700" },
});
