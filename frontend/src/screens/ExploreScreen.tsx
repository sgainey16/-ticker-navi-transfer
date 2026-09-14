import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { colors, fonts, spacing, radius } from "@/src/theme";
import { api } from "@/src/lib/api";
import { useApi } from "@/src/lib/useApi";
import { TabScreen, Loader, ErrorState } from "@/src/components/ui";

// EXPLORE — the globe doorway into the wider Ticker hockey world. Phase-1 version:
// the real, working branches (leagues we cover) drilled by parent competition, plus
// a search entry. Phase 3 turns this into the full World -> Region -> League ->
// Division -> Team -> Player/Game hierarchy. Model kept global from day one.
const PARENTS = [
  { key: "nhl", label: "NHL", tag: "National Hockey League", codes: ["nhl"] },
  { key: "chl", label: "CHL", tag: "Canadian Hockey League", codes: ["whl", "ohl", "qmjhl"] },
  { key: "ncaa", label: "NCAA", tag: "College Hockey", codes: ["ncaa"] },
];
const FULL: Record<string, string> = {
  nhl: "National Hockey League", whl: "Western Hockey League", ohl: "Ontario Hockey League",
  qmjhl: "Quebec Maritimes Junior HL", ncaa: "NCAA Men's Hockey", ahl: "American Hockey League", echl: "ECHL",
};

export default function ExploreScreen() {
  const router = useRouter();
  const q = useApi(() => api.leagues());

  if (q.loading) return <TabScreen><Loader label="Opening the hockey world…" /></TabScreen>;
  if (q.error || !q.data) return <TabScreen><ErrorState message="Couldn't load leagues" onRetry={q.reload} /></TabScreen>;

  const leagues = q.data.leagues || [];
  const byCode: Record<string, { code: string; name: string }> = {};
  for (const l of leagues) byCode[l.code] = l;
  const known = new Set(PARENTS.flatMap((p) => p.codes));
  const sections = PARENTS.map((p) => ({ ...p, items: p.codes.filter((c) => byCode[c]) })).filter((s) => s.items.length);
  const others = leagues.filter((l) => !known.has(l.code));

  const LeagueRow = ({ code }: { code: string }) => (
    <Pressable style={styles.row} onPress={() => { Haptics.selectionAsync(); router.push(`/league/${code}`); }} testID={`explore-league-${code}`}>
      <View style={styles.badge}><Text style={styles.badgeText}>{code.toUpperCase()}</Text></View>
      <Text style={styles.rowName}>{FULL[code] || code.toUpperCase()}</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
    </Pressable>
  );

  return (
    <TabScreen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.head}>
          <Text style={styles.kicker}>EXPLORE THE TICKER</Text>
          <Text style={styles.title}>The hockey world.{"\n"}Wander anywhere.</Text>
        </View>

        {/* Globe placeholder — Phase 3 turns this into the real geographic doorway */}
        <Pressable style={styles.globe} onPress={() => { Haptics.selectionAsync(); router.push("/search"); }} testID="explore-globe">
          <Ionicons name="globe-outline" size={40} color={colors.blue} />
          <Text style={styles.globeText}>World → Region → League → Team → Player</Text>
          <Text style={styles.globeSub}>Search anything, anywhere</Text>
        </Pressable>

        <Pressable style={styles.search} onPress={() => { Haptics.selectionAsync(); router.push("/search"); }} testID="explore-search">
          <Ionicons name="search" size={18} color={colors.blue} />
          <Text style={styles.searchText}>Search any team or player…</Text>
        </Pressable>

        {sections.map((s) => (
          <View key={s.key} style={styles.section}>
            <View style={styles.secHead}>
              <Text style={styles.secLabel}>{s.label}</Text>
              <Text style={styles.secTag}>{s.tag}</Text>
            </View>
            <View style={styles.card}>{s.items.map((c) => <LeagueRow key={c} code={c} />)}</View>
          </View>
        ))}

        {others.length ? (
          <View style={styles.section}>
            <View style={styles.secHead}><Text style={styles.secLabel}>MORE</Text></View>
            <View style={styles.card}>{others.map((l) => <LeagueRow key={l.code} code={l.code} />)}</View>
          </View>
        ) : null}

        <View style={{ height: 120 }} />
      </ScrollView>
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.lg, gap: spacing.lg },
  head: { paddingHorizontal: spacing.lg, gap: 4 },
  kicker: { color: colors.blue, fontFamily: fonts.accent, fontSize: 11, fontWeight: "700", letterSpacing: 2 },
  title: { color: colors.white, fontFamily: fonts.display, fontSize: 26, fontWeight: "800", letterSpacing: 0.3, lineHeight: 30 },

  globe: { marginHorizontal: spacing.lg, alignItems: "center", gap: 6, backgroundColor: colors.blueSoft, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.blueDim, paddingVertical: spacing.xl },
  globeText: { color: colors.white, fontFamily: fonts.display, fontSize: 13, fontWeight: "700", letterSpacing: 0.4, marginTop: 4 },
  globeSub: { color: colors.textDim, fontFamily: fonts.body, fontSize: 12 },

  search: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.blueDim, paddingHorizontal: spacing.md, height: 46 },
  searchText: { color: colors.textDim, fontFamily: fonts.body, fontSize: 14 },

  section: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  secHead: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  secLabel: { color: colors.white, fontFamily: fonts.display, fontSize: 16, fontWeight: "800", letterSpacing: 1 },
  secTag: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 11.5 },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  badge: { backgroundColor: colors.blueDim, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3, minWidth: 52, alignItems: "center" },
  badgeText: { color: colors.blue, fontFamily: fonts.display, fontSize: 12, fontWeight: "800", letterSpacing: 0.5 },
  rowName: { flex: 1, color: colors.text, fontFamily: fonts.display, fontSize: 15, fontWeight: "700" },
});
