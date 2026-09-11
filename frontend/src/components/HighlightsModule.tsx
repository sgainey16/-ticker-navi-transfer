import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, Image, ScrollView, Modal, Linking, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import YoutubeInline from "@/src/components/YoutubeInline";

import { colors, fonts, spacing, radius } from "@/src/theme";
import { api, HighlightClip } from "@/src/lib/api";
import { SectionTitle } from "@/src/components/ui";

// module-level cache: re-opening a game is instant and spends no extra API calls
const cache: Record<string, { recap: HighlightClip | null; clips: HighlightClip[] }> = {};

// Verified GAME video package (Highlightly). Full recap first, then any extra clips.
// Renders NOTHING when no verified clip is matched — never a placeholder.
export function HighlightsModule({ league, home, away, date }:
  { league: string; home?: string; away?: string; date?: string }) {
  const key = `${league}:${away}@${home}:${date || ""}`;
  const [pkg, setPkg] = useState(cache[key] || null);
  const [loading, setLoading] = useState(!cache[key]);
  const [active, setActive] = useState<HighlightClip | null>(null);

  useEffect(() => {
    if (!home || !away) { setLoading(false); return; }
    if (cache[key]) { setPkg(cache[key]); setLoading(false); return; }
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const res = await api.matchHighlights({ league, home, away, date });
        const data = { recap: res.recap, clips: res.clips || [] };
        cache[key] = data;
        if (alive) setPkg(data);
      } catch {
        if (alive) setPkg({ recap: null, clips: [] });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [key]);

  if (loading) {
    return (
      <View style={styles.loadWrap}><ActivityIndicator size="small" color={colors.blue} /></View>
    );
  }
  if (!pkg || !pkg.recap) return null;

  const recap = pkg.recap;
  const extras = pkg.clips.filter((c) => String(c.id) !== String(recap.id));

  const open = (clip: HighlightClip) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setActive(clip);                                   // inline player on native AND web
  };

  return (
    <View style={styles.section} testID="highlights-module">
      <SectionTitle title="Highlights" accent={colors.blue} />

      {/* HERO — full game recap */}
      <Pressable style={styles.hero} onPress={() => open(recap)} testID="highlight-hero">
        {recap.thumbnail ? (
          <Image source={{ uri: recap.thumbnail }} style={styles.heroImg} resizeMode="cover" />
        ) : <View style={[styles.heroImg, styles.heroFallback]} />}
        <View style={styles.heroOverlay}>
          <View style={styles.playCircle}><Ionicons name="play" size={26} color={colors.white} /></View>
        </View>
        <View style={styles.heroFoot}>
          <Text style={styles.heroBadge}>GAME RECAP</Text>
          <Text style={styles.heroTitle} numberOfLines={2}>{recap.title}</Text>
          {recap.channel ? <Text style={styles.heroSrc}>via {recap.channel}</Text> : null}
        </View>
      </Pressable>

      {/* MORE CLIPS — same matchup / series */}
      {extras.length ? (
        <View>
          <Text style={styles.railLabel}>MORE FROM THIS MATCHUP</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
            {extras.map((c) => (
              <Pressable key={String(c.id)} style={styles.clip} onPress={() => open(c)}>
                {c.thumbnail ? (
                  <Image source={{ uri: c.thumbnail }} style={styles.clipImg} resizeMode="cover" />
                ) : <View style={[styles.clipImg, styles.heroFallback]} />}
                <View style={styles.clipPlay}><Ionicons name="play" size={14} color={colors.white} /></View>
                <Text style={styles.clipTitle} numberOfLines={2}>{c.title}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <Text style={styles.credit}>Verified video · Highlightly</Text>

      {/* NATIVE inline player */}
      <Modal visible={!!active} animationType="fade" transparent onRequestClose={() => setActive(null)}>
        <View style={styles.modal}>
          <View style={styles.modalHead}>
            <Text style={styles.modalTitle} numberOfLines={1}>{active?.title}</Text>
            <Pressable onPress={() => setActive(null)} hitSlop={12} testID="highlight-close">
              <Ionicons name="close" size={26} color={colors.white} />
            </Pressable>
          </View>
          {active?.youtube_id ? (
            <YoutubeInline videoId={active.youtube_id} height={220} />
          ) : (
            <Pressable style={styles.fallbackBtn} onPress={() => active?.url && Linking.openURL(active.url)}>
              <Text style={styles.fallbackText}>OPEN VIDEO</Text>
            </Pressable>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm, marginTop: spacing.sm },
  loadWrap: { paddingVertical: spacing.lg, alignItems: "center" },

  hero: { borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  heroImg: { width: "100%", aspectRatio: 16 / 9 },
  heroFallback: { backgroundColor: colors.surfaceHi, alignItems: "center", justifyContent: "center" },
  heroOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", top: 0, bottom: 56 },
  playCircle: { width: 58, height: 58, borderRadius: 29, backgroundColor: "rgba(10,12,18,0.66)", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "rgba(255,255,255,0.9)" },
  heroFoot: { padding: spacing.md, gap: 3 },
  heroBadge: { color: colors.blue, fontFamily: fonts.accent, fontSize: 10, fontWeight: "800", letterSpacing: 1.5 },
  heroTitle: { color: colors.text, fontFamily: fonts.display, fontSize: 15, fontWeight: "700", lineHeight: 20 },
  heroSrc: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 11 },

  railLabel: { color: colors.textFaint, fontFamily: fonts.accent, fontSize: 10, fontWeight: "700", letterSpacing: 1.2, marginTop: spacing.sm, marginBottom: 6 },
  rail: { gap: spacing.sm, paddingRight: spacing.md },
  clip: { width: 176 },
  clipImg: { width: 176, height: 99, borderRadius: radius.md, backgroundColor: colors.surfaceHi },
  clipPlay: { position: "absolute", top: 40, left: 78, width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(10,12,18,0.66)", alignItems: "center", justifyContent: "center" },
  clipTitle: { color: colors.textDim, fontFamily: fonts.display, fontSize: 12, fontWeight: "600", lineHeight: 16, marginTop: 5 },

  credit: { color: colors.textFaint, fontFamily: fonts.accent, fontSize: 9, fontWeight: "600", letterSpacing: 1, marginTop: 2 },

  modal: { flex: 1, backgroundColor: "rgba(2,3,6,0.96)", justifyContent: "center", padding: spacing.md, gap: spacing.md },
  modalHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  modalTitle: { color: colors.white, fontFamily: fonts.display, fontSize: 14, fontWeight: "700", flex: 1 },
  fallbackBtn: { backgroundColor: colors.blue, borderRadius: radius.pill, paddingVertical: 14, alignItems: "center" },
  fallbackText: { color: colors.white, fontFamily: fonts.display, fontSize: 14, fontWeight: "800", letterSpacing: 1 },
});
