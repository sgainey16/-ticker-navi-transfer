import React from "react";
import { View, Text, StyleSheet, ViewStyle, TextStyle, ActivityIndicator, Pressable } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { goToTab } from "@/src/lib/tabnav";
import { colors, fonts, spacing, radius, fontSize } from "@/src/theme";

// The four global Ticker areas. Present on EVERY detail route so the network
// shell never disappears — Back stops being the only way out. (NEXT tab key = "tonight".)
const OUT_TABS = [
  { key: "home", label: "HOME", icon: "home" as const },
  { key: "recap", label: "RECAP", icon: "play-back" as const },
  { key: "tonight", label: "NEXT", icon: "calendar-outline" as const },
  { key: "stats", label: "STATS", icon: "stats-chart" as const },
];

// Persistent global-navigation rail. Rendered by Screen, so it lives in the shared
// screen architecture rather than being pasted onto individual pages. Tapping a tab
// selects it on the underlying tab host and dismisses the detail stack to reveal it.
export function OutRail() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const jump = (key: string) => {
    Haptics.selectionAsync();
    goToTab(key);
    const r = router as any;
    try {
      if (typeof r.dismissAll === "function" && (r.canDismiss?.() ?? true)) r.dismissAll();
      else router.navigate("/");
    } catch {
      router.navigate("/");
    }
  };
  return (
    <View style={[railStyles.wrap, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {OUT_TABS.map((t) => (
        <Pressable key={t.key} testID={`out-${t.key}`} style={railStyles.item} onPress={() => jump(t.key)} hitSlop={6}>
          <Ionicons name={t.icon} size={19} color={colors.textDim} />
          <Text style={railStyles.label}>{t.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Screen({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <View style={[{ flex: 1 }, style]}>{children}</View>
      <OutRail />
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

const railStyles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", backgroundColor: colors.bgElev, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 },
  item: { flex: 1, alignItems: "center", gap: 3, paddingVertical: 2 },
  label: { color: colors.textDim, fontFamily: fonts.display, fontSize: 10, fontWeight: "700", letterSpacing: 1 },
});

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
