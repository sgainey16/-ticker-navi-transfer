import React from "react";
import { Pressable, ViewStyle } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { NhlLogo } from "@/src/components/NhlLogo";

// CONTENT-IS-NAVIGATION: a team crest that is its OWN doorway to the Team Page,
// independent of the card it lives in. Placed inside a game/matchup card, the inner
// press wins (RN responder), so the crest -> Team while the rest of the card -> Game.
export function TappableCrest({
  abbr,
  logo,
  size = 24,
  league,
  hitSlop = 8,
  style,
}: {
  abbr?: string | null;
  logo?: string | null;
  size?: number;
  league?: string;
  hitSlop?: number;
  style?: ViewStyle;
}) {
  const router = useRouter();
  const go = () => {
    if (!abbr) return;
    Haptics.selectionAsync();
    const lg = (league || "nhl").toLowerCase();
    router.push(`/team/${abbr}${lg !== "nhl" ? `?league=${lg}` : ""}`);
  };
  return (
    <Pressable onPress={go} disabled={!abbr} hitSlop={hitSlop} style={style} testID={`crest-${abbr}`}>
      <NhlLogo abbr={abbr || undefined} url={logo} size={size} />
    </Pressable>
  );
}
