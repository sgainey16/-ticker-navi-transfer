import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { colors, fonts, spacing, radius, hostStyle } from "@/src/theme";
import { TabScreen } from "@/src/components/ui";

const ARENA = require("../../assets/images/arena.jpg");
const DESK = require("../../assets/images/broadcast-desk.png");

const REELS = [
  { id: "1", title: "17-2: How It Happened", host: "rayo", dur: "1:12", tag: "RECORD NIGHT", img: ARENA },
  { id: "2", title: "Marques' 52 in 60 Seconds", host: "rayo", dur: "1:00", tag: "TOP SCORER", img: DESK },
  { id: "3", title: "Casey Breaks Down the Power Play", host: "casey", dur: "2:04", tag: "FILM ROOM", img: DESK },
  { id: "4", title: "Rayo's Top 5 Board Goals", host: "rayo", dur: "1:48", tag: "TOP 5", img: ARENA },
  { id: "5", title: "Golden Goal: Tacoma Stuns KC", host: "rayo", dur: "0:52", tag: "BUZZER BEATER", img: ARENA },
  { id: "6", title: "Utica's Fight Through the Skid", host: "casey", dur: "2:30", tag: "STORYLINE", img: DESK },
];

export default function Reels() {
  const [active, setActive] = useState<string | null>(null);

  return (
    <TabScreen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.titleRow}>
          <Text style={styles.h1}>Reels</Text>
          <Text style={styles.count}>{REELS.length} CLIPS</Text>
        </View>
        <Text style={styles.sub}>Short-form highlights & film breakdowns from the booth.</Text>

        {REELS.map((r) => {
          const s = hostStyle[r.host as "rayo" | "casey"];
          const isActive = active === r.id;
          return (
            <Pressable
              key={r.id}
              testID={`reel-${r.id}`}
              style={styles.card}
              onPress={() => { Haptics.selectionAsync(); setActive(isActive ? null : r.id); }}
            >
              <Image source={r.img} style={StyleSheet.absoluteFill} contentFit="cover" />
              <LinearGradient colors={["rgba(5,7,12,0.25)", "rgba(5,7,12,0.55)", "rgba(5,7,12,0.95)"]} style={StyleSheet.absoluteFill} />
              <View style={styles.cardTop}>
                <View style={[styles.tagPill, { borderColor: s.accent }]}>
                  <Text style={[styles.tagText, { color: s.accent }]}>{r.tag}</Text>
                </View>
                <View style={styles.durPill}><Text style={styles.durText}>{r.dur}</Text></View>
              </View>
              <View style={styles.playWrap}>
                <View style={[styles.playCircle, isActive && { backgroundColor: colors.green }]}>
                  <Ionicons name={isActive ? "hourglass-outline" : "play"} size={22} color={isActive ? colors.bg : colors.white} />
                </View>
              </View>
              <View style={styles.cardBottom}>
                <Text style={styles.reelTitle}>{r.title}</Text>
                <View style={styles.hostRow}>
                  <View style={[styles.hostDot, { backgroundColor: s.accent }]} />
                  <Text style={styles.hostName}>{r.host === "rayo" ? "Rayo" : "Casey"}</Text>
                  {isActive ? <Text style={styles.soon}>· clip coming soon</Text> : null}
                </View>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: 110, gap: spacing.md },
  titleRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  h1: { color: colors.white, fontFamily: fonts.display, fontSize: 30, fontWeight: "800" },
  count: { color: colors.textDim, fontFamily: fonts.display, fontSize: 15, fontWeight: "700", letterSpacing: 1.5 },
  sub: { color: colors.textDim, fontFamily: fonts.body, fontSize: 13, marginBottom: spacing.xs },

  card: { height: 200, borderRadius: radius.lg, overflow: "hidden", borderWidth: 1, borderColor: colors.border, justifyContent: "space-between" },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.md },
  tagPill: { borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 3, backgroundColor: "rgba(5,7,12,0.5)" },
  tagText: { fontFamily: fonts.display, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  durPill: { backgroundColor: "rgba(5,7,12,0.6)", borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  durText: { color: colors.white, fontFamily: fonts.display, fontSize: 12, fontWeight: "700" },
  playWrap: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0, alignItems: "center", justifyContent: "center" },
  playCircle: { width: 54, height: 54, borderRadius: 27, backgroundColor: "rgba(250,42,42,0.9)", alignItems: "center", justifyContent: "center" },
  cardBottom: { padding: spacing.lg },
  reelTitle: { color: colors.white, fontFamily: fonts.display, fontSize: 20, fontWeight: "800", letterSpacing: 0.3 },
  hostRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  hostDot: { width: 8, height: 8, borderRadius: 4 },
  hostName: { color: colors.textDim, fontFamily: fonts.body, fontSize: 13 },
  soon: { color: colors.green, fontFamily: fonts.body, fontSize: 12, fontStyle: "italic" },
});
