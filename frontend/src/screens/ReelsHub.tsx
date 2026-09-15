import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Image, Modal, Linking, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import YoutubeInline from "@/src/components/YoutubeInline";

import { colors, fonts, spacing, radius } from "@/src/theme";
import { api, ReelClip, ReelCollection } from "@/src/lib/api";
import { useContextLeague } from "@/src/lib/context";
import { TabScreen, Loader } from "@/src/components/ui";

// GAMES -> REELS: TICKER-CURATED verified video within the league you're viewing.
// Reels INHERITS the active league (shared context across NEXT/RECAP/REELS/STATS) —
// no league picker here. A basic search stays scoped to the active league only.
// This is a curated experience, NOT a build-your-own-package tool: user-directed
// custom video intelligence is reserved for Betting IQ (not built). The compilation
// engine underneath (category/keyword/team/date) is preserved for that future.
export default function ReelsHub() {
  const router = useRouter();
  const [league] = useContextLeague();
  const [q, setQ] = useState("");
  const [collections, setCollections] = useState<ReelCollection[] | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<ReelClip[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [active, setActive] = useState<ReelClip | null>(null);

  // Browse feed for the ACTIVE (inherited) league
  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.reels(league, 40)
      .then((r) => { if (alive) { setCollections(r.collections); setEnabled(r.enabled); } })
      .catch(() => { if (alive) setCollections([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [league]);

  // Debounced highlight search — ACTIVE LEAGUE ONLY (no cross-league picker here)
  useEffect(() => {
    if (q.trim().length < 2) { setResults(null); setSearching(false); return; }
    setSearching(true);
    const t = setTimeout(() => {
      api.reelsSearch(q.trim(), league, "league", 40)
        .then((r) => setResults(r.results))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 220);
    return () => clearTimeout(t);
  }, [q, league]);

  const play = (c: ReelClip) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setActive(c); };
  const goTeam = (abbr?: string | null) => { if (!abbr) return; Haptics.selectionAsync(); router.push(`/team/${abbr}${league !== "nhl" ? `?league=${league}` : ""}`); };
  const goGame = (c: ReelClip) => { if (!c.game_id) return; Haptics.selectionAsync(); router.push(`/game/${c.game_id}${(c.league_code || league) !== "nhl" ? `?league=${c.league_code || league}` : ""}`); };

  const searchActive = q.trim().length >= 2;

  return (
    <TabScreen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" stickyHeaderIndices={[0]}>
        {/* SEARCH HIGHLIGHTS (active league) + inherited-league label */}
        <View style={styles.controls}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={18} color={colors.textDim} />
            <TextInput
              testID="reels-search"
              value={q}
              onChangeText={setQ}
              placeholder={`Search ${league.toUpperCase()} highlights`}
              placeholderTextColor={colors.textFaint}
              style={styles.searchInput}
              returnKeyType="search"
            />
            {q ? <Pressable onPress={() => setQ("")} hitSlop={10}><Ionicons name="close-circle" size={18} color={colors.textFaint} /></Pressable> : null}
          </View>
          <View style={styles.ctxRow}>
            <View style={styles.lgBadge}><Text style={styles.lgBadgeText}>{league.toUpperCase()}</Text></View>
            <Text style={styles.ctxText}>{searchActive ? `Searching ${league.toUpperCase()} video` : "Ticker-curated reels"}</Text>
          </View>
        </View>

        {/* SEARCH RESULTS */}
        {searchActive ? (
          searching ? <Loader label="Searching verified video…" /> : (
            (results && results.length) ? (
              <View style={styles.section}>
                <Text style={styles.resultCount}>{results.length} verified clip{results.length === 1 ? "" : "s"}</Text>
                {results.map((c) => <ClipRow key={String(c.id)} c={c} onPlay={play} onTeam={goTeam} onGame={goGame} />)}
              </View>
            ) : (
              <View style={styles.empty}>
                <Ionicons name="videocam-off-outline" size={26} color={colors.textFaint} />
                <Text style={styles.emptyText}>No verified {league.toUpperCase()} video for “{q.trim()}”.</Text>
              </View>
            )
          )
        ) : loading ? (
          <Loader label="Loading highlights…" />
        ) : !enabled ? (
          <View style={styles.empty}><Ionicons name="cloud-offline-outline" size={26} color={colors.textFaint} /><Text style={styles.emptyText}>Video source is not connected right now.</Text></View>
        ) : (collections && collections.length) ? (
          <View style={{ gap: spacing.lg }}>
            {collections.map((col) => (
              <View key={col.key} style={styles.section}>
                <Text style={styles.railLabel}>{col.label}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
                  {col.clips.map((c) => <ClipCard key={String(c.id)} c={c} onPlay={play} onTeam={goTeam} onGame={goGame} />)}
                </ScrollView>
              </View>
            ))}
            <Text style={styles.credit}>Verified video · Highlightly</Text>
          </View>
        ) : (
          <View style={styles.empty}><Ionicons name="videocam-off-outline" size={26} color={colors.textFaint} /><Text style={styles.emptyText}>No verified video for {league.toUpperCase()} right now.</Text></View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Playback INSIDE The Ticker (YouTube). Non-embeddable sources fall back to open. */}
      <Modal visible={!!active} animationType="fade" transparent onRequestClose={() => setActive(null)}>
        <View style={styles.modal}>
          <View style={styles.modalHead}>
            <Text style={styles.modalTitle} numberOfLines={1}>{active?.title}</Text>
            <Pressable onPress={() => setActive(null)} hitSlop={12} testID="reels-close"><Ionicons name="close" size={26} color={colors.white} /></Pressable>
          </View>
          {active?.youtube_id ? (
            <YoutubeInline videoId={active.youtube_id} height={220} />
          ) : (
            <Pressable style={styles.fallbackBtn} onPress={() => active?.url && Linking.openURL(active.url)}>
              <Ionicons name="open-outline" size={16} color={colors.white} />
              <Text style={styles.fallbackText}>OPEN VIDEO{active?.channel ? ` · ${active.channel}` : ""}</Text>
            </Pressable>
          )}
          {active && (active.away_abbr || active.home_abbr || active.game_id) ? (
            <View style={styles.modalNav}>
              {active.away_abbr ? <Pressable style={styles.navChip} onPress={() => { setActive(null); goTeam(active.away_abbr); }}><Text style={styles.navChipText}>{active.away_abbr}</Text></Pressable> : null}
              {active.home_abbr ? <Pressable style={styles.navChip} onPress={() => { setActive(null); goTeam(active.home_abbr); }}><Text style={styles.navChipText}>{active.home_abbr}</Text></Pressable> : null}
              {active.game_id ? <Pressable style={[styles.navChip, styles.navChipGame]} onPress={() => { const c = active; setActive(null); goGame(c); }} testID="reels-viewgame"><Ionicons name="tv-outline" size={13} color={colors.white} /><Text style={styles.navChipText}>View Game</Text></Pressable> : null}
            </View>
          ) : null}
        </View>
      </Modal>
    </TabScreen>
  );
}

// Horizontal browse card
function ClipCard({ c, onPlay, onTeam, onGame }: { c: ReelClip; onPlay: (c: ReelClip) => void; onTeam: (a?: string | null) => void; onGame: (c: ReelClip) => void }) {
  return (
    <View style={styles.card}>
      <Pressable onPress={() => onPlay(c)} testID={`reel-${c.id}`}>
        {c.thumbnail ? <Image source={{ uri: c.thumbnail }} style={styles.thumb} resizeMode="cover" /> : <View style={[styles.thumb, styles.thumbFallback]} />}
        <View style={styles.playDot}><Ionicons name="play" size={14} color={colors.white} /></View>
        {!c.playable ? <View style={styles.extBadge}><Ionicons name="open-outline" size={10} color={colors.white} /></View> : null}
      </Pressable>
      <Text style={styles.cardTitle} numberOfLines={2}>{c.title}</Text>
      <View style={styles.cardNav}>
        {c.away_abbr ? <Pressable style={styles.crestChip} onPress={() => onTeam(c.away_abbr)} testID={`crest-${c.away_abbr}`}><Text style={styles.crestText}>{c.away_abbr}</Text></Pressable> : null}
        {c.home_abbr ? <Pressable style={styles.crestChip} onPress={() => onTeam(c.home_abbr)} testID={`crest-${c.home_abbr}`}><Text style={styles.crestText}>{c.home_abbr}</Text></Pressable> : null}
        {c.game_id ? <Pressable style={styles.gameChip} onPress={() => onGame(c)}><Text style={styles.gameChipText}>GAME</Text></Pressable> : null}
      </View>
    </View>
  );
}

// Vertical search-result row
function ClipRow({ c, onPlay, onTeam, onGame }: { c: ReelClip; onPlay: (c: ReelClip) => void; onTeam: (a?: string | null) => void; onGame: (c: ReelClip) => void }) {
  return (
    <View style={styles.row}>
      <Pressable onPress={() => onPlay(c)} testID={`reel-${c.id}`}>
        {c.thumbnail ? <Image source={{ uri: c.thumbnail }} style={styles.rowThumb} resizeMode="cover" /> : <View style={[styles.rowThumb, styles.thumbFallback]} />}
        <View style={styles.rowPlay}><Ionicons name="play" size={12} color={colors.white} /></View>
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle} numberOfLines={2}>{c.title}</Text>
        <View style={styles.cardNav}>
          {c.league_code ? <Text style={styles.rowLg}>{c.league_code.toUpperCase()}</Text> : null}
          {c.away_abbr ? <Pressable style={styles.crestChip} onPress={() => onTeam(c.away_abbr)} testID={`crest-${c.away_abbr}`}><Text style={styles.crestText}>{c.away_abbr}</Text></Pressable> : null}
          {c.home_abbr ? <Pressable style={styles.crestChip} onPress={() => onTeam(c.home_abbr)} testID={`crest-${c.home_abbr}`}><Text style={styles.crestText}>{c.home_abbr}</Text></Pressable> : null}
          {c.game_id ? <Pressable style={styles.gameChip} onPress={() => onGame(c)}><Text style={styles.gameChipText}>GAME</Text></Pressable> : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 110, gap: spacing.lg },
  controls: { backgroundColor: colors.bg, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.sm, gap: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, height: 44 },
  searchInput: { flex: 1, color: colors.white, fontFamily: fonts.body, fontSize: 14, paddingVertical: 0 },
  ctxRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 2 },
  lgBadge: { backgroundColor: colors.blueDim, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3 },
  lgBadgeText: { color: colors.blue, fontFamily: fonts.display, fontSize: 11, fontWeight: "800", letterSpacing: 0.8 },
  ctxText: { color: colors.textDim, fontFamily: fonts.body, fontSize: 12 },

  section: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  railLabel: { color: colors.white, fontFamily: fonts.display, fontSize: 15, fontWeight: "800", letterSpacing: 1 },
  rail: { gap: spacing.md, paddingRight: spacing.lg },
  resultCount: { color: colors.textFaint, fontFamily: fonts.accent, fontSize: 10, fontWeight: "700", letterSpacing: 1.2 },
  credit: { color: colors.textFaint, fontFamily: fonts.accent, fontSize: 9, fontWeight: "600", letterSpacing: 1, paddingHorizontal: spacing.lg },

  card: { width: 208 },
  thumb: { width: 208, height: 117, borderRadius: radius.md, backgroundColor: colors.surfaceHi },
  thumbFallback: { alignItems: "center", justifyContent: "center" },
  playDot: { position: "absolute", top: 44, left: 90, width: 30, height: 30, borderRadius: 15, backgroundColor: "rgba(10,12,18,0.66)", alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.9)" },
  extBadge: { position: "absolute", top: 8, right: 8, backgroundColor: "rgba(10,12,18,0.7)", borderRadius: 8, paddingHorizontal: 5, paddingVertical: 3 },
  cardTitle: { color: colors.text, fontFamily: fonts.display, fontSize: 12.5, fontWeight: "600", lineHeight: 16, marginTop: 6 },
  cardNav: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6, flexWrap: "wrap" },
  crestChip: { backgroundColor: colors.blueDim, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3 },
  crestText: { color: colors.blue, fontFamily: fonts.display, fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  gameChip: { backgroundColor: colors.surfaceHi, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: colors.border },
  gameChipText: { color: colors.textDim, fontFamily: fonts.display, fontSize: 10.5, fontWeight: "800", letterSpacing: 0.5 },
  rowLg: { color: colors.textFaint, fontFamily: fonts.accent, fontSize: 10, fontWeight: "700", letterSpacing: 1 },

  row: { flexDirection: "row", gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.sm },
  rowThumb: { width: 120, height: 68, borderRadius: radius.sm, backgroundColor: colors.surfaceHi },
  rowPlay: { position: "absolute", top: 24, left: 48, width: 24, height: 24, borderRadius: 12, backgroundColor: "rgba(10,12,18,0.66)", alignItems: "center", justifyContent: "center" },
  rowTitle: { color: colors.text, fontFamily: fonts.display, fontSize: 13, fontWeight: "600", lineHeight: 17 },

  empty: { alignItems: "center", gap: 8, paddingVertical: spacing.xxxl, paddingHorizontal: spacing.lg },
  emptyText: { color: colors.textDim, fontFamily: fonts.body, fontSize: 13.5, textAlign: "center" },

  modal: { flex: 1, backgroundColor: "rgba(2,3,6,0.96)", justifyContent: "center", padding: spacing.md, gap: spacing.md },
  modalHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  modalTitle: { color: colors.white, fontFamily: fonts.display, fontSize: 14, fontWeight: "700", flex: 1 },
  modalNav: { flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "center" },
  navChip: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.blueDim, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8 },
  navChipGame: { backgroundColor: colors.blue },
  navChipText: { color: colors.white, fontFamily: fonts.display, fontSize: 12.5, fontWeight: "800", letterSpacing: 0.5 },
  fallbackBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.blue, borderRadius: radius.pill, paddingVertical: 14 },
  fallbackText: { color: colors.white, fontFamily: fonts.display, fontSize: 13, fontWeight: "800", letterSpacing: 0.8 },
});
