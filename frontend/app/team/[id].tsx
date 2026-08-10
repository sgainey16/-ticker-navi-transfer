import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";

import { colors, fonts, spacing, radius } from "@/src/theme";
import { api } from "@/src/lib/api";
import { useApi } from "@/src/lib/useApi";
import { Screen, Loader, ErrorState, SectionTitle } from "@/src/components/ui";
import { TeamLogo } from "@/src/components/TeamLogo";
import { ScoreRow } from "@/src/components/ScoreRow";

export default function TeamDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const q = useApi(() => api.team(id), [id]);

  if (q.loading) return <Screen><BackBar /><Loader /></Screen>;
  if (q.error || !q.data) return <Screen><BackBar /><ErrorState message="Failed to load team" onRetry={q.reload} /></Screen>;

  const { team, roster, recaps } = q.data;
  const teamLite = { abbr: team.abbr, short: team.short, primary: team.primary, secondary: team.secondary };

  const metrics = [
    { label: "RECORD", value: `${team.wins}-${team.losses}` },
    { label: "POINTS", value: `${team.points}`, accent: colors.green },
    { label: "GOALS FOR", value: `${team.gf}` },
    { label: "GOALS AGAINST", value: `${team.ga}` },
    { label: "GOAL DIFF", value: `${team.gd > 0 ? "+" : ""}${team.gd}`, accent: team.gd >= 0 ? colors.green : colors.red },
    { label: "STREAK", value: team.streak, accent: team.streak.startsWith("W") ? colors.green : colors.red },
  ];

  return (
    <Screen>
      <BackBar />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.banner}>
          <LinearGradient colors={[team.primary + "55", colors.bg]} style={StyleSheet.absoluteFill} />
          <TeamLogo abbr={team.abbr} primary={team.primary} secondary={team.secondary} size={72} />
          <Text style={styles.name}>{team.name}</Text>
          <Text style={styles.meta}>{team.conference} · Seed #{team.seed} · {team.arena}</Text>
          <Text style={styles.coach}>Head Coach · {team.coach}</Text>
        </View>

        <Text style={styles.blurb}>{team.blurb}</Text>

        <View style={styles.metricGrid}>
          {metrics.map((m) => (
            <View key={m.label} style={styles.metric}>
              <Text style={[styles.metricVal, m.accent && { color: m.accent }]}>{m.value}</Text>
              <Text style={styles.metricLabel}>{m.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <SectionTitle title="Roster" />
          {roster.map((p) => (
            <Pressable key={p.id} style={styles.playerRow} onPress={() => router.push(`/player/${p.id}`)} testID={`roster-${p.id}`}>
              <Text style={styles.num}>{p.number}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.playerName}>{p.name}</Text>
                <Text style={styles.pos}>{posName(p.position)}</Text>
              </View>
              {p.position === "GK" ? (
                <Stat value={`${p.save_pct?.toFixed(3)}`} unit="SV%" />
              ) : (
                <>
                  <Stat value={`${p.goals}`} unit="G" />
                  <Stat value={`${p.assists}`} unit="A" />
                </>
              )}
            </Pressable>
          ))}
        </View>

        <View style={styles.section}>
          <SectionTitle title="Recent Games" />
          <View style={{ gap: spacing.sm }}>
            {recaps.map((g) => (
              <ScoreRow
                key={g.id}
                home={g.home_id === team.id ? teamLite : undefined}
                away={g.away_id === team.id ? teamLite : undefined}
                homeScore={g.home_score}
                awayScore={g.away_score}
                date={g.date}
                onPress={() => router.push(`/game/${g.id}`)}
              />
            ))}
          </View>
        </View>
        <View style={{ height: spacing.xxxl }} />
      </ScrollView>
    </Screen>
  );
}

function Stat({ value, unit }: { value: string; unit: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statVal}>{value}</Text>
      <Text style={styles.statUnit}>{unit}</Text>
    </View>
  );
}

function posName(p: string) {
  return { GK: "Goalkeeper", D: "Defender", M: "Midfielder", F: "Forward" }[p] || p;
}

export function BackBar() {
  const router = useRouter();
  return (
    <View style={styles.backBar}>
      <Pressable testID="back-button" onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
        <Ionicons name="chevron-back" size={22} color={colors.text} />
        <Text style={styles.backText}>Back</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxxl },
  banner: { alignItems: "center", paddingVertical: spacing.xl, gap: 4, overflow: "hidden" },
  name: { color: colors.white, fontFamily: fonts.display, fontSize: 28, fontWeight: "800", letterSpacing: 0.5, marginTop: spacing.sm },
  meta: { color: colors.textDim, fontFamily: fonts.body, fontSize: 12 },
  coach: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 12 },
  blurb: { color: colors.textDim, fontFamily: fonts.body, fontSize: 14, lineHeight: 21, paddingHorizontal: spacing.lg, marginBottom: spacing.lg },

  metricGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: spacing.lg, gap: spacing.sm },
  metric: { width: "31.5%", backgroundColor: colors.surface, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, paddingVertical: spacing.md, alignItems: "center" },
  metricVal: { color: colors.text, fontFamily: fonts.display, fontSize: 22, fontWeight: "800" },
  metricLabel: { color: colors.textFaint, fontFamily: fonts.accent, fontSize: 9, fontWeight: "600", letterSpacing: 0.5, marginTop: 2 },

  section: { paddingHorizontal: spacing.lg, marginTop: spacing.xl, gap: spacing.sm },
  playerRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  num: { color: colors.textFaint, fontFamily: fonts.display, fontSize: 18, fontWeight: "800", width: 28, textAlign: "center" },
  playerName: { color: colors.text, fontFamily: fonts.display, fontSize: 16, fontWeight: "700", letterSpacing: 0.3 },
  pos: { color: colors.textDim, fontFamily: fonts.body, fontSize: 11 },
  stat: { alignItems: "center", width: 40 },
  statVal: { color: colors.text, fontFamily: fonts.display, fontSize: 17, fontWeight: "800" },
  statUnit: { color: colors.textFaint, fontFamily: fonts.accent, fontSize: 9, fontWeight: "600" },

  backBar: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  backBtn: { flexDirection: "row", alignItems: "center", paddingVertical: 6, paddingHorizontal: 8 },
  backText: { color: colors.text, fontFamily: fonts.body, fontSize: 15 },
});
