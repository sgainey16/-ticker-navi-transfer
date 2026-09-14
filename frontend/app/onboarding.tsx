import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, TextInput, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { colors, fonts, spacing, radius } from "@/src/theme";
import { api, SearchResult } from "@/src/lib/api";
import { useFollows, Follows } from "@/src/lib/follows";
import { NhlLogo } from "@/src/components/NhlLogo";
import { TickerMark } from "@/src/components/TickerLogo";

const DESK = require("../assets/images/broadcast-desk.png");

type Kind = "team" | "player";
type TeamPick = { abbr: string; name: string; logo?: string | null; fav?: boolean; league?: string };
type PlayerPick = { player_id: string; team_abbr: string; name: string; pos?: string; headshot?: string | null; fav?: boolean; league?: string };

type Step = { kind: Kind; fav: boolean; host: "reggie" | "marc"; line: string; ph: string; skippable: boolean };
const STEPS: Step[] = [
  { kind: "team", fav: true, host: "reggie", line: "Alright, first one. Who's your team?", ph: "Search teams…", skippable: false },
  { kind: "team", fav: false, host: "marc", line: "Anybody else you keep an eye on?", ph: "Add another team…", skippable: true },
  { kind: "player", fav: true, host: "reggie", line: "Alright. Who's your player?", ph: "Search players…", skippable: true },
  { kind: "player", fav: false, host: "marc", line: "Anyone else coming with us?", ph: "Add another player…", skippable: true },
];

const HOST_COLOR = { reggie: colors.gold, marc: "#9AA6B8" } as const;
const HOST_NAME = { reggie: "REGGIE", marc: "MARC" } as const;

// Fast geo-first entry: Where are you? -> What hockey matters? -> Teams/players -> Enter.
const REGIONS: { key: string; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "canada", label: "Canada", icon: "snow-outline" },
  { key: "usa", label: "United States", icon: "flag-outline" },
  { key: "europe", label: "Europe", icon: "earth-outline" },
  { key: "world", label: "Elsewhere", icon: "planet-outline" },
];
const DEFAULT_LEAGUES = [
  { code: "nhl", name: "NHL" }, { code: "whl", name: "WHL" },
  { code: "ohl", name: "OHL" }, { code: "qmjhl", name: "QMJHL" }, { code: "ncaa", name: "NCAA" },
];
const LEAGUE_TAG: Record<string, string> = {
  nhl: "The show", whl: "Junior · West", ohl: "Junior · Ontario",
  qmjhl: "Junior · Québec", ncaa: "College", ahl: "Pro · AHL", echl: "Pro · ECHL",
};

function lastName(name: string) { const p = name.trim().split(/\s+/); return p[p.length - 1] || name; }
function initials(name: string) { const p = name.trim().split(/\s+/); return ((p[0]?.[0] || "") + (p[p.length - 1]?.[0] || "")).toUpperCase(); }

