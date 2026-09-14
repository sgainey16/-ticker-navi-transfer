import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { colors, fonts, spacing, radius } from "@/src/theme";
import { api, SearchResult } from "@/src/lib/api";
import { Screen } from "@/src/components/ui";
import { BackBar } from "@/app/team/[id]";
import { NhlLogo } from "@/src/components/NhlLogo";

// Universal in-app hockey search. Exposes search_all. Every result navigates by STABLE
// id + league_code (never by name) — so any supported league/team/player is reachable,
// follow or not.
export default function SearchScreen() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef<any>(null);
  const runId = useRef(0);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) { setResults([]); setLoading(false); return; }
    setLoading(true);
    const id = ++runId.current;
    timer.current = setTimeout(async () => {
      try { const r = await api.search(q); if (runId.current === id) setResults(r.results); }
      catch { if (runId.current === id) setResults([]); }
      finally { if (runId.current === id) setLoading(false); }
    }, 120);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [q]);

  const open = (r: SearchResult) => {
    const lg = (r.league_code || "nhl").toLowerCase();
    if (r.type === "league") {
      router.push(`/league/${lg}`);
    } else if (r.type === "team") {
      const tid = r.team_abbr || r.id;
      router.push(`/team/${tid}${lg !== "nhl" ? `?league=${lg}` : ""}`);
    } else {
      const pid = r.player_id || r.id;
      const qs = lg !== "nhl"
        ? `?league=${lg}&name=${encodeURIComponent(r.name)}&pos=${encodeURIComponent(r.pos || "")}`
        : "";
      router.push(`/player/${pid}${qs}`);
    }
  };

  return (
    <Screen>
      <BackBar />
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={colors.textDim} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search any team or player…"
          placeholderTextColor={colors.textFaint}
          style={styles.input}
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          testID="search-input"
        />
        {q.length ? (
          <Pressable onPress={() => setQ("")} hitSlop={8}><Ionicons name="close-circle" size={18} color={colors.textFaint} /></Pressable>
        ) : null}
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {loading ? <ActivityIndicator color={colors.blue} style={{ marginTop: 24 }} /> : null}
        {!loading && q.trim().length < 2 ? (
          <Text style={styles.hint}>Type a team or player from any league — NHL, WHL, OHL, QMJHL or NCAA.</Text>
        ) : null}
        {!loading && q.trim().length >= 2 && results.length === 0 ? (
          <Text style={styles.hint}>No matches. Try a full team or player name.</Text>
        ) : null}
        {results.map((r) => (
          <Pressable key={`${r.type}-${r.id}`} style={styles.row} onPress={() => open(r)} testID={`search-result-${r.id}`}>
            {r.type === "team"
              ? <NhlLogo abbr={r.team_abbr || r.id} url={r.logo} size={30} />
              : r.type === "league"
              ? <View style={styles.leagueBadge}><Text style={styles.leagueBadgeText}>{(r.league_code || r.id).toUpperCase()}</Text></View>
              : (r.headshot ? <Image source={r.headshot} style={styles.shot} contentFit="cover" /> : <View style={styles.shot} />)}
            <View style={{ flex: 1 }}>
              <Text style={styles.rName} numberOfLines={1}>{r.name}</Text>
              <Text style={styles.rSub} numberOfLines={1}>{r.type === "league" ? "League hub" : (r.subtitle || r.league)}</Text>
            </View>
            <Text style={styles.rLg}>{(r.league_code || r.league || "").toUpperCase()}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
          </Pressable>
        ))}
        <View style={{ height: 40 }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchWrap: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: spacing.lg, marginTop: spacing.xs, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.blueDim, paddingHorizontal: spacing.md, height: 46 },
  input: { flex: 1, color: colors.white, fontFamily: fonts.body, fontSize: 15 },
  content: { padding: spacing.lg, gap: spacing.sm },
  hint: { color: colors.textDim, fontFamily: fonts.body, fontSize: 13, lineHeight: 19, marginTop: spacing.md, textAlign: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  shot: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.surfaceHi },
  leagueBadge: { width: 44, height: 30, borderRadius: radius.sm, backgroundColor: colors.blueDim, alignItems: "center", justifyContent: "center" },
  leagueBadgeText: { color: colors.blue, fontFamily: fonts.display, fontSize: 12, fontWeight: "800", letterSpacing: 0.5 },
  rName: { color: colors.white, fontFamily: fonts.display, fontSize: 15, fontWeight: "700" },
  rSub: { color: colors.textDim, fontFamily: fonts.body, fontSize: 12, marginTop: 1 },
  rLg: { color: colors.blue, fontFamily: fonts.accent, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
});
