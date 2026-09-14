import React from "react";
import { View, Text, StyleSheet, ViewStyle, TextStyle, ActivityIndicator, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { colors, fonts, spacing, radius, fontSize } from "@/src/theme";
import { BottomNav } from "@/src/components/BottomNav";

export function Screen({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <View style={[{ flex: 1 }, style]}>{children}</View>
      <BottomNav />
    </SafeAreaView>
  );
}

// For screens hosted inside the top-tab navigator (top safe area handled by the tab bar).
export function TabScreen({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.screen, style]}>{children}</View>;
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ title, accent, action }: { title: string; accent?: string; action?: React.ReactNode }) {
  return (
    <View style={styles.sectionRow}>
      <View style={styles.sectionLeft}>
        <View style={[styles.sectionBar, { backgroundColor: accent || colors.green }]} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {action}
    </View>
  );
}

export function Pill({ label, color, bg, style, textStyle }: { label: string; color?: string; bg?: string; style?: ViewStyle; textStyle?: TextStyle }) {
  return (
    <View style={[styles.pill, { backgroundColor: bg || colors.surfaceHi }, style]}>
      <Text style={[styles.pillText, { color: color || colors.textDim }, textStyle]}>{label}</Text>
    </View>
  );
}

export function LiveBadge({ label = "LIVE" }: { label?: string }) {
  return (
    <View style={styles.liveBadge}>
      <View style={styles.liveDot} />
      <Text style={styles.liveText}>{label}</Text>
    </View>
  );
}

export function Loader({ label }: { label?: string }) {
  return (
    <View style={styles.loader}>
      <ActivityIndicator color={colors.green} size="large" />
      {label ? <Text style={styles.loaderText}>{label}</Text> : null}
    </View>
  );
}

export function FollowPill({ following, onPress, compact }: { following: boolean; onPress: () => void; compact?: boolean }) {
  return (
    <Pressable onPress={() => { Haptics.selectionAsync(); onPress(); }} testID="follow-toggle" hitSlop={compact ? 8 : undefined} style={[fp.pill, compact && fp.pillCompact, following ? fp.on : fp.off]}>
      <Ionicons name={following ? "checkmark" : "add"} size={compact ? 12 : 16} color={following ? colors.bg : colors.white} />
      <Text style={[fp.text, compact && fp.textCompact, { color: following ? colors.bg : colors.white }]}>{following ? "FOLLOWING" : "FOLLOW"}</Text>
    </Pressable>
  );
}

const fp = StyleSheet.create({
  pill: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: 8, alignSelf: "center", borderWidth: 1 },
  pillCompact: { gap: 3, paddingHorizontal: 10, paddingVertical: 4 },
  on: { backgroundColor: colors.blue, borderColor: colors.blue },
  off: { backgroundColor: "transparent", borderColor: colors.blue },
  text: { fontFamily: fonts.display, fontSize: 12.5, fontWeight: "800", letterSpacing: 1 },
  textCompact: { fontSize: 10.5, letterSpacing: 0.6 },
});

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.loader}>
      <Text style={styles.errText}>{message}</Text>
      {onRetry ? (
        <Text testID="retry-button" onPress={onRetry} style={styles.retry}>Tap to retry</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  sectionLeft: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  sectionBar: { width: 4, height: 18, borderRadius: 2 },
  sectionTitle: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: fontSize.xl,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  pill: { paddingHorizontal: spacing.md, paddingVertical: 5, borderRadius: radius.pill, alignSelf: "flex-start" },
  pillText: { fontFamily: fonts.display, fontSize: fontSize.sm, fontWeight: "700", letterSpacing: 0.6 },
  liveBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: colors.red, paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.sm,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.white },
  liveText: { color: colors.white, fontFamily: fonts.display, fontSize: fontSize.xs, fontWeight: "800", letterSpacing: 1 },
  loader: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.md },
  loaderText: { color: colors.textDim, fontFamily: fonts.body, fontSize: fontSize.base },
  errText: { color: colors.textDim, fontFamily: fonts.body, fontSize: fontSize.base, textAlign: "center" },
  retry: { color: colors.green, fontFamily: fonts.display, fontSize: fontSize.lg, fontWeight: "700", letterSpacing: 0.5 },
});