export default function Onboarding() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { reset } = useLocalSearchParams<{ reset?: string }>();
  const { completeOnboarding, resetOnboarding } = useFollows();

  const [phase, setPhase] = useState<"welcome" | "region" | "interests" | "chat">("welcome");
  const [region, setRegion] = useState<string | null>(null);
  const [leagueCodes, setLeagueCodes] = useState<string[]>([]);
  const [allLeagues, setAllLeagues] = useState<{ code: string; name: string }[]>([]);
  const [si, setSi] = useState(0);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [teams, setTeams] = useState<Record<string, TeamPick>>({});
  const [players, setPlayers] = useState<Record<string, PlayerPick>>({});

  const runId = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const step = STEPS[si];
  const isLast = si === STEPS.length - 1;

  useEffect(() => { if (reset === "1") resetOnboarding(); }, [reset, resetOnboarding]);

  useEffect(() => { api.leagues().then((r) => setAllLeagues(r.leagues || [])).catch(() => {}); }, []);

  const toggleLeague = (code: string) => {
    Haptics.selectionAsync();
    setLeagueCodes((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  };

  // Fresh search each question — clears when the host moves on.
  useEffect(() => { setQuery(""); setResults([]); setSearching(false); }, [si]);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const q = query.trim();
    if (q.length < 2) { setResults([]); setSearching(false); return; }
    setSearching(true);
    const id = ++runId.current;
    timer.current = setTimeout(async () => {
      try {
        const r = await api.search(q);
        if (runId.current === id) setResults(r.results);
      } catch {
        if (runId.current === id) setResults([]);
      } finally {
        if (runId.current === id) setSearching(false);
      }
    }, 120);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [query]);

  useEffect(() => () => { if (advTimer.current) clearTimeout(advTimer.current); }, []);

  const teamList = useMemo(() => Object.values(teams), [teams]);
  const playerList = useMemo(() => Object.values(players), [players]);
  const count = teamList.length + playerList.length;
  const hasFavTeam = teamList.some((t) => t.fav);
  const hasFavPlayer = playerList.some((p) => p.fav);

  const goNext = () => { Haptics.selectionAsync(); if (isLast) finish(); else setSi((s) => s + 1); };

  const pick = (r: SearchResult) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (r.type === "team" && r.team_abbr) {
      const makeFav = step.fav && !hasFavTeam;
      setTeams((prev) => ({ ...prev, [r.team_abbr!]: { abbr: r.team_abbr!, name: r.name, logo: r.logo, league: r.league_code, fav: makeFav || prev[r.team_abbr!]?.fav } }));
    } else if (r.type === "player" && r.player_id) {
      const makeFav = step.fav && !hasFavPlayer;
      setPlayers((prev) => ({ ...prev, [r.player_id!]: { player_id: r.player_id!, team_abbr: r.team_abbr || "", name: r.name, pos: r.pos, headshot: r.headshot, league: r.league_code, fav: makeFav || prev[r.player_id!]?.fav } }));
    }
    // Answering a "favorite" question flows straight into the next host line.
    if (step.fav) {
      setQuery("");
      if (advTimer.current) clearTimeout(advTimer.current);
      advTimer.current = setTimeout(() => setSi((s) => Math.min(s + 1, STEPS.length - 1)), 480);
    } else {
      setQuery("");
    }
  };

  const skip = () => {
    Haptics.selectionAsync();
    // Skipping the "favorite player" question means no players at all -> finish.
    if (si === 2) finish();
    else if (isLast) finish();
    else setSi((s) => s + 1);
  };

  const removeTeam = (abbr: string) => { Haptics.selectionAsync(); setTeams((p) => { const n = { ...p }; delete n[abbr]; return n; }); };
  const removePlayer = (pid: string) => { Haptics.selectionAsync(); setPlayers((p) => { const n = { ...p }; delete n[pid]; return n; }); };

  const finish = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const follows: Follows = {
      teams: teamList.map((t) => ({ abbr: t.abbr, name: t.name, fav: t.fav, league: t.league, logo: t.logo })),
      players: playerList.map((p) => ({ player_id: p.player_id, team_abbr: p.team_abbr, name: p.name, pos: p.pos, fav: p.fav, league: p.league })),
      region: region || undefined,
      leagues: leagueCodes.length ? leagueCodes : undefined,
    };
    await completeOnboarding(follows);
    router.replace("/");
  };

  const selected = (r: SearchResult) => r.type === "team" ? !!teams[r.team_abbr || ""] : !!players[r.player_id || ""];

  // ---------------- WELCOME ----------------
  if (phase === "welcome") {
    return (
      <View style={[styles.root, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.brandRow}><TickerMark size={26} /><Text style={styles.brand}>THE TICKER</Text></View>
        <View style={styles.welcomeBody}>
          <View style={styles.deskBig}>
            <Image source={DESK} style={StyleSheet.absoluteFill} contentFit="cover" />
            <LinearGradient colors={["rgba(5,7,12,0.15)", "rgba(5,7,12,0.62)", "rgba(5,7,12,0.98)"]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
            <View style={styles.deskTop}><View style={styles.deskTag}><Ionicons name="mic" size={11} color={colors.blue} /><Text style={styles.deskTagText}>REGGIE + MARC</Text></View></View>
            <View style={styles.deskBottom}>
              <Text style={styles.kicker}>WELCOME TO</Text>
              <Text style={styles.deskTitle}>THE TICKER</Text>
              <View style={styles.hostLine}><Text style={[styles.hostName, { color: colors.gold }]}>REGGIE</Text><Text style={styles.hostText}>Grab a seat. Let&apos;s talk hockey for a second.</Text></View>
              <View style={styles.hostLine}><Text style={[styles.hostName, { color: "#9AA6B8" }]}>MARC</Text><Text style={styles.hostText}>A couple quick questions and your Ticker&apos;s built.</Text></View>
            </View>
          </View>
          <Text style={styles.pitch}>The Ticker knows the hockey you care about — then Reggie and Marc bring that world to life.</Text>
        </View>
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <View />
          <Pressable style={styles.cta} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setPhase("region"); }} testID="welcome-go">
            <Text style={styles.ctaText}>Let&apos;s go</Text><Ionicons name="arrow-forward" size={16} color={colors.white} />
          </Pressable>
        </View>
      </View>
    );
  }

  // ---------------- REGION (Step 1) ----------------
  if (phase === "region") {
    return (
      <View style={[styles.root, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.brandRow}><TickerMark size={24} /><Text style={styles.brand}>THE TICKER</Text></View>
        <Animated.View entering={FadeInDown.duration(300)} style={styles.stepHead}>
          <Text style={styles.stepKicker}>STEP 1 OF 3</Text>
          <Text style={styles.stepTitle}>Where do you follow hockey from?</Text>
          <Text style={styles.stepSub}>Points The Ticker at your corner of the hockey world. You can wander anywhere later.</Text>
        </Animated.View>
        <View style={styles.regionGrid}>
          {REGIONS.map((r) => {
            const on = region === r.key;
            return (
              <Pressable key={r.key} style={[styles.regionChip, on && styles.regionChipOn]} onPress={() => { Haptics.selectionAsync(); setRegion(r.key); if (advTimer.current) clearTimeout(advTimer.current); advTimer.current = setTimeout(() => setPhase("interests"), 260); }} testID={`region-${r.key}`}>
                <Ionicons name={r.icon} size={22} color={on ? colors.white : colors.blue} />
                <Text style={[styles.regionText, on && { color: colors.white }]}>{r.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={{ flex: 1 }} />
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <View style={{ width: 60 }} />
          <Pressable style={styles.cta} onPress={() => { Haptics.selectionAsync(); setPhase("interests"); }} testID="region-skip">
            <Text style={styles.ctaText}>Skip</Text><Ionicons name="arrow-forward" size={16} color={colors.white} />
          </Pressable>
        </View>
      </View>
    );
  }

  // ---------------- INTERESTS (Step 2) ----------------
  if (phase === "interests") {
    const list = allLeagues.length ? allLeagues : DEFAULT_LEAGUES;
    return (
      <View style={[styles.root, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.brandRow}><TickerMark size={24} /><Text style={styles.brand}>THE TICKER</Text></View>
        <Animated.View entering={FadeInDown.duration(300)} style={styles.stepHead}>
          <Text style={styles.stepKicker}>STEP 2 OF 3</Text>
          <Text style={styles.stepTitle}>What hockey matters to you?</Text>
          <Text style={styles.stepSub}>Pick as many as you like — or none. The Ticker learns more as you explore.</Text>
        </Animated.View>
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.sm }}>
          {list.map((l) => {
            const on = leagueCodes.includes(l.code);
            return (
              <Pressable key={l.code} style={[styles.leagueRow, on && styles.leagueRowOn]} onPress={() => toggleLeague(l.code)} testID={`interest-${l.code}`}>
                <View style={[styles.leagueBadge, on && styles.leagueBadgeOn]}><Text style={[styles.leagueBadgeText, on && { color: colors.white }]}>{l.code.toUpperCase()}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.leagueName}>{l.name}</Text>
                  <Text style={styles.leagueTag}>{LEAGUE_TAG[l.code] || "Hockey"}</Text>
                </View>
                <Ionicons name={on ? "checkmark-circle" : "ellipse-outline"} size={22} color={on ? colors.blue : colors.textFaint} />
              </Pressable>
            );
          })}
        </ScrollView>
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <Pressable style={styles.backBtn} onPress={() => { Haptics.selectionAsync(); setPhase("region"); }}><Text style={styles.backText}>Back</Text></Pressable>
          <Pressable style={styles.cta} onPress={() => { Haptics.selectionAsync(); setPhase("chat"); }} testID="interests-next">
            <Text style={styles.ctaText}>{leagueCodes.length ? "Continue" : "Skip"}</Text><Ionicons name="arrow-forward" size={16} color={colors.white} />
          </Pressable>
        </View>
      </View>
    );
  }

  // ---------------- CHAT (one flowing conversation) ----------------
  const raw = results;
  const shown = raw.filter((r) => r.type === step.kind);
  const noneConnected = query.trim().length >= 2 && !searching && raw.length === 0;
  const wrongType = query.trim().length >= 2 && !searching && raw.length > 0 && shown.length === 0;

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.sm }]}>
      {/* persistent host desk strip */}
      <View style={styles.deskStrip}>
        <Image source={DESK} style={StyleSheet.absoluteFill} contentFit="cover" />
        <LinearGradient colors={["rgba(5,7,12,0.55)", "rgba(5,7,12,0.86)"]} style={StyleSheet.absoluteFill} />
        <View style={styles.stripRow}>
          <View style={styles.deskTag}><Ionicons name="mic" size={10} color={colors.blue} /><Text style={styles.deskTagText}>REGGIE + MARC</Text></View>
          <View style={styles.dots}>{STEPS.map((_, i) => <View key={i} style={[styles.dot, i === si && styles.dotOn, i < si && styles.dotDone]} />)}</View>
        </View>
      </View>

      {/* current host line — animates in on each step for a conversational feel */}
      <Animated.View key={si} entering={FadeInDown.duration(320)} style={styles.askLine}>
        <Text style={[styles.askName, { color: HOST_COLOR[step.host] }]}>{HOST_NAME[step.host]}</Text>
        <Text style={styles.askText}>{step.line}</Text>
      </Animated.View>

      {/* search */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={colors.textDim} />
        <TextInput
          testID="onboard-search"
          value={query}
          onChangeText={setQuery}
          placeholder={step.ph}
          placeholderTextColor={colors.textFaint}
          style={styles.searchInput}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {query.length > 0 ? <Pressable hitSlop={10} onPress={() => setQuery("")}><Ionicons name="close-circle" size={18} color={colors.textDim} /></Pressable> : null}
      </View>

      {/* your ticker so far */}
      {count > 0 ? (
        <Animated.View entering={FadeIn} style={styles.followWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.followRail} keyboardShouldPersistTaps="handled">
            {teamList.map((t) => (
              <Pressable key={`t${t.abbr}`} style={[styles.followChip, t.fav && styles.followChipFav]} onPress={() => removeTeam(t.abbr)}>
                {t.fav ? <Ionicons name="star" size={12} color={colors.gold} /> : null}
                <NhlLogo abbr={t.abbr} url={t.logo} size={18} />
                <Text style={styles.followChipText}>{t.abbr}</Text>
                <Ionicons name="close" size={13} color={colors.textDim} />
              </Pressable>
            ))}
            {playerList.map((p) => (
              <Pressable key={`p${p.player_id}`} style={[styles.followChip, p.fav && styles.followChipFav]} onPress={() => removePlayer(p.player_id)}>
                {p.fav ? <Ionicons name="star" size={12} color={colors.gold} /> : null}
                <Avatar headshot={p.headshot} name={p.name} size={18} />
                <Text style={styles.followChipText}>{lastName(p.name)}</Text>
                <Ionicons name="close" size={13} color={colors.textDim} />
              </Pressable>
            ))}
          </ScrollView>
        </Animated.View>
      ) : null}

      {/* results */}
      <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: spacing.md }}>
        {searching ? (
          <View style={styles.searchingRow}><ActivityIndicator size="small" color={colors.blue} /><Text style={styles.searchingText}>Searching The Ticker…</Text></View>
        ) : noneConnected ? (
          <View style={styles.emptyCard}>
            <Ionicons name="planet-outline" size={26} color={colors.blue} />
            <Text style={styles.emptyTitle}>Not connected yet</Text>
            <Text style={styles.emptyText}>We don&apos;t cover “{query.trim()}” on The Ticker yet — but the hockey world is expanding. NHL is live right now.</Text>
          </View>
        ) : wrongType ? (
          <Text style={styles.hintText}>{step.kind === "player" ? "Try a player's name." : "Try a team's name."}</Text>
        ) : shown.length > 0 ? (
          <View style={styles.results}>
            {shown.map((r) => {
              const on = selected(r);
              return (
                <Pressable key={`${r.type}-${r.id}`} style={[styles.resultRow, on && styles.resultRowOn]} onPress={() => pick(r)} testID={`result-${r.type}-${r.id}`}>
                  {r.type === "team" ? <NhlLogo abbr={r.team_abbr} url={r.logo} size={38} /> : <Avatar headshot={r.headshot} name={r.name} size={38} />}
                  <View style={{ flex: 1 }}><Text style={styles.resultName} numberOfLines={1}>{r.name}</Text><Text style={styles.resultSub}>{r.subtitle}</Text></View>
                  <View style={[styles.followBtn, on && styles.followBtnOn]}>
                    <Ionicons name={on ? "checkmark" : "add"} size={16} color={on ? colors.bg : colors.blue} />
                    <Text style={[styles.followBtnText, on && { color: colors.bg }]}>{on ? "ADDED" : "ADD"}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <Text style={styles.hintText}>{step.fav ? "Search and tap to choose." : "Search to add more — or skip."}</Text>
        )}
      </ScrollView>

      {/* footer: skip / advance */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        {step.skippable ? (
          <Pressable style={styles.backBtn} onPress={skip} testID="onboard-skip">
            <Text style={styles.backText}>{si === 2 ? "No player" : "Skip"}</Text>
          </Pressable>
        ) : <View style={{ width: 60 }} />}

        {isLast ? (
          <Pressable style={[styles.cta, count === 0 && styles.ctaDim]} onPress={finish} testID="onboard-finish">
            <Text style={styles.ctaText}>Enter My Ticker</Text><Ionicons name="arrow-forward" size={16} color={colors.white} />
          </Pressable>
        ) : step.fav ? (
          <View style={styles.needPick}><Text style={styles.needPickText}>{step.kind === "team" ? (hasFavTeam ? "Nice." : "Pick your team") : (hasFavPlayer ? "Locked in." : "Pick your player")}</Text></View>
        ) : (
          <Pressable style={styles.cta} onPress={goNext} testID="onboard-next">
            <Text style={styles.ctaText}>Next</Text><Ionicons name="arrow-forward" size={16} color={colors.white} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

function Avatar({ headshot, name, size }: { headshot?: string | null; name: string; size: number }) {
  const [failed, setFailed] = useState(false);
  if (headshot && !failed) {
    return <Image source={headshot} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.surfaceHi }} contentFit="cover" transition={150} onError={() => setFailed(true)} />;
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.surfaceHi, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border }}>
      <Text style={{ color: colors.white, fontFamily: fonts.display, fontSize: size * 0.34, fontWeight: "800" }}>{initials(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.lg },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: spacing.md },
  brand: { color: colors.white, fontFamily: fonts.display, fontSize: 17, fontWeight: "800", letterSpacing: 1 },

  welcomeBody: { flex: 1, justifyContent: "center", gap: spacing.lg },
  deskBig: { height: 300, borderRadius: radius.lg, overflow: "hidden", borderWidth: 1, borderColor: colors.border, justifyContent: "space-between" },
  deskTop: { flexDirection: "row", padding: spacing.md },
  deskTag: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(11,14,21,0.72)", borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  deskTagText: { color: colors.white, fontFamily: fonts.accent, fontSize: 10, fontWeight: "700", letterSpacing: 1.5 },
  deskBottom: { padding: spacing.lg, gap: 6 },
  kicker: { color: colors.blue, fontFamily: fonts.accent, fontSize: 12, fontWeight: "700", letterSpacing: 3 },
  deskTitle: { color: colors.white, fontFamily: fonts.display, fontSize: 32, fontWeight: "800", letterSpacing: 0.5, marginBottom: spacing.sm },
  hostLine: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  hostName: { fontFamily: fonts.display, fontSize: 11, fontWeight: "800", letterSpacing: 1, width: 52, paddingTop: 2 },
  hostText: { flex: 1, color: colors.text, fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19 },
  pitch: { color: colors.textDim, fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },

  deskStrip: { height: 88, borderRadius: radius.md, overflow: "hidden", borderWidth: 1, borderColor: colors.border, justifyContent: "flex-end", marginBottom: spacing.md },
  stripRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.sm },
  dots: { flexDirection: "row", gap: 5 },
  dot: { width: 16, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.22)" },
  dotOn: { backgroundColor: colors.blue },
  dotDone: { backgroundColor: colors.blueDim },

  askLine: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: spacing.md },
  askName: { fontFamily: fonts.display, fontSize: 12, fontWeight: "800", letterSpacing: 1, width: 54, paddingTop: 4 },
  askText: { flex: 1, color: colors.white, fontFamily: fonts.display, fontSize: 22, fontWeight: "800", lineHeight: 27, letterSpacing: 0.2 },

  searchBar: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.lg, paddingHorizontal: spacing.md, height: 50 },
  searchInput: { flex: 1, color: colors.white, fontFamily: fonts.body, fontSize: 16, ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}) },

  followWrap: { marginTop: spacing.sm },
  followRail: { gap: 8, paddingRight: spacing.lg },
  followChip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.surfaceHi, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.blueDim, paddingLeft: 8, paddingRight: 10, paddingVertical: 5 },
  followChipFav: { borderColor: colors.gold },
  followChipText: { color: colors.white, fontFamily: fonts.display, fontSize: 12, fontWeight: "700" },

  searchingRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: spacing.lg },
  searchingText: { color: colors.textDim, fontFamily: fonts.body, fontSize: 14 },
  hintText: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 13, marginTop: spacing.md },

  emptyCard: { alignItems: "center", gap: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.xl, marginTop: spacing.md },
  emptyTitle: { color: colors.white, fontFamily: fonts.display, fontSize: 18, fontWeight: "800", letterSpacing: 0.3 },
  emptyText: { color: colors.textDim, fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20, textAlign: "center" },

  results: { gap: spacing.sm },
  resultRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
  resultRowOn: { borderColor: colors.blue, backgroundColor: colors.surfaceHi },
  resultName: { color: colors.white, fontFamily: fonts.display, fontSize: 16, fontWeight: "700" },
  resultSub: { color: colors.textFaint, fontFamily: fonts.accent, fontSize: 11, fontWeight: "600", letterSpacing: 0.8, marginTop: 2 },
  followBtn: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderColor: colors.blue, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7 },
  followBtnOn: { backgroundColor: colors.blue, borderColor: colors.blue },
  followBtnText: { color: colors.blue, fontFamily: fonts.display, fontSize: 11, fontWeight: "800", letterSpacing: 0.8 },

  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  backBtn: { padding: spacing.sm, minWidth: 60 },
  backText: { color: colors.textDim, fontFamily: fonts.display, fontSize: 14, fontWeight: "700" },
  needPick: { paddingVertical: 12, paddingHorizontal: spacing.md },
  needPickText: { color: colors.textDim, fontFamily: fonts.display, fontSize: 14, fontWeight: "700", letterSpacing: 0.3 },
  cta: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.blue, borderRadius: radius.pill, paddingHorizontal: spacing.xl, paddingVertical: 13 },
  ctaDim: { opacity: 0.55 },
  ctaText: { color: colors.white, fontFamily: fonts.display, fontSize: 15, fontWeight: "800", letterSpacing: 0.5 },

  stepHead: { gap: 5, marginBottom: spacing.lg },
  stepKicker: { color: colors.blue, fontFamily: fonts.accent, fontSize: 11, fontWeight: "700", letterSpacing: 2.5 },
  stepTitle: { color: colors.white, fontFamily: fonts.display, fontSize: 26, fontWeight: "800", letterSpacing: 0.2, lineHeight: 30 },
  stepSub: { color: colors.textDim, fontFamily: fonts.body, fontSize: 14, lineHeight: 20, marginTop: 2 },

  regionGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  regionChip: { width: "47%", flexGrow: 1, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.lg },
  regionChipOn: { backgroundColor: colors.blue, borderColor: colors.blue },
  regionText: { color: colors.white, fontFamily: fonts.display, fontSize: 15, fontWeight: "700", letterSpacing: 0.3 },

  leagueRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  leagueRowOn: { borderColor: colors.blue, backgroundColor: colors.surfaceHi },
  leagueBadge: { backgroundColor: colors.blueDim, borderRadius: radius.sm, paddingHorizontal: 9, paddingVertical: 5, minWidth: 60, alignItems: "center" },
  leagueBadgeOn: { backgroundColor: colors.blue },
  leagueBadgeText: { color: colors.blue, fontFamily: fonts.display, fontSize: 13, fontWeight: "800", letterSpacing: 0.5 },
  leagueName: { color: colors.white, fontFamily: fonts.display, fontSize: 16, fontWeight: "700" },
  leagueTag: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 11.5, marginTop: 1 },
});
