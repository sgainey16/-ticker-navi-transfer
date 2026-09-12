import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";

import { colors, fonts, spacing, radius } from "@/src/theme";
import { TickerMark } from "./TickerLogo";
import { useRouter } from "expo-router";

export type TopTab = { key: string; label: string };

export function TopTabBar({
  tabs,
  active,
  onSelect,
}: {
  tabs: TopTab[];
  active: string;
  onSelect: (key: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const layouts = useRef<Record<string, { x: number; w: number }>>({});

  useEffect(() => {
    const l = layouts.current[active];
    if (l) scrollRef.current?.scrollTo({ x: Math.max(0, l.x - 60), animated: true });
  }, [active]);

  return (
    <View style={[styles.wrap, { paddingTop: insets.top }]}>
      <View style={styles.row}>
        <View style={styles.logoBox}>
          <TickerMark size={26} />
          <View style={styles.logoDivider} />
        </View>
        <ScrollView ref={scrollRef} horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={styles.tabs}>
          {tabs.map((t) => {
            const isActive = t.key === active;
            return (
              <Pressable
                key={t.key}
                testID={`toptab-${t.key}`}
                onLayout={(e) => (layouts.current[t.key] = { x: e.nativeEvent.layout.x, w: e.nativeEvent.layout.width })}
                onPress={() => { Haptics.selectionAsync(); onSelect(t.key); }}
                style={[styles.tab, isActive && styles.tabActive]}
              >
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <View style={styles.worldBox}>
          <Pressable testID="nav-hockey" onPress={() => { Haptics.selectionAsync(); router.push("/hockey"); }} style={styles.worldBtn} hitSlop={8}>
            <Ionicons name="globe-outline" size={20} color={colors.textDim} />
          </Pressable>
          <Pressable testID="nav-search" onPress={() => { Haptics.selectionAsync(); router.push("/search"); }} style={styles.worldBtn} hitSlop={8}>
            <Ionicons name="search" size={19} color={colors.textDim} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.bgElev, borderBottomWidth: 1, borderBottomColor: colors.border },
  row: { flexDirection: "row", alignItems: "center", height: 52 },
  logoBox: { flexDirection: "row", alignItems: "center", paddingLeft: spacing.lg, paddingRight: spacing.md },
  logoDivider: { width: 1, height: 22, backgroundColor: colors.borderStrong, marginLeft: spacing.md },
  tabs: { alignItems: "center", paddingRight: spacing.xl, gap: spacing.xs },
  tab: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.md },
  tabActive: { backgroundColor: colors.surfaceAlt },
  tabText: { color: colors.textDim, fontFamily: fonts.display, fontSize: 16, fontWeight: "700", letterSpacing: 1 },
  tabTextActive: { color: colors.white },
  worldBox: { flexDirection: "row", alignItems: "center", paddingRight: spacing.md, paddingLeft: spacing.xs, borderLeftWidth: 1, borderLeftColor: colors.borderStrong, marginLeft: 2 },
  worldBtn: { paddingHorizontal: 8, paddingVertical: 6 },
});
