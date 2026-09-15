import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors, fonts, spacing, radius } from "@/src/theme";

// STANDALONE extraction of Navi's BackBar.
// In Navi this lives inside app/team/[id].tsx and is imported by node.tsx, search.tsx,
// league/[code].tsx, player/[id].tsx and game/[id].tsx. That coupling drags the whole
// Team page in. For a clean transfer, drop THIS file in and change those imports from
//   import { BackBar } from "@/app/team/[id]";
// to
//   import { BackBar } from "@/src/components/BackBar";
// OR simply replace it with Best's own back control (it renders router.back() + a globe +
// a search shortcut). Keep the same testIDs so automated flows keep working.
export function BackBar() {
  const router = useRouter();
  return (
    <View style={styles.backBar}>
      <Pressable testID="back-button" onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
        <Ionicons name="chevron-back" size={22} color={colors.text} />
        <Text style={styles.backText}>Back</Text>
      </Pressable>
      <View style={{ flex: 1 }} />
      <Pressable testID="nav-hockey" onPress={() => router.push("/hockey")} style={styles.navIcon} hitSlop={10}>
        <Ionicons name="globe-outline" size={20} color={colors.textDim} />
      </Pressable>
      <Pressable testID="nav-search" onPress={() => router.push("/search")} style={styles.navIcon} hitSlop={10}>
        <Ionicons name="search" size={19} color={colors.textDim} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  backBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 2, alignSelf: "flex-start" },
  backText: { color: colors.text, fontFamily: fonts.display, fontSize: 15, fontWeight: "700" },
  navIcon: { paddingHorizontal: 8, paddingVertical: 4 },
});
