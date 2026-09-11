import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { colors, fonts } from "@/src/theme";

// Team crest. Uses an explicit URL when a provider supplies one, else the NHL
// asset derived from the tricode. When neither loads (e.g. NCAA has no verified
// logo) it falls back to a clean monogram — never a wrong/fake crest.
export function NhlLogo({ abbr, url, size = 40 }: { abbr?: string; url?: string | null; size?: number }) {
  const [failed, setFailed] = useState(false);
  const src =
    url ||
    (abbr ? `https://assets.nhle.com/logos/nhl/svg/${abbr.toUpperCase()}_light.svg` : undefined);

  useEffect(() => { setFailed(false); }, [src]);

  if (src && !failed) {
    return (
      <Image
        source={src}
        style={{ width: size, height: size }}
        contentFit="contain"
        transition={150}
        onError={() => setFailed(true)}
      />
    );
  }
  const mono = (abbr || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3) || "•";
  return (
    <View style={[styles.mono, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.monoText, { fontSize: Math.max(9, size * 0.34) }]}>{mono}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  mono: { alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceHi, borderWidth: 1, borderColor: colors.border },
  monoText: { color: colors.textDim, fontFamily: fonts.display, fontWeight: "800", letterSpacing: 0.5 },
});
