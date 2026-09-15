import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeIn, Layout } from "react-native-reanimated";

import { colors, fonts, spacing, radius } from "@/src/theme";
import { api } from "@/src/lib/api";
import { useApi } from "@/src/lib/useApi";
import { useContextLeague } from "@/src/lib/context";
import { TabScreen, Loader, ErrorState } from "@/src/components/ui";
import { NhlLogo } from "@/src/components/NhlLogo";

// EXPLORE — "take me somewhere in hockey." A visual WANDER surface (not a directory).
// Reuses the proven plumbing (universal search, league context, content-is-navigation,
// team/league routes). Two entrances: SEARCH and WANDER. Two worlds: ELITE/JUNIOR+ and
// YOUTH/LOCAL (honest placeholder — no fabricated youth data yet). The path is NOT a
// rigid World->Region->League->Team drill; you pick a league and its teams open inline,
// then tap a crest to arrive at a real destination. Different ecosystems can differ.
type World = "all" | "elite" | "youth";

// Curated identity for the elite leagues we actually cover (honest region labels).
const LEAGUE_META: Record<string, { name: string; full: string; region: string; flag: string; tint: string }> = {
  nhl: { name: "NHL", full: "National Hockey League", region: "North America", flag: "🇨🇦🇺🇸", tint: "#1B2A4A" },
  whl: { name: "WHL", full: "Western Hockey League", region: "Western Canada · US NW", flag: "🇨🇦", tint: "#123A2E" },
  ohl: { name: "OHL", full: "Ontario Hockey League", region: "Ontario", flag: "🇨🇦", tint: "#3A1220" },
  qmjhl: { name: "QMJHL", full: "Québec Maritimes Junior", region: "Québec · Maritimes", flag: "🇨🇦", tint: "#2A1F3A" },
  ncaa: { name: "NCAA", full: "College Hockey", region: "United States", flag: "🇺🇸", tint: "#3A2E12" },
};
const LEAGUE_ORDER = ["nhl", "whl", "ohl", "qmjhl", "ncaa"];

type TeamLite = { abbr: string; name: string; logo?: string | null };

