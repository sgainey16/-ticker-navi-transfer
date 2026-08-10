import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { colors, fonts } from "@/src/theme";

// Real MASL club logos, keyed by team abbreviation.
const LOGOS: Record<string, any> = {
  BAL: require("../../assets/images/logos/baltimore.png"),
  SD: require("../../assets/images/logos/san-diego.png"),
  MIL: require("../../assets/images/logos/milwaukee.png"),
  EMP: require("../../assets/images/logos/empire.png"),
  KC: require("../../assets/images/logos/kansas-city.png"),
  UTI: require("../../assets/images/logos/utica.png"),
  STL: require("../../assets/images/logos/st-louis.png"),
  TAC: require("../../assets/images/logos/tacoma.png"),
};

export function TeamLogo({
  abbr,
  primary,
  secondary,
  size = 44,
}: {
  abbr: string;
  primary: string;
  secondary?: string;
  size?: number;
}) {
  const logo = LOGOS[abbr];

  if (logo) {
    return (
      <View
        style={[
          styles.tile,
          { width: size, height: size, borderRadius: size * 0.22, padding: size * 0.1 },
        ]}
      >
        <Image source={logo} style={{ flex: 1, width: "100%" }} contentFit="contain" />
      </View>
    );
  }

  // Fallback: club-colored crest with initials.
  return (
    <View
      style={[
        styles.crest,
        { width: size, height: size, borderRadius: size * 0.24, backgroundColor: secondary || colors.surfaceHi, borderColor: primary },
      ]}
    >
      <View style={[styles.stripe, { backgroundColor: primary, height: size }]} />
      <Text style={[styles.abbr, { fontSize: size * 0.36 }]}>{abbr}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  crest: { alignItems: "center", justifyContent: "center", borderWidth: 2, overflow: "hidden" },
  stripe: { position: "absolute", left: 0, width: 4, opacity: 0.9 },
  abbr: { fontFamily: fonts.display, fontWeight: "800", letterSpacing: 0.5, color: colors.white },
});
