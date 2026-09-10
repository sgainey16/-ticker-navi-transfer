import React, { useEffect, useMemo, useState } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, Redirect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { colors } from "@/src/theme";
import { setTabHandler } from "@/src/lib/tabnav";
import { useFollows } from "@/src/lib/follows";
import { TopTabBar } from "@/src/components/TopTabBar";
import HomeScreen from "@/src/screens/HomeScreen";
import RecapScreen from "@/src/screens/RecapScreen";
import TonightScreen from "@/src/screens/TonightScreen";
import ReelsScreen from "@/src/screens/ReelsScreen";
import ScoresScreen from "@/src/screens/ScoresScreen";
import StatsScreen from "@/src/screens/StatsScreen";

const TABS = [
  { key: "recap", label: "RECAP", C: RecapScreen },
  { key: "tonight", label: "NEXT", C: TonightScreen },
  { key: "home", label: "HOME", C: HomeScreen },
  { key: "reels", label: "MY HOCKEY", C: ReelsScreen },
  { key: "scores", label: "SCORES", C: ScoresScreen },
  { key: "stats", label: "STATS", C: StatsScreen },
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
  const [active, setActive] = useState("home");
  const [visited, setVisited] = useState<Set<string>>(new Set(["home"]));

  const select = (key: string) => {
    setActive(key);
    setVisited((v) => (v.has(key) ? v : new Set(v).add(key)));
  };

  useEffect(() => {
    setTabHandler(select);
    return () => setTabHandler(null);
  }, []);

  const tabs = useMemo(() => TABS.map(({ key, label }) => ({ key, label })), []);

  return (
    <View style={styles.root}>
      <TopTabBar tabs={tabs} active={active} onSelect={select} />
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
        style={[styles.mic, { bottom: Math.max(insets.bottom, 16) + 8 }]}
      >
        <Ionicons name="mic" size={26} color={colors.bg} />
        <View style={styles.micDot} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1 },
  mic: {
    position: "absolute", right: 18, width: 60, height: 60, borderRadius: 30,
    backgroundColor: colors.blue, alignItems: "center", justifyContent: "center",
    shadowColor: colors.blue, shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8,
  },
  micDot: { position: "absolute", top: 6, right: 6, width: 12, height: 12, borderRadius: 6, backgroundColor: colors.gold, borderWidth: 2, borderColor: colors.bg },
});
