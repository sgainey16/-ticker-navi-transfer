import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { colors, fonts, spacing, radius } from "@/src/theme";
import { api, MyHockeyItem } from "@/src/lib/api";
import { useApi } from "@/src/lib/useApi";
import { useFollows } from "@/src/lib/follows";
import { TabScreen, Loader, ErrorState, SectionTitle } from "@/src/components/ui";
import { NhlLogo } from "@/src/components/NhlLogo";

function niceDate(utc?: string | null) {
  if (!utc) return "";
  try {
    const d = new Date(utc);
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  } catch { return ""; }
}
function initials(name?: string) {
  if (!name) return "?";
  const p = name.replace(/:.*/, "").trim().split(/\s+/);
  return ((p[0]?.[0] || "") + (p[1]?.[0] || "")).toUpperCase();
}

export default function MyHockey() {
  const router = useRouter();
  const { follows } = useFollows();
  const followSig = useMemo(() => JSON.stringify(follows), [follows]);
  const q = useApi(() => api.myHockey(follows), [followSig]);

  const items = useMemo(() => q.data?.items || [], [q.data]);
  const personalized = !!q.data?.personalized;
  const mine = useMemo(() => items.filter((i) => i.followed), [items]);
  const league = useMemo(() => items.filter((i) => !i.followed), [items]);

  const open = (it: MyHockeyItem) => {
    Haptics.selectionAsync();
    if (it.type === "player" && it.player_id) router.push(`/player/${it.player_id}`);
    else if (it.game_id) router.push(`/game/${it.game_id}`);
  };

  return (
    <TabScreen>
      {q.loading ? (
        <Loader label="Rounding up your hockey…" />
      ) : q.error ? (
        <ErrorState message="Couldn't load My Hockey" onRetry={() => q.reload()} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl tintColor={colors.blue} refreshing={false} onRefresh={() => q.reload()} />}
        >
          <View style={styles.head}>
            <View style={styles.headBar} />
            <Text style={styles.headTitle}>MY HOCKEY</Text>
          </View>

          {personalized && mine.length ? (
            <View style={styles.section}>
              <SectionTitle title="Around Your Hockey" accent={colors.blue} />
              {mine.map((it, i) => <FeedCard key={`m${i}`} item={it} onPress={() => open(it)} />)}
            </View>
          ) : null}

          {league.length ? (
            <View style={styles.section}>
              <SectionTitle title={personalized ? "Around the NHL" : "Around the League"} accent={colors.blue} />
              {league.map((it, i) => <FeedCard key={`l${i}`} item={it} onPress={() => open(it)} />)}
            </View>
          ) : null}

          {!items.length ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No hockey to show yet.</Text>
              <Text style={styles.emptySub}>New games and results will appear here.</Text>
            </View>
          ) : null}

          {!personalized ? (
            <Pressable style={styles.build} onPress={() => router.push("/onboarding?reset=1")}>
              <Ionicons name="albums-outline" size={18} color={colors.blue} />
              <Text style={styles.buildText}>Build your Draft Board to make this yours.</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
            </Pressable>
          ) : null}

          <View style={{ height: spacing.xxxl }} />
        </ScrollView>
      )}
    </TabScreen>
  );
}

function FeedCard({ item, onPress }: { item: MyHockeyItem; onPress: () => void }) {
  return (
    <Pressable style={[styles.card, item.followed && styles.cardMine]} onPress={onPress} testID={`myhockey-${item.type}`}>
      {/* visual */}
      <View style={styles.visual}>
        {item.type === "player" ? (
          item.headshot ? (
            <Image source={item.headshot} style={styles.headshot} contentFit="cover" />
          ) : (
            <View style={styles.avatar}><Text style={styles.avInit}>{initials(item.headline)}</Text></View>
          )
        ) : (
          <View style={styles.matchup}>
            <NhlLogo abbr={item.away?.abbr} url={item.away?.logo} size={26} />
            <NhlLogo abbr={item.home?.abbr} url={item.home?.logo} size={26} />
          </View>
        )}
      </View>

      {/* text */}
      <View style={{ flex: 1 }}>
        <View style={styles.tagRow}>
          <Text style={[styles.tag, { color: item.type === "upcoming" ? colors.textDim : colors.blue }]}>
            {item.type === "final" ? "FINAL" : item.type === "upcoming" ? "COMING UP" : "PLAYER"}
          </Text>
          {item.followed ? <View style={styles.mineDot} /> : null}
        </View>
        <Text style={styles.headline} numberOfLines={2}>{item.headline}</Text>
        <Text style={styles.sub} numberOfLines={1}>
          {item.type === "final" && item.away && item.home
            ? `${item.away.abbr} ${item.away.score} · ${item.home.abbr} ${item.home.score}`
            : item.type === "upcoming"
            ? `${item.away?.abbr} @ ${item.home?.abbr}${item.date ? ` · ${niceDate(item.date)}` : ""}`
            : item.sub || ""}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: 110, gap: spacing.lg },
  head: { flexDirection: "row", alignItems: "center", gap: 8 },
  headBar: { width: 4, height: 20, borderRadius: 2, backgroundColor: colors.blue },
  headTitle: { color: colors.white, fontFamily: fonts.display, fontSize: 22, fontWeight: "800", letterSpacing: 1 },

  section: { gap: spacing.sm },
  card: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  cardMine: { borderColor: colors.blueDim, borderLeftWidth: 3, borderLeftColor: colors.blue },
  visual: { width: 56, alignItems: "center", justifyContent: "center" },
  headshot: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surfaceHi },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surfaceHi, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  avInit: { color: colors.white, fontFamily: fonts.display, fontSize: 15, fontWeight: "800" },
  matchup: { flexDirection: "row", alignItems: "center", gap: 2 },

  tagRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  tag: { fontFamily: fonts.accent, fontSize: 9.5, fontWeight: "700", letterSpacing: 1.5 },
  mineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.blue },
  headline: { color: colors.white, fontFamily: fonts.display, fontSize: 15.5, fontWeight: "700", letterSpacing: 0.2, marginTop: 2 },
  sub: { color: colors.textDim, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },

  empty: { alignItems: "center", paddingVertical: spacing.xxxl, gap: 6 },
  emptyText: { color: colors.textDim, fontFamily: fonts.display, fontSize: 16, fontWeight: "700" },
  emptySub: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 13 },

  build: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.blueDim, padding: spacing.lg },
  buildText: { flex: 1, color: colors.text, fontFamily: fonts.body, fontSize: 13.5 },
});
