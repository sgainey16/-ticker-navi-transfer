import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from "react-native-reanimated";
import { colors, fonts } from "@/src/theme";

export function TickerStrip({ items }: { items: string[] }) {
  const [w, setW] = useState(0);
  const x = useSharedValue(0);

  useEffect(() => {
    if (w > 0) {
      x.value = 0;
      x.value = withRepeat(withTiming(-w, { duration: w * 22, easing: Easing.linear }), -1, false);
    }
  }, [w, x]);

  const anim = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  const Row = ({ measure }: { measure?: boolean }) => (
    <View
      style={styles.row}
      onLayout={measure ? (e) => setW(e.nativeEvent.layout.width) : undefined}
    >
      {items.map((it, i) => (
        <View key={i} style={styles.item}>
          <Text style={styles.dot}>◆</Text>
          <Text style={styles.text}>{it}</Text>
        </View>
      ))}
    </View>
  );

  return (
    <View style={styles.wrap} testID="ticker-strip">
      <View style={styles.labelBox}>
        <Text style={styles.label}>LIVE</Text>
      </View>
      <View style={styles.marquee}>
        <Animated.View style={[styles.track, anim]}>
          <Row measure />
          <Row />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bgElev,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    height: 34,
  },
  labelBox: { backgroundColor: colors.red, height: "100%", justifyContent: "center", paddingHorizontal: 10 },
  label: { color: colors.white, fontFamily: fonts.display, fontWeight: "800", fontSize: 12, letterSpacing: 1 },
  marquee: { flex: 1, overflow: "hidden" },
  track: { flexDirection: "row" },
  row: { flexDirection: "row" },
  item: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14 },
  dot: { color: colors.green, fontSize: 8, marginRight: 8 },
  text: { color: colors.text, fontFamily: fonts.display, fontSize: 13, fontWeight: "600", letterSpacing: 0.4 },
});
