import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";

import { colors, fonts, spacing, radius } from "@/src/theme";
import { api } from "@/src/lib/api";
import { useApi } from "@/src/lib/useApi";
import { Screen, Loader, ErrorState } from "@/src/components/ui";
import { BackBar } from "@/app/team/[id]";

// HOCKEY WORLD — the whole hockey world, independent of follows. Parent competition ->
// league -> (existing) league hub -> team -> player -> game. The CHL parent groups
// WHL/OHL/QMJHL so travel across them is structurally natural.
const PARENTS = [
  { key: "nhl", label: "NHL", tag: "National Hockey League", codes: ["nhl"] },
  { key: "chl", label: "CHL", tag: "Canadian Hockey League", codes: ["whl", "ohl", "qmjhl"] },
  { key: "ncaa", label: "NCAA", tag: "College Hockey", codes: ["ncaa"] },
];

const FULL: Record<string, string> = {
  nhl: "National Hockey League", whl: "Western Hockey League", ohl: "Ontario Hockey League",
  qmjhl: "Quebec Maritimes Junior HL", ncaa: "NCAA Men's Hockey", ahl: "American Hockey League", echl: "ECHL",
};

export default function HockeyWorld() {
  const router = useRouter();
  const { parent } = useLocalSearchParams<{ parent?: string }>();
  const q = useApi(() => api.leagues());

  if (q.loading) return <Screen><BackBar /><Loader label="Opening the hockey world…" /></Screen>;
  if (q.error || !q.data) return <Screen><BackBar /><ErrorState message="Couldn't load leagues" onRetry={q.reload} /></Screen>;

  const leagues = q.data.leagues || [];
  const byCode: Record<string, { code: string; name: string }> = {};
  for (const l of leagues) byCode[l.code] = l;
  const known = new Set(PARENTS.flatMap((p) => p.codes));
  const sections = PARENTS
    .map((p) => ({ ...p, items: p.codes.filter((c) => byCode[c]) }))
    .filter((s) => s.items.length);
  const others = leagues.filter((l) => !known.has(l.code));

  const LeagueRow = ({ code }: { code: string }) => (
    <Pressable style={styles.row} onPress={() => router.push(`/league/${code}`)} testID={`world-league-${code}`}>
      <View style={styles.badge}><Text style={styles.badgeText}>{code.toUpperCase()}</Text></View>
      <Text style={styles.rowName}>{FULL[code] || code.toUpperCase()}</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
    </Pressable>
  );

  return (
    <Screen>
      <BackBar />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.head}>
          <Text style={styles.kicker}>HOCKEY WORLD</Text>
          <Text style={styles.title}>Every league. Wander anywhere.</Text>
        </View>

        <Pressable style={styles.search} onPress={() => router.push("/search")} testID="world-search">
          <Ionicons name="search" size={18} color={colors.blue} />
          <Text style={styles.searchText}>Search any team or player…</Text>
        </Pressable>

        {sections.map((s) => (
          <View key={s.key} style={[styles.section, parent === s.key && styles.sectionHi]}>
            <View style={styles.secHead}>
              <Text style={styles.secLabel}>{s.label}</Text>
              <Text style={styles.secTag}>{s.tag}</Text>
            </View>
            <View style={styles.card}>
              {s.items.map((c) => <LeagueRow key={c} code={c} />)}
            </View>
          </View>
        ))}

        {others.length ? (
          <View style={styles.section}>
            <View style={styles.secHead}><Text style={styles.secLabel}>MORE</Text></View>
            <View style={styles.card}>{others.map((l) => <LeagueRow key={l.code} code={l.code} />)}</View>
          </View>
        ) : null}

        <View style={{ height: spacing.xxxl }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxxl, gap: spacing.md },
  head: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs, gap: 3 },
  kicker: { color: colors.blue, fontFamily: fonts.accent, fontSize: 11, fontWeight: "700", letterSpacing: 2 },
  title: { color: colors.white, fontFamily: fonts.display, fontSize: 23, fontWeight: "800", letterSpacing: 0.3 },

  search: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.blueDim, paddingHorizontal: spacing.md, height: 46 },
  searchText: { color: colors.textDim, fontFamily: fonts.body, fontSize: 14 },

  section: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  sectionHi: {},
  secHead: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  secLabel: { color: colors.white, fontFamily: fonts.display, fontSize: 16, fontWeight: "800", letterSpacing: 1 },
  secTag: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 11.5 },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  badge: { backgroundColor: colors.blueDim, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3, minWidth: 52, alignItems: "center" },
  badgeText: { color: colors.blue, fontFamily: fonts.display, fontSize: 12, fontWeight: "800", letterSpacing: 0.5 },
  rowName: { flex: 1, color: colors.text, fontFamily: fonts.display, fontSize: 15, fontWeight: "700" },
});
