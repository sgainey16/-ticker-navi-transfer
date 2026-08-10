import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { colors, fonts, spacing, radius } from "@/src/theme";
import { api, LeaderEntry, Team } from "@/src/lib/api";
import { useApi } from "@/src/lib/useApi";
import { TabScreen, Loader, ErrorState, SectionTitle } from "@/src/components/ui";
import { TeamLogo } from "@/src/components/TeamLogo";

const STAT_TABS = [
  { key: "goals", label: "Goals" },
  { key: "assists", label: "Assists" },
  { key: "points", label: "Points" },
  { key: "saves", label: "Saves" },
];

const STATUS_COLOR: Record<string, string> = { Out: colors.red, Questionable: colors.gold, Available: colors.green };

export default function Stats() {
  const router = useRouter();
  const [stat, setStat] = useState("goals");
  const leaders = useApi(() => api.leaders());
  const teams = useApi(() => api.teams());
  const avail = useApi(() => api.availability());

  const teamMap = useMemo(() => {
    const m: Record<string, Team> = {};
    teams.data?.teams.forEach((t) => (m[t.id] = t));
    return m;
  }, [teams.data]);

  const loading = leaders.loading || teams.loading || avail.loading;
  const error = leaders.error || teams.error || avail.error;

  return (
    <TabScreen>
      <View style={styles.headerPad}>
        <Text style={styles.h1}>League Leaders</Text>
      </View>
      <View style={styles.chipRowWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {STAT_TABS.map((s) => {
            const active = s.key === stat;
            return (
              <Pressable key={s.key} testID={`stat-chip-${s.key}`} onPress={() => { Haptics.selectionAsync(); setStat(s.key); }} style={[styles.chip, active && styles.chipActive]}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{s.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <Loader />
      ) : error ? (
        <ErrorState message="Couldn't load stats" onRetry={() => { leaders.reload(); avail.reload(); }} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {(leaders.data![stat] || []).map((p: LeaderEntry, i: number) => (
            <Pressable key={p.id} style={styles.leaderRow} onPress={() => router.push(`/player/${p.id}`)} testID={`leader-${p.id}`}>
              <Text style={[styles.leaderRank, i === 0 && { color: colors.gold }]}>{i + 1}</Text>
              <TeamLogo abbr={teamMap[p.team_id]?.abbr || ""} primary={teamMap[p.team_id]?.primary || colors.green} secondary={teamMap[p.team_id]?.secondary} size={32} />
              <View style={{ flex: 1 }}>
                <Text style={styles.leaderName}>{p.name}</Text>
                <Text style={styles.leaderTeam}>{teamMap[p.team_id]?.short}</Text>
              </View>
              <Text style={[styles.leaderVal, i === 0 && { color: colors.gold }]}>{p.value}</Text>
            </Pressable>
          ))}

          <View style={styles.section}>
            <SectionTitle title="Availability Report" accent={colors.gold} />
            {avail.data!.report.map((a: any, i: number) => (
              <View key={i} style={styles.availRow}>
                <View style={[styles.statusDot, { backgroundColor: STATUS_COLOR[a.status] || colors.textDim }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.availPlayer}>{a.player} <Text style={styles.availTeam}>· {teamMap[a.team_id]?.abbr}</Text></Text>
                  <Text style={styles.availReason}>{a.reason} — {a.note}</Text>
                </View>
                <Text style={[styles.availStatus, { color: STATUS_COLOR[a.status] || colors.textDim }]}>{a.status.toUpperCase()}</Text>
              </View>
            ))}
          </View>
          <View style={{ height: spacing.xxl }} />
        </ScrollView>
      )}
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  headerPad: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  h1: { color: colors.white, fontFamily: fonts.display, fontSize: 30, fontWeight: "800" },
  chipRowWrap: { height: 56, justifyContent: "center" },
  chipRow: { paddingHorizontal: spacing.lg, gap: spacing.sm, alignItems: "center" },
  chip: { height: 36, flexShrink: 0, paddingHorizontal: spacing.lg, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  chipActive: { backgroundColor: colors.greenDim, borderColor: colors.green },
  chipText: { color: colors.textDim, fontFamily: fonts.display, fontSize: 14, fontWeight: "700", letterSpacing: 0.5 },
  chipTextActive: { color: colors.green },

  content: { paddingHorizontal: spacing.lg, paddingBottom: 110, gap: spacing.sm },
  leaderRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  leaderRank: { color: colors.textDim, fontFamily: fonts.display, fontSize: 18, fontWeight: "800", width: 22, textAlign: "center" },
  leaderName: { color: colors.text, fontFamily: fonts.display, fontSize: 17, fontWeight: "700", letterSpacing: 0.3 },
  leaderTeam: { color: colors.textDim, fontFamily: fonts.body, fontSize: 12 },
  leaderVal: { color: colors.green, fontFamily: fonts.display, fontSize: 24, fontWeight: "800" },

  section: { gap: spacing.sm, marginTop: spacing.xl },
  availRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  availPlayer: { color: colors.text, fontFamily: fonts.display, fontSize: 15, fontWeight: "700" },
  availTeam: { color: colors.textDim, fontFamily: fonts.body, fontSize: 12 },
  availReason: { color: colors.textDim, fontFamily: fonts.body, fontSize: 12 },
  availStatus: { fontFamily: fonts.display, fontSize: 12, fontWeight: "800", letterSpacing: 0.5 },
});
