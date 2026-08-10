import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { colors, fonts, spacing, radius } from "@/src/theme";
import { api, Star } from "@/src/lib/api";
import { useApi } from "@/src/lib/useApi";
import { TeamLogo } from "@/src/components/TeamLogo";

const ACCENTS: Record<string, string> = { gold: colors.gold, blue: colors.blue, green: colors.green };

export function StarSpotlight() {
  const router = useRouter();
  const q = useApi(() => api.stars());
  if (q.loading || q.error || !q.data) return null;

  return (
    <View style={styles.wrap} testID="star-spotlight">
      <View style={styles.header}>
        <View style={[styles.bar, { backgroundColor: colors.gold }]} />
        <Text style={styles.title}>STARS OF THE LEAGUE</Text>
        <Text style={styles.sub}>THE FACES OF MASL</Text>
      </View>
      {q.data.stars.map((s, i) => (
        <StarCard key={s.player_id} star={s} rank={i + 1} onPress={() => { Haptics.selectionAsync(); router.push(`/player/${s.player_id}`); }} />
      ))}
    </View>
  );
}

function StarCard({ star, rank, onPress }: { star: Star; rank: number; onPress: () => void }) {
  const accent = ACCENTS[star.accent] || colors.green;
  return (
    <Pressable style={[styles.card, { borderColor: accent + "55" }]} onPress={onPress} testID={`star-${star.player_id}`}>
      <Text style={[styles.watermark, { color: accent + "14" }]}>{rank}</Text>
      <View style={styles.top}>
        <TeamLogo abbr={star.team?.abbr || ""} primary={star.team?.primary || accent} secondary={star.team?.secondary} size={52} />
        <View style={styles.topMid}>
          <View style={[styles.tag, { backgroundColor: accent }]}>
            <Text style={styles.tagText}>{star.tag}</Text>
          </View>
          <Text style={styles.name} numberOfLines={1}>{star.player.name}</Text>
          <Text style={styles.meta}>#{star.player.number} · {star.player.position} · {star.team?.short}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: accent }]}>{star.stat_value}</Text>
          <Text style={styles.statLabel}>{star.stat_label}</Text>
        </View>
      </View>
      <Text style={[styles.tagline, { color: accent }]}>{star.tagline}</Text>
      <Text style={styles.spotlight}>{star.spotlight}</Text>
      <View style={styles.cta}>
        <Text style={styles.ctaText}>VIEW PROFILE</Text>
        <Ionicons name="chevron-forward" size={14} color={colors.textDim} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md, marginBottom: spacing.xl },
  header: { gap: 2 },
  bar: { width: 40, height: 4, borderRadius: 2, marginBottom: 4 },
  title: { color: colors.white, fontFamily: fonts.display, fontSize: 24, fontWeight: "800", letterSpacing: 0.5 },
  sub: { color: colors.textDim, fontFamily: fonts.accent, fontSize: 11, fontWeight: "700", letterSpacing: 2 },

  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg, overflow: "hidden" },
  watermark: { position: "absolute", right: 8, top: -18, fontFamily: fonts.display, fontSize: 130, fontWeight: "800" },
  top: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  topMid: { flex: 1, gap: 3 },
  tag: { alignSelf: "flex-start", borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  tagText: { color: colors.bg, fontFamily: fonts.display, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  name: { color: colors.white, fontFamily: fonts.display, fontSize: 22, fontWeight: "800", letterSpacing: 0.3 },
  meta: { color: colors.textDim, fontFamily: fonts.body, fontSize: 12 },
  statBox: { alignItems: "center", minWidth: 54 },
  statValue: { fontFamily: fonts.display, fontSize: 34, fontWeight: "800", lineHeight: 36 },
  statLabel: { color: colors.textFaint, fontFamily: fonts.accent, fontSize: 9, fontWeight: "700", letterSpacing: 1 },

  tagline: { fontFamily: fonts.display, fontSize: 15, fontWeight: "800", marginTop: spacing.md, letterSpacing: 0.3 },
  spotlight: { color: colors.textDim, fontFamily: fonts.body, fontSize: 13, lineHeight: 20, marginTop: 4 },
  cta: { flexDirection: "row", alignItems: "center", gap: 2, marginTop: spacing.md },
  ctaText: { color: colors.textDim, fontFamily: fonts.display, fontSize: 12, fontWeight: "700", letterSpacing: 1 },
});
