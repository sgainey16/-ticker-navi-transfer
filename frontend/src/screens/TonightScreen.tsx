import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { colors, fonts, spacing, radius } from "@/src/theme";
import { api, Team } from "@/src/lib/api";
import { useApi } from "@/src/lib/useApi";
import { TabScreen, Loader, ErrorState, SectionTitle } from "@/src/components/ui";
import { TeamLogo } from "@/src/components/TeamLogo";

const HERO = require("../../assets/images/broadcast-desk.png");

const STORYLINES = [
  { icon: "flame", color: "#F5B301", title: "The 52-Goal Chase", body: "Rian Marques is rewriting the San Diego record book — the league's most feared target forward." },
  { icon: "trending-down", color: "#FA2A2A", title: "Utica's 11-Game Skid", body: "A brutal stretch, capped by the wrong end of a 17-2 night in Milwaukee. Can they steady the ship?" },
  { icon: "trophy", color: "#64F705", title: "The Ron Newman Cup Race", body: "San Diego and Baltimore hold the top seeds, but the Western bracket is a knife fight." },
];

export default function Tonight() {
  const router = useRouter();
  const home = useApi(() => api.home());
  const games = useApi(() => api.games());
  const teams = useApi(() => api.teams());

  const teamMap = useMemo(() => {
    const m: Record<string, Team> = {};
    teams.data?.teams.forEach((t) => (m[t.id] = t));
    return m;
  }, [teams.data]);

  const loading = home.loading || games.loading || teams.loading;
  const error = home.error || games.error || teams.error;

  const featured = games.data?.games.find((g) => g.id === home.data?.featured_game) || games.data?.games[0];

  return (
    <TabScreen>
      {loading ? (
        <Loader />
      ) : error ? (
        <ErrorState message="Couldn't load the slate" onRetry={() => { home.reload(); games.reload(); teams.reload(); }} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.liveRow}>
            <View style={styles.liveDot} />
            <Text style={styles.liveLabel}>LIVE</Text>
            <Text style={styles.h1}>TONIGHT'S GAMES</Text>
          </View>

          <Pressable style={styles.hero} onPress={() => router.push("/coldopen")}>
            <Image source={HERO} style={StyleSheet.absoluteFill} contentFit="cover" />
            <LinearGradient colors={["rgba(5,7,12,0.15)", "rgba(5,7,12,0.9)"]} style={StyleSheet.absoluteFill} />
            <Text style={styles.heroTag}>THE TICKER · COLD OPEN</Text>
          </Pressable>

          {/* FEATURED MATCHUP */}
          {featured ? (
            <Pressable style={styles.matchup} onPress={() => router.push(`/game/${featured.id}`)} testID="tonight-featured">
              <TeamCol team={teamMap[featured.away_id]} />
              <View style={styles.matchMid}>
                <Text style={styles.matchTag}>FEATURED</Text>
                <Text style={styles.matchAt}>@</Text>
                <Text style={styles.matchScore}>{featured.away_score}-{featured.home_score}</Text>
                <View style={styles.roomRow}>
                  <Text style={styles.roomText}>Tap for the room</Text>
                  <Ionicons name="arrow-forward" size={13} color={colors.gold} />
                </View>
              </View>
              <TeamCol team={teamMap[featured.home_id]} />
            </Pressable>
          ) : null}

          {/* GAMES SCROLLER */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
            {games.data!.games.map((g) => {
              const home2 = teamMap[g.home_id];
              const away = teamMap[g.away_id];
              return (
                <Pressable key={g.id} style={styles.miniCard} onPress={() => router.push(`/game/${g.id}`)}>
                  <View style={styles.miniTop}>
                    <TeamLogo abbr={away?.abbr || ""} primary={away?.primary || colors.green} secondary={away?.secondary} size={30} />
                    <Text style={styles.miniAt}>@</Text>
                    <TeamLogo abbr={home2?.abbr || ""} primary={home2?.primary || colors.green} secondary={home2?.secondary} size={30} />
                  </View>
                  <Text style={styles.miniScore}>{g.away_score} - {g.home_score}</Text>
                  <Text style={styles.miniOpen}>TAP TO OPEN</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* STORYLINES */}
          <View style={styles.section}>
            <SectionTitle title="Storylines" />
            {STORYLINES.map((s) => (
              <View key={s.title} style={styles.story}>
                <View style={[styles.storyIcon, { backgroundColor: s.color + "22" }]}>
                  <Ionicons name={s.icon as any} size={18} color={s.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.storyTitle}>{s.title}</Text>
                  <Text style={styles.storyBody}>{s.body}</Text>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </TabScreen>
  );
}

function TeamCol({ team }: { team?: Team }) {
  if (!team) return null;
  return (
    <View style={styles.teamCol}>
      <TeamLogo abbr={team.abbr} primary={team.primary} secondary={team.secondary} size={54} />
      <Text style={styles.teamAbbr}>{team.abbr}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: 110, gap: spacing.lg },
  liveRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  liveDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.red },
  liveLabel: { color: colors.red, fontFamily: fonts.display, fontSize: 15, fontWeight: "800", letterSpacing: 1 },
  h1: { color: colors.white, fontFamily: fonts.display, fontSize: 22, fontWeight: "800", letterSpacing: 0.5 },

  hero: { height: 150, borderRadius: radius.lg, overflow: "hidden", borderWidth: 1, borderColor: colors.border, justifyContent: "flex-end", alignItems: "center", paddingBottom: spacing.md },
  heroTag: { color: colors.white, fontFamily: fonts.display, fontSize: 16, fontWeight: "800", letterSpacing: 1.5 },

  matchup: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg },
  teamCol: { alignItems: "center", gap: 6, width: 80 },
  teamAbbr: { color: colors.text, fontFamily: fonts.display, fontSize: 18, fontWeight: "800" },
  matchMid: { alignItems: "center", gap: 2 },
  matchTag: { color: colors.gold, fontFamily: fonts.accent, fontSize: 11, fontWeight: "700", letterSpacing: 1.5 },
  matchAt: { color: colors.textFaint, fontFamily: fonts.display, fontSize: 22, fontWeight: "700" },
  matchScore: { color: colors.white, fontFamily: fonts.display, fontSize: 18, fontWeight: "800" },
  roomRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  roomText: { color: colors.gold, fontFamily: fonts.display, fontSize: 12, fontWeight: "700", letterSpacing: 0.5 },

  hScroll: { gap: spacing.md, paddingRight: spacing.lg },
  miniCard: { width: 150, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, alignItems: "center", gap: 4 },
  miniTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  miniAt: { color: colors.textFaint, fontFamily: fonts.display, fontSize: 13, fontWeight: "700" },
  miniScore: { color: colors.white, fontFamily: fonts.display, fontSize: 20, fontWeight: "800" },
  miniOpen: { color: colors.textFaint, fontFamily: fonts.accent, fontSize: 10, fontWeight: "600", letterSpacing: 1 },

  section: { gap: spacing.sm },
  story: { flexDirection: "row", gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, alignItems: "flex-start" },
  storyIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  storyTitle: { color: colors.text, fontFamily: fonts.display, fontSize: 17, fontWeight: "700", letterSpacing: 0.3 },
  storyBody: { color: colors.textDim, fontFamily: fonts.body, fontSize: 13, lineHeight: 20, marginTop: 2 },
});
