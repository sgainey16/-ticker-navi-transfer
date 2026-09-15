import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

import { colors, fonts, spacing, radius } from "@/src/theme";
import { api, ExploreChoice } from "@/src/lib/api";
import { useApi } from "@/src/lib/useApi";
import { Screen, Loader, ErrorState } from "@/src/components/ui";
import { BackBar } from "@/app/team/[id]";
import { setContextLeague } from "@/src/lib/context";

// EXPLORE — progressive drill-down. ONE generic renderer for EVERY layer of the
// hockey world (country → level/region/league → destination). The tree lives in
// backend/explore_taxonomy.py, so scale comes from data, never from new screens.
// Each screen answers one question: "Where do you want to go next?". Search stays
// on top as the shortcut; real Back retraces the path.
export default function ExploreNode() {
  const { path } = useLocalSearchParams<{ path: string }>();
  const router = useRouter();
  const q = useApi(() => api.exploreNode(path), [path]);
  const [soon, setSoon] = useState<string | null>(null);

  const onChoice = (c: ExploreChoice) => {
    Haptics.selectionAsync();
    if (c.kind === "node" && c.path) {
      router.push(`/explore/node?path=${encodeURIComponent(c.path)}`);
    } else if (c.kind === "league" && c.code) {
      setContextLeague(c.code);
      router.push(`/league/${c.code}`);
    } else {
      setSoon(c.label);
    }
  };

  if (q.loading) return <Screen><BackBar /><Loader label="Opening the hockey world…" /></Screen>;
  if (q.error || !q.data) return <Screen><BackBar /><ErrorState message="Couldn't open this part of the world" onRetry={q.reload} /></Screen>;

  const n = q.data;

  return (
    <Screen>
      <BackBar />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.head}>
          <View style={styles.headTop}>
            <Text style={styles.flag}>{n.flag}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={2}>{n.title}</Text>
              <Text style={styles.sub}>{n.subtitle}</Text>
            </View>
          </View>
        </View>

        {/* Search shortcut — the escape hatch, always available */}
        <Pressable style={styles.search} onPress={() => { Haptics.selectionAsync(); router.push("/search"); }} testID="node-search">
          <Ionicons name="search" size={17} color={colors.blue} />
          <Text style={styles.searchText}>Know where you’re going? Search…</Text>
        </Pressable>

        {n.note ? (
          <View style={styles.note}>
            <Ionicons name="time-outline" size={15} color={colors.gold} />
            <Text style={styles.noteText}>{n.note}</Text>
          </View>
        ) : null}

        {/* Choices — the one next layer */}
        <View style={styles.list}>
          {n.choices.map((c, i) => {
            const avail = c.status === "available";
            const isNode = c.kind === "node";
            const navigable = isNode || c.kind === "league";
            return (
              <Animated.View key={c.path ?? c.code ?? c.label} entering={FadeInDown.delay(i * 25).duration(220)}>
                <Pressable
                  style={[styles.row, !navigable && styles.rowSoon]}
                  onPress={() => onChoice(c)}
                  testID={`node-choice-${c.code ?? c.path ?? c.label}`}
                >
                  <View style={[styles.rowIcon, avail ? styles.rowIconLive : styles.rowIconSoon]}>
                    <Ionicons
                      name={(isNode ? c.icon : "trophy-outline") as any}
                      size={17}
                      color={avail ? colors.blue : colors.textFaint}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowLabel} numberOfLines={1}>{c.label}</Text>
                    {c.sub ? <Text style={styles.rowSub} numberOfLines={1}>{c.sub}</Text> : null}
                  </View>
                  {avail ? (
                    isNode ? <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
                      : <View style={styles.liveTag}><Text style={styles.liveTagText}>LIVE</Text></View>
                  ) : (
                    <View style={styles.soonRight}>
                      <Text style={styles.soonTag}>SOON</Text>
                      {isNode ? <Ionicons name="chevron-forward" size={16} color={colors.textFaint} /> : null}
                    </View>
                  )}
                </Pressable>
              </Animated.View>
            );
          })}
        </View>

        {soon ? (
          <Animated.View entering={FadeIn} style={styles.toast}>
            <Ionicons name="time-outline" size={14} color={colors.gold} />
            <Text style={styles.toastText}>{soon} — confirmed by our provider, coming to Ticker soon.</Text>
            <Pressable onPress={() => setSoon(null)} hitSlop={8}><Ionicons name="close" size={14} color={colors.textFaint} /></Pressable>
          </Animated.View>
        ) : null}

        <View style={{ height: spacing.xxxl }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxxl, gap: spacing.md, paddingTop: spacing.xs },
  head: { paddingHorizontal: spacing.lg },
  headTop: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  flag: { fontSize: 40 },
  title: { color: colors.white, fontFamily: fonts.display, fontSize: 26, fontWeight: "800", letterSpacing: 0.2 },
  sub: { color: colors.textDim, fontFamily: fonts.body, fontSize: 13, marginTop: 2 },

  search: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.blueDim, paddingHorizontal: spacing.md, height: 46 },
  searchText: { flex: 1, color: colors.textDim, fontFamily: fonts.body, fontSize: 13.5 },

  note: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginHorizontal: spacing.lg, backgroundColor: "rgba(245,179,1,0.08)", borderRadius: radius.md, borderWidth: 1, borderColor: "rgba(245,179,1,0.25)", paddingHorizontal: spacing.md, paddingVertical: 11 },
  noteText: { flex: 1, color: colors.text, fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18 },

  list: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: 13, minHeight: 60 },
  rowSoon: { borderStyle: "dashed", backgroundColor: "transparent" },
  rowIcon: { width: 40, height: 40, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  rowIconLive: { backgroundColor: colors.blueDim },
  rowIconSoon: { backgroundColor: colors.surfaceHi },
  rowLabel: { color: colors.white, fontFamily: fonts.display, fontSize: 16, fontWeight: "800", letterSpacing: 0.2 },
  rowSub: { color: colors.textDim, fontFamily: fonts.body, fontSize: 12, marginTop: 1 },
  liveTag: { backgroundColor: colors.blue, borderRadius: 5, paddingHorizontal: 8, paddingVertical: 3 },
  liveTagText: { color: colors.white, fontFamily: fonts.accent, fontSize: 9, fontWeight: "800", letterSpacing: 0.8 },
  soonRight: { flexDirection: "row", alignItems: "center", gap: 4 },
  soonTag: { color: colors.textFaint, fontFamily: fonts.accent, fontSize: 9, fontWeight: "800", letterSpacing: 0.8 },

  toast: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: spacing.lg, backgroundColor: "rgba(245,179,1,0.08)", borderRadius: radius.md, borderWidth: 1, borderColor: "rgba(245,179,1,0.25)", paddingHorizontal: spacing.md, paddingVertical: 10 },
  toastText: { flex: 1, color: colors.text, fontFamily: fonts.body, fontSize: 12.5 },
});
