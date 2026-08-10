import React from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";
import { Image } from "expo-image";
import { colors, fonts } from "@/src/theme";

const LOGO = require("../../assets/images/ticker-logo.png");
const MARK = require("../../assets/images/ticker-mark.png");

// Full "THE TICKER" wordmark lockup (from the Brand Guide).
export function TickerLogo({ width = 150, style }: { width?: number; style?: ViewStyle }) {
  return (
    <Image
      source={LOGO}
      style={[{ width, height: width * (142 / 472) }, style]}
      contentFit="contain"
      testID="ticker-logo"
    />
  );
}

// Standalone "T" monogram.
export function TickerMark({ size = 26, style }: { size?: number; style?: ViewStyle }) {
  return (
    <Image
      source={MARK}
      style={[{ width: size * (150 / 142), height: size }, style]}
      contentFit="contain"
      testID="ticker-mark"
    />
  );
}

// Header lockup: monogram + MASL sub-brand line.
export function MaslHeaderLogo() {
  return (
    <View style={styles.row}>
      <TickerMark size={30} />
      <View style={styles.divider} />
      <View>
        <Text style={styles.masl}>MASL</Text>
        <Text style={styles.sub}>MAJOR ARENA SOCCER LEAGUE</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  divider: { width: 1, height: 26, backgroundColor: colors.borderStrong },
  masl: { fontFamily: fonts.display, color: colors.white, fontSize: 22, fontWeight: "700", letterSpacing: 1, lineHeight: 24 },
  sub: { fontFamily: fonts.accent, color: colors.green, fontSize: 8, fontWeight: "600", letterSpacing: 1.2 },
});
