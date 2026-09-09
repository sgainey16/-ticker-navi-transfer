import React from "react";
import { View, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { colors } from "@/src/theme";

// Renders an official NHL team logo (SVG from assets.nhle.com). Falls back to the
// abbreviation-based light logo when no explicit URL is supplied.
export function NhlLogo({ abbr, url, size = 40 }: { abbr?: string; url?: string | null; size?: number }) {
  const src =
    url ||
    (abbr ? `https://assets.nhle.com/logos/nhl/svg/${abbr.toUpperCase()}_light.svg` : undefined);
  if (!src) return <View style={[styles.fallback, { width: size, height: size }]} />;
  return (
    <Image
      source={src}
      style={{ width: size, height: size }}
      contentFit="contain"
      transition={150}
    />
  );
}

const styles = StyleSheet.create({
  fallback: { borderRadius: 999, backgroundColor: colors.surfaceHi },
});
