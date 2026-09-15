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

type TeamLite = { abbr: string; name: string; logo?: string | null };

export default function ExploreScreen() {
  const router = useRouter();
  const [, setCtxLeague] = useContextLeague();
  const q = useApi(() => api.exploreWorld());
  const [world, setWorld] = useState<World>("elite");
  const [open, setOpen] = useState<string | null>(null);
  const [soon, setSoon] = useState<string | null>(null);
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

  const wd = q.data;
  const groups = [...wd.featured, ...wd.countries, ...wd.international];
  const openCountry = open ? groups.find((g) => g.leagues.some((l) => l.code === open))?.country : null;

  const Drill = ({ code }: { code: string }) => (
    <Animated.View key={code} entering={FadeInDown.duration(260)} layout={Layout} style={styles.drill}>
      <View style={styles.drillHead}>
        <Text style={styles.drillTitle}>{(LEAGUE_META[code]?.full) || code.toUpperCase()}</Text>
        <Pressable style={styles.hubBtn} onPress={() => { Haptics.selectionAsync(); router.push(`/league/${code}`); }} testID={`explore-hub-${code}`}>
          <Text style={styles.hubBtnText}>LEAGUE HUB</Text><Ionicons name="arrow-forward" size={13} color={colors.blue} />
        </Pressable>
      </View>
      {tLoading === code ? (
        <View style={styles.drillLoad}><ActivityIndicator color={colors.blue} /></View>
      ) : (teams[code] && teams[code].length) ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.teamRail}>
            {teams[code].map((t) => (
              <Pressable key={t.abbr} style={styles.teamTile} onPress={() => goTeam(code, t.abbr)} testID={`explore-team-${t.abbr}`}>
                <NhlLogo abbr={t.abbr} url={t.logo} size={44} />
                <Text style={styles.teamAbbr} numberOfLines={1}>{t.abbr}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable style={styles.surprise} onPress={() => surprise(code)} testID="explore-surprise">
            <Ionicons name="shuffle" size={15} color={colors.white} />
            <Text style={styles.surpriseText}>Surprise me</Text>
          </Pressable>
        </>
      ) : (
        <Text style={styles.drillEmpty}>No teams available right now.</Text>
      )}
    </Animated.View>
  );

  const CountryRow = ({ g }: { g: typeof groups[number] }) => (
    <View style={styles.ctry}>
      <View style={styles.ctryHead}>
        <Text style={styles.ctryFlag}>{g.flag}</Text>
        <Text style={styles.ctryName} numberOfLines={1}>{g.country}</Text>
        {g.available ? <View style={styles.liveTag}><Text style={styles.liveTagText}>{g.available} LIVE</Text></View> : null}
        <View style={{ flex: 1 }} />
        <Text style={styles.ctryCount}>{g.total}</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRail}>
        {g.leagues.map((l) => {
          const on = l.code && l.code === open;
          const avail = l.status === "available";
          return (
            <Pressable
              key={l.id ?? l.name}
              onPress={() => { Haptics.selectionAsync(); if (avail && l.code) pickLeague(l.code); else setSoon(l.name); }}
              style={[styles.chip, avail ? styles.chipLive : styles.chipSoon, on && styles.chipOn]}
              testID={avail && l.code ? `explore-league-${l.code}` : `explore-soon-${l.id}`}
            >
              <Text style={[styles.chipName, avail && styles.chipNameLive]} numberOfLines={1}>{l.name}</Text>
              {avail ? <View style={styles.liveDot} /> : <Text style={styles.soonTag}>SOON</Text>}
            </Pressable>
          );
        })}
      </ScrollView>
      {openCountry === g.country && open ? <Drill code={open} /> : null}
    </View>
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

        {/* Entrance 1 — SEARCH */}
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
              <Pressable key={w} onPress={() => { Haptics.selectionAsync(); setWorld(w); setOpen(null); setSoon(null); }} style={[styles.worldPill, on && styles.worldPillOn]} testID={`world-${w}`}>
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
              <Text style={styles.secLabel}>WANDER THE WORLD</Text>
              <Text style={styles.secHint}>Tap a live league — teams unfold right here. Swipe each country.</Text>
            </View>
            {soon ? (
              <Animated.View entering={FadeIn} style={styles.soonNote}>
                <Ionicons name="time-outline" size={14} color={colors.gold} />
                <Text style={styles.soonNoteText}>{soon} — confirmed by our provider, coming to Ticker soon.</Text>
                <Pressable onPress={() => setSoon(null)} hitSlop={8}><Ionicons name="close" size={14} color={colors.textFaint} /></Pressable>
              </Animated.View>
            ) : null}
            {groups.map((g) => <CountryRow key={g.country} g={g} />)}
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
  content: { paddingTop: spacing.lg, gap: spacing.md },
  head: { paddingHorizontal: spacing.lg, gap: 6 },
  kickerRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  kicker: { color: colors.blue, fontFamily: fonts.accent, fontSize: 11, fontWeight: "700", letterSpacing: 2 },
  title: { color: colors.white, fontFamily: fonts.display, fontSize: 30, fontWeight: "800", letterSpacing: 0.2, lineHeight: 34 },
  worldTotals: { color: colors.textDim, fontFamily: fonts.body, fontSize: 12.5, marginTop: 4 },

  ctry: { gap: spacing.xs },
  ctryHead: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: spacing.lg },
  ctryFlag: { fontSize: 17 },
  ctryName: { color: colors.white, fontFamily: fonts.display, fontSize: 14, fontWeight: "800", letterSpacing: 0.3 },
  liveTag: { backgroundColor: colors.blueDim, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  liveTagText: { color: colors.blue, fontFamily: fonts.accent, fontSize: 8.5, fontWeight: "800", letterSpacing: 0.5 },
  ctryCount: { color: colors.textFaint, fontFamily: fonts.display, fontSize: 12, fontWeight: "700" },
  chipRail: { gap: 8, paddingHorizontal: spacing.lg, paddingVertical: 2 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, height: 34, borderRadius: radius.pill, paddingHorizontal: 12, borderWidth: 1 },
  chipLive: { backgroundColor: colors.surfaceHi, borderColor: colors.blueDim },
  chipSoon: { backgroundColor: "transparent", borderColor: colors.border, borderStyle: "dashed" },
  chipOn: { backgroundColor: colors.blue, borderColor: colors.blue },
  chipName: { color: colors.textDim, fontFamily: fonts.display, fontSize: 13, fontWeight: "700", letterSpacing: 0.2, maxWidth: 150 },
  chipNameLive: { color: colors.white },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.blue },
  soonTag: { color: colors.textFaint, fontFamily: fonts.accent, fontSize: 8, fontWeight: "800", letterSpacing: 0.6 },
  soonNote: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: spacing.lg, backgroundColor: "rgba(245,179,1,0.08)", borderRadius: radius.md, borderWidth: 1, borderColor: "rgba(245,179,1,0.25)", paddingHorizontal: spacing.md, paddingVertical: 10 },
  soonNoteText: { flex: 1, color: colors.text, fontFamily: fonts.body, fontSize: 12.5 },

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