export default function ExploreScreen() {
  const router = useRouter();
  const [, setCtxLeague] = useContextLeague();
  const q = useApi(() => api.leagues());
  const [world, setWorld] = useState<World>("elite");
  const [open, setOpen] = useState<string | null>(null);
  const [teams, setTeams] = useState<Record<string, TeamLite[]>>({});
  const [tLoading, setTLoading] = useState<string | null>(null);

  const loadTeams = async (code: string) => {
    if (teams[code]) return;
    setTLoading(code);
    try {
      const d = code === "nhl" ? await api.nhlStandings() : await api.leagueStandings(code);
      const rows = [...(d.Eastern || []), ...(d.Western || [])];
      const seen = new Set<string>();
      const list: TeamLite[] = [];
      for (const r of rows) {
        if (r.abbr && !seen.has(r.abbr)) { seen.add(r.abbr); list.push({ abbr: r.abbr, name: r.short || r.name, logo: r.logo }); }
      }
      setTeams((p) => ({ ...p, [code]: list }));
    } catch {
      setTeams((p) => ({ ...p, [code]: [] }));
    } finally {
      setTLoading(null);
    }
  };

  const pickLeague = (code: string) => {
    Haptics.selectionAsync();
    setCtxLeague(code);
    setOpen((prev) => (prev === code ? null : code));
    loadTeams(code);
  };
  const goTeam = (code: string, abbr: string) => {
    Haptics.selectionAsync();
    router.push(`/team/${abbr}${code !== "nhl" ? `?league=${code}` : ""}`);
  };
  const surprise = (code: string) => {
    const list = teams[code];
    if (!list || !list.length) return;
    goTeam(code, list[Math.floor(Math.random() * list.length)].abbr);
  };

  if (q.loading) return <TabScreen><Loader label="Opening the hockey world…" /></TabScreen>;
  if (q.error || !q.data) return <TabScreen><ErrorState message="Couldn't load the hockey world" onRetry={q.reload} /></TabScreen>;

  const available = new Set((q.data.leagues || []).map((l) => l.code));
  const leagues = LEAGUE_ORDER.filter((c) => available.has(c) && LEAGUE_META[c]);

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
        </View>

        {/* Entrance 1 — SEARCH (reuse universal search) */}
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
              <Pressable key={w} onPress={() => { Haptics.selectionAsync(); setWorld(w); setOpen(null); }} style={[styles.worldPill, on && styles.worldPillOn]} testID={`world-${w}`}>
                <Text style={[styles.worldText, on && styles.worldTextOn]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Entrance 2 — WANDER */}
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
            <View style={styles.section}>
              <Text style={styles.secLabel}>PICK A LEAGUE</Text>
              <Text style={styles.secHint}>Tap to open it — teams unfold right here.</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.leagueRail}>
              {leagues.map((code) => {
                const m = LEAGUE_META[code];
                const on = open === code;
                return (
                  <Pressable key={code} onPress={() => pickLeague(code)} style={[styles.lgCard, { backgroundColor: m.tint }, on && styles.lgCardOn]} testID={`explore-league-${code}`}>
                    <View style={styles.lgTop}><Text style={styles.lgAbbr}>{m.name}</Text><Text style={styles.lgFlag}>{m.flag}</Text></View>
                    <Text style={styles.lgFull} numberOfLines={2}>{m.full}</Text>
                    <View style={styles.lgBottom}>
                      <Ionicons name="location-outline" size={11} color={colors.textDim} />
                      <Text style={styles.lgRegion} numberOfLines={1}>{m.region}</Text>
                    </View>
                    {on ? <View style={styles.lgDot} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Inline drill-in — the team crests of the chosen league */}
            {open ? (
              <Animated.View key={open} entering={FadeInDown.duration(280)} layout={Layout} style={styles.drill}>
                <View style={styles.drillHead}>
                  <Text style={styles.drillTitle}>{LEAGUE_META[open].full}</Text>
                  <Pressable style={styles.hubBtn} onPress={() => { Haptics.selectionAsync(); router.push(`/league/${open}`); }} testID={`explore-hub-${open}`}>
                    <Text style={styles.hubBtnText}>LEAGUE HUB</Text><Ionicons name="arrow-forward" size={13} color={colors.blue} />
                  </Pressable>
                </View>
                {tLoading === open ? (
                  <View style={styles.drillLoad}><ActivityIndicator color={colors.blue} /></View>
                ) : (teams[open] && teams[open].length) ? (
                  <>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.teamRail}>
                      {teams[open].map((t) => (
                        <Pressable key={t.abbr} style={styles.teamTile} onPress={() => goTeam(open, t.abbr)} testID={`explore-team-${t.abbr}`}>
                          <NhlLogo abbr={t.abbr} url={t.logo} size={46} />
                          <Text style={styles.teamAbbr} numberOfLines={1}>{t.abbr}</Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                    <Pressable style={styles.surprise} onPress={() => surprise(open)} testID="explore-surprise">
                      <Ionicons name="shuffle" size={15} color={colors.white} />
                      <Text style={styles.surpriseText}>Surprise me</Text>
                    </Pressable>
                  </>
                ) : (
                  <Text style={styles.drillEmpty}>No teams available for {LEAGUE_META[open].name} right now.</Text>
                )}
              </Animated.View>
            ) : null}

            {/* ALL HOCKEY also nods to the youth world (honest teaser) */}
            {world === "all" ? (
              <Pressable style={styles.youthTeaser} onPress={() => { Haptics.selectionAsync(); setWorld("youth"); }} testID="explore-youth-teaser">
                <Ionicons name="people-outline" size={20} color={colors.blue} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.teaserTitle}>Youth & Local hockey</Text>
                  <Text style={styles.teaserSub}>A different discovery world — coming soon</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
              </Pressable>
            ) : null}
          </>
        )}

        <View style={{ height: 130 }} />
      </ScrollView>
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.lg, gap: spacing.lg },
  head: { paddingHorizontal: spacing.lg, gap: 6 },
  kickerRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  kicker: { color: colors.blue, fontFamily: fonts.accent, fontSize: 11, fontWeight: "700", letterSpacing: 2 },
  title: { color: colors.white, fontFamily: fonts.display, fontSize: 30, fontWeight: "800", letterSpacing: 0.2, lineHeight: 34 },

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

  leagueRail: { gap: spacing.md, paddingHorizontal: spacing.lg },
  lgCard: { width: 158, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, justifyContent: "space-between", minHeight: 118 },
  lgCardOn: { borderColor: colors.blue, borderWidth: 2 },
  lgTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  lgAbbr: { color: colors.white, fontFamily: fonts.display, fontSize: 26, fontWeight: "800", letterSpacing: 0.5 },
  lgFlag: { fontSize: 15 },
  lgFull: { color: "rgba(255,255,255,0.86)", fontFamily: fonts.display, fontSize: 12.5, fontWeight: "600", lineHeight: 16, marginTop: 6 },
  lgBottom: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8 },
  lgRegion: { color: colors.textDim, fontFamily: fonts.body, fontSize: 11 },
  lgDot: { position: "absolute", top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.blue },

  drill: { marginHorizontal: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.blueDim, padding: spacing.md, gap: spacing.md },
  drillHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  drillTitle: { flex: 1, color: colors.white, fontFamily: fonts.display, fontSize: 15, fontWeight: "800", letterSpacing: 0.2 },
  hubBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.blueDim, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6 },
  hubBtnText: { color: colors.blue, fontFamily: fonts.display, fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  drillLoad: { paddingVertical: spacing.lg, alignItems: "center" },
  drillEmpty: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 13, paddingVertical: spacing.md },
  teamRail: { gap: spacing.md, paddingVertical: 2 },
  teamTile: { alignItems: "center", gap: 6, width: 58 },
  teamAbbr: { color: colors.text, fontFamily: fonts.display, fontSize: 12, fontWeight: "700", letterSpacing: 0.5 },
  surprise: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.blue, borderRadius: radius.pill, paddingVertical: 11 },
  surpriseText: { color: colors.white, fontFamily: fonts.display, fontSize: 13, fontWeight: "800", letterSpacing: 0.5 },

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

