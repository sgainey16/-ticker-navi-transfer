import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";

import { colors, fonts } from "@/src/theme";
import { goToTab } from "@/src/lib/tabnav";

// LAYER A — PERMANENT / GLOBAL navigation. "Where do I want to go in The Ticker."
// Bottom bar for thumb access. Same component on the tab shell AND on every detail
// route, so the global layer never disappears while you explore. Labels/structure
// are a Navigation-Fork prototype, not locked.
export type NavKey = "home" | "myhockey" | "games" | "explore" | "profile";

export const NAV_ITEMS: {
  key: NavKey; label: string; icon: keyof typeof Ionicons.glyphMap; iconOn: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: "home", label: "MY TICKER", icon: "home-outline", iconOn: "home" },
  { key: "myhockey", label: "MY HOCKEY", icon: "flame-outline", iconOn: "flame" },
  { key: "games", label: "GAMES", icon: "calendar-outline", iconOn: "calendar" },
  { key: "explore", label: "EXPLORE", icon: "globe-outline", iconOn: "globe" },
  { key: "profile", label: "PROFILE", icon: "person-circle-outline", iconOn: "person-circle" },
];

export function BottomNav({ active, onSelect }: { active?: string; onSelect?: (k: NavKey) => void }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const handle = (k: NavKey) => {
    Haptics.selectionAsync();
    if (onSelect) { onSelect(k); return; }
    // Route mode (detail pages): jump to the tab, then dismiss the detail stack.
    goToTab(k);
    const r = router as any;
    try {
      if (typeof r.dismissAll === "function" && (r.canDismiss?.() ?? true)) r.dismissAll();
      else router.navigate("/");
    } catch { router.navigate("/"); }
  };

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {NAV_ITEMS.map((t) => {
        const on = t.key === active;
        return (
          <Pressable key={t.key} testID={`nav-${t.key}`} style={styles.item} onPress={() => handle(t.key)} hitSlop={6}>
            <Ionicons name={on ? t.iconOn : t.icon} size={22} color={on ? colors.blue : colors.textDim} />
            <Text style={[styles.label, on && styles.labelOn]} numberOfLines={1}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "flex-start", backgroundColor: colors.bgElev, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 9 },
  item: { flex: 1, alignItems: "center", gap: 3, paddingVertical: 2 },
  label: { color: colors.textDim, fontFamily: fonts.display, fontSize: 9.5, fontWeight: "700", letterSpacing: 0.6 },
  labelOn: { color: colors.blue },
});
