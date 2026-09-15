import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn } from "react-native-reanimated";

import { colors, fonts, spacing, radius } from "@/src/theme";
import { api, ExploreCountry } from "@/src/lib/api";
import { useApi } from "@/src/lib/useApi";
import { TabScreen, Loader, ErrorState } from "@/src/components/ui";

// EXPLORE — "take me somewhere in hockey." The MAIN surface no longer tries to show
// the whole inventory; it establishes the major ENTRANCES (search + world lens +
// countries/international). Tapping a country pushes into a progressive drill-down
// (app/explore/node.tsx) driven by backend/explore_taxonomy.py, so Ticker can grow
// to thousands of leagues without ever redesigning Explore again.
type World = "all" | "elite" | "youth";

export default function ExploreScreen() {
  const router = useRouter();
  const q = useApi(() => api.exploreWorld());
  const [world, setWorld] = useState<World>("elite");

  const enter = (country: string) => {
    Haptics.selectionAsync();
    router.push(`/explore/node?path=${encodeURIComponent(`country:${country}`)}`);
  };

  if (q.loading) return <TabScreen><Loader label="Opening the hockey world…" /></TabScreen>;
  if (q.error || !q.data) return <TabScreen><ErrorState message="Couldn't load the hockey world" onRetry={q.reload} /></TabScreen>;

  const wd = q.data;

  const FeaturedCard = ({ g }: { g: ExploreCountry }) => (
    <Pressable style={styles.card} onPress={() => enter(g.country)} testID={`explore-country-${g.country}`}>
      <View style={styles.cardTop}>
        <Text style={styles.cardFlag}>{g.flag}</Text>
        {g.available ? <View style={styles.liveTag}><Text style={styles.liveTagText}>{g.available} LIVE</Text></View> : null}
      </View>
      <Text style={styles.cardName} numberOfLines={1}>{g.country}</Text>
      <Text style={styles.cardCount}>{g.total} {g.total === 1 ? "league" : "leagues"}</Text>
      <View style={styles.cardGo}>
        <Text style={styles.cardGoText}>ENTER</Text>
        <Ionicons name="arrow-forward" size={13} color={colors.blue} />
      </View>
    </Pressable>
  );

  const Chip = ({ g }: { g: ExploreCountry }) => (
    <Pressable style={styles.chip} onPress={() => enter(g.country)} testID={`explore-country-${g.country}`}>
      <Text style={styles.chipFlag}>{g.flag}</Text>
      <Text style={styles.chipName} numberOfLines={1}>{g.country}</Text>
      {g.available ? <View style={styles.chipDot} /> : null}
      <Text style={styles.chipCount}>{g.total}</Text>
    </Pressable>
  );

  return (
    <TabScreen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.head}>
          <View style={styles.kickerRow}>
            <Ionicons name="planet" size={15} color={colors.blue} />
            <Text style={styles.kicker}>EXPLORE THE TICKER</Text>
          </View>
          <Text style={styles.title}>Take me somewhere{"\n"}in hockey.</Text>
          <Text style={styles.worldTotals}>{wd.totals.countries} countries · {wd.totals.leagues} leagues · {wd.totals.available} live in Ticker</Text>
        </View>

        {/* Entrance 1 — SEARCH (the shortcut) */}
        <Pressable style={styles.search} onPress={() => { Haptics.selectionAsync(); router.push("/search"); }} testID="explore-search">
          <Ionicons name="search" size={18} color={colors.blue} />
          <Text style={styles.searchText}>Search a league, team or player…</Text>
          <Ionicons name="arrow-forward" size={16} color={colors.textFaint} />
        </Pressable>

        {/* World lens */}
        <View style={styles.worldRow}>
          {([["elite", "ELITE / JUNIOR+"], ["all", "ALL HOCKEY"], ["youth", "YOUTH / LOCAL"]] as [World, string][]).map(([w, label]) => {
            const on = world === w;
            return (
              <Pressable key={w} onPress={() => { Haptics.selectionAsync(); setWorld(w); }} style={[styles.worldPill, on && styles.worldPillOn]} testID={`world-${w}`}>
                <Text style={[styles.worldText, on && styles.worldTextOn]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        {world === "youth" ? (
          <Animated.View entering={FadeIn} style={styles.youthWrap}>
            <View style={styles.youthCard}>
              <Ionicons name="construct-outline" size={26} color={colors.blue} />
              <Text style={styles.youthTitle}>Youth & local hockey is coming</Text>
              <Text style={styles.youthText}>
                A different discovery world — minor hockey, girls hockey, AAA/AA/A, associations, academies and tournaments — connected by where you are, not by pro leagues. We’re wiring real data before we open it.
              </Text>
              <View style={styles.pathRow}>
                {["Canada", "British Columbia", "Kamloops", "Association"].map((p, i) => (
                  <React.Fragment key={p}>
                    {i ? <Ionicons name="chevron-forward" size={11} color={colors.textFaint} /> : null}
                    <View style={styles.pathChip}><Text style={styles.pathChipText}>{p}</Text></View>
                  </React.Fragment>
                ))}
              </View>
              <Text style={styles.youthSoon}>SAMPLE PATH · COMING SOON</Text>
            </View>
            <Pressable style={styles.youthCta} onPress={() => { Haptics.selectionAsync(); setWorld("elite"); }}>
              <Text style={styles.youthCtaText}>Explore the elite game for now</Text>
              <Ionicons name="arrow-forward" size={15} color={colors.white} />
            </Pressable>
          </Animated.View>
        ) : (
          <>
            {/* Featured hockey nations */}
            <View style={styles.section}>
              <Text style={styles.secLabel}>HOCKEY NATIONS</Text>
              <Text style={styles.secHint}>Pick a country — then choose how you want to explore it.</Text>
            </View>
            <View style={styles.grid}>
              {wd.featured.map((g) => <FeaturedCard key={g.country} g={g} />)}
            </View>

            {/* More countries */}
            {wd.countries.length ? (
              <>
                <View style={styles.section}><Text style={styles.secLabel}>MORE COUNTRIES</Text></View>
                <View style={styles.chipWrap}>
                  {wd.countries.map((g) => <Chip key={g.country} g={g} />)}
                </View>
              </>
            ) : null}

            {/* International */}
            {wd.international.length ? (
              <>
                <View style={styles.section}><Text style={styles.secLabel}>INTERNATIONAL</Text></View>
                <View style={styles.chipWrap}>
                  {wd.international.map((g) => <Chip key={g.country} g={g} />)}
                </View>
              </>
            ) : null}

            {/* Youth teaser */}
            <Pressable style={styles.youthTeaser} onPress={() => { Haptics.selectionAsync(); setWorld("youth"); }} testID="explore-youth-teaser">
              <Ionicons name="people-outline" size={20} color={colors.blue} />
              <View style={{ flex: 1 }}>
                <Text style={styles.teaserTitle}>Youth & Local hockey</Text>
                <Text style={styles.teaserSub}>A different discovery world — coming soon</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
            </Pressable>
          </>
        )}

        <View style={{ height: 130 }} />
      </ScrollView>
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.lg, gap: spacing.md },
  head: { paddingHorizontal: spacing.lg, gap: 6 },
  kickerRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  kicker: { color: colors.blue, fontFamily: fonts.accent, fontSize: 11, fontWeight: "700", letterSpacing: 2 },
  title: { color: colors.white, fontFamily: fonts.display, fontSize: 30, fontWeight: "800", letterSpacing: 0.2, lineHeight: 34 },
  worldTotals: { color: colors.textDim, fontFamily: fonts.body, fontSize: 12.5, marginTop: 4 },

  search: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.blueDim, paddingHorizontal: spacing.md, height: 48 },
  searchText: { flex: 1, color: colors.textDim, fontFamily: fonts.body, fontSize: 14 },

  worldRow: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg },
  worldPill: { flex: 1, alignItems: "center", justifyContent: "center", height: 34, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 4 },
  worldPillOn: { backgroundColor: colors.blueDim, borderColor: colors.blue },
  worldText: { color: colors.textDim, fontFamily: fonts.display, fontSize: 10.5, fontWeight: "800", letterSpacing: 0.3 },
  worldTextOn: { color: colors.white },

  section: { paddingHorizontal: spacing.lg, gap: 2 },
  secLabel: { color: colors.white, fontFamily: fonts.display, fontSize: 16, fontWeight: "800", letterSpacing: 1 },
  secHint: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 12 },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, paddingHorizontal: spacing.lg },
  card: { width: "47%", flexGrow: 1, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.blueDim, padding: spacing.md, gap: 4, minHeight: 118, justifyContent: "space-between" },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardFlag: { fontSize: 26 },
  liveTag: { backgroundColor: colors.blue, borderRadius: 5, paddingHorizontal: 7, paddingVertical: 3 },
  liveTagText: { color: colors.white, fontFamily: fonts.accent, fontSize: 8.5, fontWeight: "800", letterSpacing: 0.5 },
  cardName: { color: colors.white, fontFamily: fonts.display, fontSize: 17, fontWeight: "800", letterSpacing: 0.2, marginTop: 6 },
  cardCount: { color: colors.textDim, fontFamily: fonts.body, fontSize: 12 },
  cardGo: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  cardGoText: { color: colors.blue, fontFamily: fonts.display, fontSize: 11, fontWeight: "800", letterSpacing: 1 },

  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: spacing.lg },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, height: 36, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 12 },
  chipFlag: { fontSize: 15 },
  chipName: { color: colors.text, fontFamily: fonts.display, fontSize: 13, fontWeight: "700", letterSpacing: 0.2, maxWidth: 140 },
  chipDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.blue },
  chipCount: { color: colors.textFaint, fontFamily: fonts.display, fontSize: 11, fontWeight: "700" },

  youthWrap: { paddingHorizontal: spacing.lg, gap: spacing.md },
  youthCard: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: 8, alignItems: "flex-start" },
  youthTitle: { color: colors.white, fontFamily: fonts.display, fontSize: 17, fontWeight: "800" },
  youthText: { color: colors.textDim, fontFamily: fonts.body, fontSize: 13, lineHeight: 19 },
  pathRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 6 },
  pathChip: { backgroundColor: colors.surfaceHi, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  pathChipText: { color: colors.textDim, fontFamily: fonts.display, fontSize: 11.5, fontWeight: "600" },
  youthSoon: { color: colors.textFaint, fontFamily: fonts.accent, fontSize: 9, fontWeight: "700", letterSpacing: 1.5, marginTop: 4 },
  youthCta: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.blueDim, borderRadius: radius.pill, paddingVertical: 12, borderWidth: 1, borderColor: colors.blue },
  youthCtaText: { color: colors.white, fontFamily: fonts.display, fontSize: 13, fontWeight: "800", letterSpacing: 0.3 },

  youthTeaser: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginHorizontal: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  teaserTitle: { color: colors.white, fontFamily: fonts.display, fontSize: 14, fontWeight: "700" },
  teaserSub: { color: colors.textDim, fontFamily: fonts.body, fontSize: 11.5, marginTop: 1 },
});
