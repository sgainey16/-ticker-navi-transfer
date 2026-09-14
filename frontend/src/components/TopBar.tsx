import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { colors, fonts, spacing } from "@/src/theme";
import { TickerMark } from "./TickerLogo";

// Slim persistent brand bar for the tab shell. The TOP is reserved for CONTEXT
// ("where am I") — on the global tabs there's little context, so it stays a clean
// brand strip with quick search. Detail routes render their own contextual header.
export function TopBar({ title }: { title?: string }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View style={[styles.wrap, { paddingTop: insets.top }]}>
      <View style={styles.row}>
        <View style={styles.brand}>
          <TickerMark size={24} />
          <Text style={styles.brandText}>THE TICKER</Text>
        </View>
        {title ? <Text style={styles.title} numberOfLines={1}>{title}</Text> : <View style={{ flex: 1 }} />}
        <Pressable testID="nav-search" onPress={() => { Haptics.selectionAsync(); router.push("/search"); }} style={styles.searchBtn} hitSlop={8}>
          <Ionicons name="search" size={20} color={colors.textDim} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.bgElev, borderBottomWidth: 1, borderBottomColor: colors.border },
  row: { flexDirection: "row", alignItems: "center", height: 50, paddingHorizontal: spacing.lg },
  brand: { flexDirection: "row", alignItems: "center", gap: 8 },
  brandText: { color: colors.white, fontFamily: fonts.display, fontSize: 16, fontWeight: "800", letterSpacing: 1 },
  title: { flex: 1, textAlign: "center", color: colors.textDim, fontFamily: fonts.display, fontSize: 14, fontWeight: "700", letterSpacing: 0.5 },
  searchBtn: { padding: 6 },
});
