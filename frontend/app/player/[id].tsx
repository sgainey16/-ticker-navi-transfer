import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";

import { colors, fonts, spacing, radius } from "@/src/theme";
import { api } from "@/src/lib/api";
import { useApi } from "@/src/lib/useApi";
import { Screen, Loader, ErrorState } from "@/src/components/ui";
import { TeamLogo } from "@/src/components/TeamLogo";
import { BackBar } from "@/app/team/[id]";

export default function PlayerDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const q = useApi(() => api.player(id), [id]);

  if (q.loading) return <Screen><BackBar /><Loader /></Screen>;
  if (q.error || !q.data) return <Screen><BackBar /><ErrorState message="Failed to load player" onRetry={q.reload} /></Screen>;

  const { player, team } = q.data;
  const isGK = player.position === "GK";

  const stats = isGK
    ? [
        { label: "SAVES", value: `${player.saves}` },
        { label: "SAVE %", value: `${player.save_pct?.toFixed(3)}`, accent: colors.green },
        { label: "GAA", value: `${player.gaa?.toFixed(2)}` },
        { label: "GAMES", value: `${player.games}` },
      ]
    : [
        { label: "GOALS", value: `${player.goals}`, accent: colors.green },
        { label: "ASSISTS", value: `${player.assists}` },
        { label: "POINTS", value: `${player.points}` },
        { label: "GAMES", value: `${player.games}` },
      ];

  return (
    <Screen>
      <BackBar />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.banner}>
          <LinearGradient colors={[team.primary + "55", colors.bg]} style={StyleSheet.absoluteFill} />
          <Text style={styles.number}>#{player.number}</Text>
          <Text style={styles.name}>{player.name}</Text>
          <Pressable style={styles.teamPill} onPress={() => router.push(`/team/${team.id}`)}>
            <TeamLogo abbr={team.abbr} primary={team.primary} secondary={team.secondary} size={22} />
            <Text style={styles.teamName}>{team.name}</Text>
            <Text style={styles.pos}>· {posName(player.position)}</Text>
          </Pressable>
        </View>

        <View style={styles.statGrid}>
          {stats.map((s) => (
            <View key={s.label} style={styles.stat}>
              <Text style={[styles.statVal, s.accent && { color: s.accent }]}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.scoutBox}>
          <View style={styles.scoutHead}>
            <Ionicons name="analytics-outline" size={16} color={colors.blue} />
            <Text style={styles.scoutTitle}>SCOUTING REPORT</Text>
          </View>
          <Text style={styles.blurb}>{player.blurb}</Text>
        </View>

        <Pressable style={styles.askBtn} onPress={() => router.push("/talk")} testID="ask-booth">
          <Ionicons name="chatbubbles" size={16} color={colors.bg} />
          <Text style={styles.askText}>ASK THE BOOTH</Text>
        </Pressable>
        <View style={{ height: spacing.xxxl }} />
      </ScrollView>
    </Screen>
  );
}

function posName(p: string) {
  return { GK: "Goalkeeper", D: "Defender", M: "Midfielder", F: "Forward" }[p] || p;
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxxl },
  banner: { alignItems: "center", paddingVertical: spacing.xl, gap: 4, overflow: "hidden" },
  number: { color: colors.textFaint, fontFamily: fonts.display, fontSize: 40, fontWeight: "800" },
  name: { color: colors.white, fontFamily: fonts.display, fontSize: 30, fontWeight: "800", letterSpacing: 0.5, textAlign: "center", paddingHorizontal: spacing.lg },
  teamPill: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: spacing.sm },
  teamName: { color: colors.text, fontFamily: fonts.display, fontSize: 14, fontWeight: "700" },
  pos: { color: colors.textDim, fontFamily: fonts.body, fontSize: 13 },

  statGrid: { flexDirection: "row", paddingHorizontal: spacing.lg, gap: spacing.sm },
  stat: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, paddingVertical: spacing.md, alignItems: "center" },
  statVal: { color: colors.text, fontFamily: fonts.display, fontSize: 24, fontWeight: "800" },
  statLabel: { color: colors.textFaint, fontFamily: fonts.accent, fontSize: 9, fontWeight: "600", letterSpacing: 0.5, marginTop: 2 },

  scoutBox: { margin: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.lg },
  scoutHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.sm },
  scoutTitle: { color: colors.blue, fontFamily: fonts.accent, fontSize: 11, fontWeight: "600", letterSpacing: 1 },
  blurb: { color: colors.textDim, fontFamily: fonts.body, fontSize: 14, lineHeight: 21 },

  askBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginHorizontal: spacing.lg, backgroundColor: colors.green, borderRadius: radius.pill, paddingVertical: spacing.md },
  askText: { color: colors.bg, fontFamily: fonts.display, fontSize: 15, fontWeight: "800", letterSpacing: 0.8 },
});
