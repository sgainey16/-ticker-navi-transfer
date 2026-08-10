import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import * as Haptics from "expo-haptics";
import { colors, fonts, spacing, radius } from "@/src/theme";

// Head-to-head stat comparison row (home = green, away = blue).
export function StatCompare({
  label,
  home,
  away,
  homeColor = colors.green,
  awayColor = colors.blue,
}: {
  label: string;
  home: number;
  away: number;
  homeColor?: string;
  awayColor?: string;
}) {
  const total = home + away || 1;
  const hp = Math.max(4, (home / total) * 100);
  const ap = Math.max(4, (away / total) * 100);
  return (
    <View style={styles.compare}>
      <View style={styles.compareTop}>
        <Text style={[styles.compareVal, { color: homeColor }]}>{home}</Text>
        <Text style={styles.compareLabel}>{label}</Text>
        <Text style={[styles.compareVal, { color: awayColor }]}>{away}</Text>
      </View>
      <View style={styles.compareTrack}>
        <View style={[styles.compareFill, { width: `${hp}%`, backgroundColor: homeColor, borderTopLeftRadius: 4, borderBottomLeftRadius: 4 }]} />
        <View style={styles.compareGap} />
        <View style={[styles.compareFill, { width: `${ap}%`, backgroundColor: awayColor, borderTopRightRadius: 4, borderBottomRightRadius: 4 }]} />
      </View>
    </View>
  );
}

export function Segmented({
  options,
  value,
  onChange,
}: {
  options: { key: string; label: string }[];
  value: string;
  onChange: (k: string) => void;
}) {
  return (
    <View style={styles.seg} testID="segmented-control">
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            testID={`segment-${o.key}`}
            onPress={() => {
              Haptics.selectionAsync();
              onChange(o.key);
            }}
            style={[styles.segItem, active && styles.segItemActive]}
          >
            <Text style={[styles.segText, active && styles.segTextActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  compare: { marginBottom: spacing.md },
  compareTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  compareVal: { fontFamily: fonts.display, fontSize: 18, fontWeight: "800", width: 56 },
  compareLabel: {
    color: colors.textDim, fontFamily: fonts.display, fontSize: 12, fontWeight: "700",
    letterSpacing: 1, textTransform: "uppercase", textAlign: "center", flex: 1,
  },
  compareTrack: { flexDirection: "row", alignItems: "center", height: 8 },
  compareFill: { height: 8 },
  compareGap: { width: 3 },
  seg: {
    flexDirection: "row",
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segItem: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: radius.pill },
  segItemActive: { backgroundColor: colors.white },
  segText: { color: colors.textDim, fontFamily: fonts.display, fontSize: 14, fontWeight: "700", letterSpacing: 0.5 },
  segTextActive: { color: colors.bg },
});
