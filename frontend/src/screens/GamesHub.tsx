import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import * as Haptics from "expo-haptics";

import { colors, fonts, spacing, radius } from "@/src/theme";
import { TabScreen } from "@/src/components/ui";
import TonightScreen from "@/src/screens/TonightScreen";
import RecapScreen from "@/src/screens/RecapScreen";
import StatsScreen from "@/src/screens/StatsScreen";

// GAMES — a global destination that groups the game-centric programs. The segmented
// control at the TOP is CONTEXTUAL navigation (which view of Games am I in), while the
// bottom bar stays global. This is the deliberate top=context / bottom=global split
// the Navigation Fork is testing. RECAP / NEXT / STATS keep their full functionality;
// they're framed here as content destinations rather than global nav.
type View = "next" | "recap" | "stats";
const SEGMENTS: { key: View; label: string }[] = [
  { key: "next", label: "NEXT" },
  { key: "recap", label: "RECAP" },
  { key: "stats", label: "STATS" },
];

export default function GamesHub() {
  const [view, setView] = useState<View>("next");
  return (
    <TabScreen>
      <View style={styles.segWrap}>
        {SEGMENTS.map((s) => {
          const on = s.key === view;
          return (
            <Pressable
              key={s.key}
              testID={`games-seg-${s.key}`}
              style={[styles.seg, on && styles.segOn]}
              onPress={() => { Haptics.selectionAsync(); setView(s.key); }}
            >
              <Text style={[styles.segText, on && styles.segTextOn]}>{s.label}</Text>
              {on ? <View style={styles.segBar} /> : null}
            </Pressable>
          );
        })}
      </View>
      <View style={{ flex: 1 }}>
        <View style={[styles.pane, { display: view === "next" ? "flex" : "none" }]}><TonightScreen /></View>
        <View style={[styles.pane, { display: view === "recap" ? "flex" : "none" }]}><RecapScreen /></View>
        <View style={[styles.pane, { display: view === "stats" ? "flex" : "none" }]}><StatsScreen /></View>
      </View>
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  segWrap: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm, backgroundColor: colors.bg },
  seg: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: radius.sm },
  segOn: {},
  segText: { color: colors.textDim, fontFamily: fonts.display, fontSize: 15, fontWeight: "700", letterSpacing: 1 },
  segTextOn: { color: colors.white },
  segBar: { marginTop: 6, width: 26, height: 3, borderRadius: 2, backgroundColor: colors.blue },
  pane: { ...StyleSheet.absoluteFillObject },
});
