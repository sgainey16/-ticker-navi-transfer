import React, { useEffect, useState } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, Redirect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { colors } from "@/src/theme";
import { setTabHandler } from "@/src/lib/tabnav";
import { useFollows } from "@/src/lib/follows";
import { TopBar } from "@/src/components/TopBar";
import { BottomNav, NavKey } from "@/src/components/BottomNav";
import HomeScreen from "@/src/screens/HomeScreen";
import MyHockeyScreen from "@/src/screens/ReelsScreen";
import GamesHub from "@/src/screens/GamesHub";
import ExploreScreen from "@/src/screens/ExploreScreen";
import ProfileScreen from "@/src/screens/ProfileScreen";

// Layer A — PERMANENT (global) navigation as a bottom bar (thumb access): the
// "where do I want to go" layer. Contextual "where am I" nav lives at the top of
// each destination (e.g. GAMES' NEXT/RECAP/STATS segments). Navigation-Fork
// prototype — labels/structure are NOT locked. RECAP/NEXT/STATS keep full
// functionality inside GAMES; nothing was removed.
const TABS: { key: NavKey; C: React.ComponentType }[] = [
  { key: "home", C: HomeScreen },
  { key: "myhockey", C: MyHockeyScreen },
  { key: "games", C: GamesHub },
  { key: "explore", C: ExploreScreen },
  { key: "profile", C: ProfileScreen },
];

export default function TickerApp() {
  const { ready, onboarded } = useFollows();
  if (!ready) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  if (!onboarded) return <Redirect href="/onboarding" />;
  return <TabsHost />;
}

function TabsHost() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [active, setActive] = useState<NavKey>("home");
  const [visited, setVisited] = useState<Set<string>>(new Set(["home"]));

  const select = (key: string) => {
    setActive(key as NavKey);
    setVisited((v) => (v.has(key) ? v : new Set(v).add(key)));
  };

  useEffect(() => {
    setTabHandler(select);
    return () => setTabHandler(null);
  }, []);

  return (
    <View style={styles.root}>
      <TopBar />
      <View style={styles.body}>
        {TABS.map(({ key, C }) => {
          if (!visited.has(key)) return null;
          return (
            <View key={key} style={[StyleSheet.absoluteFill, { display: active === key ? "flex" : "none" }]} pointerEvents={active === key ? "auto" : "none"}>
              <C />
            </View>
          );
        })}
      </View>

      <Pressable
        testID="floating-mic"
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/talk"); }}
        style={[styles.mic, { bottom: insets.bottom + 74 }]}
      >
        <Ionicons name="mic" size={24} color={colors.bg} />
        <View style={styles.micDot} />
      </Pressable>

      <BottomNav active={active} onSelect={select} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1 },
  mic: {
    position: "absolute", right: 16, width: 54, height: 54, borderRadius: 27,
    backgroundColor: colors.blue, alignItems: "center", justifyContent: "center",
    shadowColor: colors.blue, shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8,
  },
  micDot: { position: "absolute", top: 6, right: 6, width: 12, height: 12, borderRadius: 6, backgroundColor: colors.gold, borderWidth: 2, borderColor: colors.bg },
});
