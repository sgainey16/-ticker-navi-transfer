import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, TextInput, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { colors, fonts, spacing, radius } from "@/src/theme";
import { api, SearchResult } from "@/src/lib/api";
import { useFollows, Follows } from "@/src/lib/follows";
import { NhlLogo } from "@/src/components/NhlLogo";
import { TickerMark } from "@/src/components/TickerLogo";

const DESK = require("../assets/images/broadcast-desk.png");

type TeamPick = { abbr: string; name: string; logo?: string | null };
type PlayerPick = { player_id: string; team_abbr: string; name: string; pos?: string; headshot?: string | null };

const SUGGESTIONS = ["Montréal Canadiens", "Connor Bedard", "WHL", "Kamloops", "Swiss National League"];

function lastName(name: string) {
  const p = name.trim().split(/\s+/);
  return p[p.length - 1] || name;
}
function initials(name: string) {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] || "") + (p[p.length - 1]?.[0] || "")).toUpperCase();
}

export default function Onboarding() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { reset } = useLocalSearchParams<{ reset?: string }>();
  const { completeOnboarding, resetOnboarding } = useFollows();

  const [phase, setPhase] = useState<"welcome" | "build">("welcome");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [teams, setTeams] = useState<Record<string, TeamPick>>({});
  const [players, setPlayers] = useState<Record<string, PlayerPick>>({});

  const runId = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { if (reset === "1") resetOnboarding(); }, [reset, resetOnboarding]);

  // Debounced universal search — verified providers only, never fabricated.
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
    }, 250);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [query]);

  const isSel = (r: SearchResult) =>
    r.type === "team" ? !!teams[r.team_abbr || ""] : !!players[r.player_id || ""];

  const toggle = (r: SearchResult) => {
    Haptics.selectionAsync();
    if (r.type === "team" && r.team_abbr) {
      setTeams((prev) => {
        const n = { ...prev };
        if (n[r.team_abbr!]) delete n[r.team_abbr!];
        else n[r.team_abbr!] = { abbr: r.team_abbr!, name: r.name, logo: r.logo };
        return n;
      });
    } else if (r.type === "player" && r.player_id) {
      setPlayers((prev) => {
        const n = { ...prev };
        if (n[r.player_id!]) delete n[r.player_id!];
        else n[r.player_id!] = { player_id: r.player_id!, team_abbr: r.team_abbr || "", name: r.name, pos: r.pos, headshot: r.headshot };
        return n;
      });
    }
  };

  const removeTeam = (abbr: string) => { Haptics.selectionAsync(); setTeams((p) => { const n = { ...p }; delete n[abbr]; return n; }); };
  const removePlayer = (pid: string) => { Haptics.selectionAsync(); setPlayers((p) => { const n = { ...p }; delete n[pid]; return n; }); };

  const teamList = useMemo(() => Object.values(teams), [teams]);
  const playerList = useMemo(() => Object.values(players), [players]);
  const count = teamList.length + playerList.length;

  const finish = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const follows: Follows = {
      teams: teamList.map((t) => ({ abbr: t.abbr, name: t.name })),
      players: playerList.map((p) => ({ player_id: p.player_id, team_abbr: p.team_abbr, name: p.name, pos: p.pos })),
    };
    await completeOnboarding(follows);
    router.replace("/");
  };

  // ---------- WELCOME ----------
  if (phase === "welcome") {
    return (
      <View style={[styles.root, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.brandRow}>
          <TickerMark size={26} />
          <Text style={styles.brand}>THE TICKER</Text>
        </View>

        <View style={styles.welcomeBody}>
          <View style={styles.desk}>
            <Image source={DESK} style={StyleSheet.absoluteFill} contentFit="cover" />
            <LinearGradient
              colors={["rgba(5,7,12,0.15)", "rgba(5,7,12,0.62)", "rgba(5,7,12,0.98)"]}
              locations={[0, 0.5, 1]}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.deskTop}>
              <View style={styles.deskTag}>
                <Ionicons name="mic" size={11} color={colors.blue} />
                <Text style={styles.deskTagText}>REGGIE + MARC</Text>
              </View>
            </View>
            <View style={styles.deskBottom}>
              <Text style={styles.kicker}>WELCOME TO</Text>
              <Text style={styles.deskTitle}>THE TICKER</Text>
              <View style={styles.hostLine}>
                <Text style={[styles.hostName, { color: colors.gold }]}>REGGIE</Text>
                <Text style={styles.hostText}>Alright. Let&apos;s build your hockey world.</Text>
              </View>
              <View style={styles.hostLine}>
                <Text style={[styles.hostName, { color: "#9AA6B8" }]}>MARC</Text>
                <Text style={styles.hostText}>Teams, players, leagues — start wherever you want.</Text>
              </View>
            </View>
          </View>

          <Text style={styles.pitch}>
            The Ticker knows the hockey you care about — then Reggie and Marc bring that world to life.
          </Text>
        </View>

        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <View />
          <Pressable style={styles.cta} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setPhase("build"); }} testID="welcome-go">
            <Text style={styles.ctaText}>Let&apos;s go</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.white} />
          </Pressable>
        </View>
      </View>
    );
  }

  // ---------- BUILD (search) ----------
  const showSuggestions = query.trim().length < 2;
  const emptyMatch = query.trim().length >= 2 && !searching && results.length === 0;

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.brandRow}>
        <TickerMark size={22} />
        <Text style={[styles.brand, { fontSize: 15 }]}>THE TICKER</Text>
      </View>

      <Text style={styles.title}>What hockey do{"\n"}you care about?</Text>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={colors.textDim} />
        <TextInput
          testID="onboard-search"
          value={query}
          onChangeText={setQuery}
          placeholder="Search any league, team or player…"
          placeholderTextColor={colors.textFaint}
          style={styles.searchInput}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {query.length > 0 ? (
          <Pressable hitSlop={10} onPress={() => setQuery("")}>
            <Ionicons name="close-circle" size={18} color={colors.textDim} />
          </Pressable>
        ) : null}
      </View>

      {/* selected follows */}
      {count > 0 ? (
        <View style={styles.followWrap}>
          <Text style={styles.followLabel}>FOLLOWING · {count}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.followRail} keyboardShouldPersistTaps="handled">
            {teamList.map((t) => (
              <Pressable key={`t${t.abbr}`} style={styles.followChip} onPress={() => removeTeam(t.abbr)}>
                <NhlLogo abbr={t.abbr} url={t.logo} size={18} />
                <Text style={styles.followChipText}>{t.abbr}</Text>
                <Ionicons name="close" size={13} color={colors.textDim} />
              </Pressable>
            ))}
            {playerList.map((p) => (
              <Pressable key={`p${p.player_id}`} style={styles.followChip} onPress={() => removePlayer(p.player_id)}>
                <Avatar headshot={p.headshot} name={p.name} size={18} />
                <Text style={styles.followChipText}>{lastName(p.name)}</Text>
                <Ionicons name="close" size={13} color={colors.textDim} />
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.xl }}>
        {showSuggestions ? (
          <View style={styles.suggestBlock}>
            <Text style={styles.suggestHint}>Try a team, a player, or a league</Text>
            <View style={styles.suggestWrap}>
              {SUGGESTIONS.map((s) => (
                <Pressable key={s} style={styles.suggestChip} onPress={() => setQuery(s)} testID={`suggest-${s}`}>
                  <Ionicons name="sparkles-outline" size={12} color={colors.blue} />
                  <Text style={styles.suggestText}>{s}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.expanding}>
              The Ticker is being built for the entire hockey world. NHL is live today — more leagues are on the way.
            </Text>
          </View>
        ) : searching ? (
          <View style={styles.searchingRow}>
            <ActivityIndicator size="small" color={colors.blue} />
            <Text style={styles.searchingText}>Searching The Ticker…</Text>
          </View>
        ) : emptyMatch ? (
          <View style={styles.emptyCard}>
            <Ionicons name="planet-outline" size={26} color={colors.blue} />
            <Text style={styles.emptyTitle}>Not connected yet</Text>
            <Text style={styles.emptyText}>
              We don&apos;t cover “{query.trim()}” on The Ticker yet — but the hockey world is expanding. NHL is live right now.
            </Text>
          </View>
        ) : (
          <View style={styles.results}>
            {results.map((r) => {
              const on = isSel(r);
              return (
                <Pressable
                  key={`${r.type}-${r.id}`}
                  style={[styles.resultRow, on && styles.resultRowOn]}
                  onPress={() => toggle(r)}
                  testID={`result-${r.type}-${r.id}`}
                >
                  {r.type === "team"
                    ? <NhlLogo abbr={r.team_abbr} url={r.logo} size={38} />
                    : <Avatar headshot={r.headshot} name={r.name} size={38} />}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.resultName} numberOfLines={1}>{r.name}</Text>
                    <Text style={styles.resultSub}>{r.subtitle}</Text>
                  </View>
                  <View style={[styles.followBtn, on && styles.followBtnOn]}>
                    <Ionicons name={on ? "checkmark" : "add"} size={16} color={on ? colors.bg : colors.blue} />
                    <Text style={[styles.followBtnText, on && { color: colors.bg }]}>{on ? "FOLLOWING" : "FOLLOW"}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Pressable style={styles.backBtn} onPress={() => setPhase("welcome")}>
          <Ionicons name="chevron-back" size={18} color={colors.textDim} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Pressable style={[styles.cta, count === 0 && styles.ctaDim]} onPress={finish} testID="onboard-finish">
          <Text style={styles.ctaText}>{count > 0 ? "Enter My Ticker" : "Enter The Ticker"}</Text>
          <Ionicons name="arrow-forward" size={16} color={colors.white} />
        </Pressable>
      </View>
    </View>
  );
}

function Avatar({ headshot, name, size }: { headshot?: string | null; name: string; size: number }) {
  const [failed, setFailed] = useState(false);
  if (headshot && !failed) {
    return (
      <Image
        source={headshot}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.surfaceHi }}
        contentFit="cover"
        transition={150}
        onError={() => setFailed(true)}
      />
    );
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

  // welcome
  welcomeBody: { flex: 1, justifyContent: "center", gap: spacing.lg },
  desk: { height: 300, borderRadius: radius.lg, overflow: "hidden", borderWidth: 1, borderColor: colors.border, justifyContent: "space-between" },
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

  // build / search
  title: { color: colors.white, fontFamily: fonts.display, fontSize: 30, fontWeight: "800", lineHeight: 34, letterSpacing: 0.3, marginBottom: spacing.lg },
  searchBar: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.lg, paddingHorizontal: spacing.md, height: 52 },
  searchInput: { flex: 1, color: colors.white, fontFamily: fonts.body, fontSize: 16, ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}) },

  followWrap: { marginTop: spacing.md },
  followLabel: { color: colors.textFaint, fontFamily: fonts.accent, fontSize: 10, fontWeight: "700", letterSpacing: 1.5, marginBottom: 8 },
  followRail: { gap: 8, paddingRight: spacing.lg },
  followChip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.surfaceHi, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.blueDim, paddingLeft: 6, paddingRight: 10, paddingVertical: 5 },
  followChipText: { color: colors.white, fontFamily: fonts.display, fontSize: 12, fontWeight: "700" },

  suggestBlock: { marginTop: spacing.lg, gap: spacing.md },
  suggestHint: { color: colors.textDim, fontFamily: fonts.body, fontSize: 13 },
  suggestWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  suggestChip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.surface, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 9 },
  suggestText: { color: colors.text, fontFamily: fonts.body, fontSize: 13.5 },
  expanding: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 12, lineHeight: 18, marginTop: spacing.sm },

  searchingRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: spacing.xl },
  searchingText: { color: colors.textDim, fontFamily: fonts.body, fontSize: 14 },

  emptyCard: { alignItems: "center", gap: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.xl, marginTop: spacing.lg },
  emptyTitle: { color: colors.white, fontFamily: fonts.display, fontSize: 18, fontWeight: "800", letterSpacing: 0.3 },
  emptyText: { color: colors.textDim, fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20, textAlign: "center" },

  results: { marginTop: spacing.md, gap: spacing.sm },
  resultRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
  resultRowOn: { borderColor: colors.blue, backgroundColor: colors.surfaceHi },
  resultName: { color: colors.white, fontFamily: fonts.display, fontSize: 16, fontWeight: "700" },
  resultSub: { color: colors.textFaint, fontFamily: fonts.accent, fontSize: 11, fontWeight: "600", letterSpacing: 0.8, marginTop: 2 },
  followBtn: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderColor: colors.blue, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7 },
  followBtnOn: { backgroundColor: colors.blue, borderColor: colors.blue },
  followBtnText: { color: colors.blue, fontFamily: fonts.display, fontSize: 11, fontWeight: "800", letterSpacing: 0.8 },

  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 2, padding: spacing.sm },
  backText: { color: colors.textDim, fontFamily: fonts.display, fontSize: 14, fontWeight: "700" },
  cta: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.blue, borderRadius: radius.pill, paddingHorizontal: spacing.xl, paddingVertical: 13 },
  ctaDim: { opacity: 0.55 },
  ctaText: { color: colors.white, fontFamily: fonts.display, fontSize: 15, fontWeight: "800", letterSpacing: 0.5 },
});
