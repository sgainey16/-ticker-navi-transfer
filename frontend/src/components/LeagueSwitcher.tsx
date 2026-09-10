import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import * as Haptics from "expo-haptics";

import { colors, fonts, radius, spacing } from "@/src/theme";
import { api } from "@/src/lib/api";
import { useApi } from "@/src/lib/useApi";

// Small NHL | WHL segmented control. Renders nothing until more than one league
// is registered on the backend, so single-league builds look unchanged.
export function LeagueSwitcher({ league, onChange }: { league: string; onChange: (code: string) => void }) {
  const q = useApi(() => api.leagues());
  const leagues = q.data?.leagues || [];
  if (leagues.length <= 1) return null;
  return (
    <View style={styles.switcher}>
      {leagues.map((l) => {
        const on = l.code === league;
        return (
          <Pressable
            key={l.code}
            testID={`league-${l.code}`}
            style={[styles.segment, on && styles.segmentOn]}
            onPress={() => { if (!on) { Haptics.selectionAsync(); onChange(l.code); } }}
          >
            <Text style={[styles.segmentText, on && styles.segmentTextOn]}>{l.code.toUpperCase()}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  switcher: { flexDirection: "row", backgroundColor: colors.surface, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, padding: 3, alignSelf: "flex-start", gap: 2 },
  segment: { paddingHorizontal: spacing.lg, paddingVertical: 8, borderRadius: radius.pill },
  segmentOn: { backgroundColor: colors.blue },
  segmentText: { color: colors.textDim, fontFamily: fonts.display, fontSize: 13, fontWeight: "800", letterSpacing: 1 },
  segmentTextOn: { color: colors.white },
});
