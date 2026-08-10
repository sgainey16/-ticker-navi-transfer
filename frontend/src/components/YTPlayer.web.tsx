import React from "react";
import { View, Text, StyleSheet, Pressable, Linking } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "@/src/theme";

// Web fallback: react-native-youtube-iframe is unsupported on web, so we show a
// thumbnail that opens the real clip. (Native uses the inline contained player.)
export function YTPlayer({ videoId, height }: { videoId: string; height: number }) {
  return (
    <Pressable style={[styles.wrap, { height }]} testID="web-watch" onPress={() => Linking.openURL(`https://www.youtube.com/watch?v=${videoId}`)}>
      <Image source={{ uri: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` }} style={StyleSheet.absoluteFill} contentFit="cover" />
      <View style={styles.shade} />
      <View style={styles.center}>
        <View style={styles.circle}><Ionicons name="play" size={28} color={colors.bg} /></View>
        <Text style={styles.text}>WATCH ON YOUTUBE</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", backgroundColor: "#000" },
  shade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(5,7,12,0.4)" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  circle: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.green, alignItems: "center", justifyContent: "center" },
  text: { color: colors.white, fontFamily: fonts.display, fontSize: 14, fontWeight: "800", letterSpacing: 1 },
});
