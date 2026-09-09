import React, { useMemo, useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { colors, fonts, spacing, radius, fontSize } from "@/src/theme";
import { api, NhlGameCard } from "@/src/lib/api";
import { useApi } from "@/src/lib/useApi";
import { TabScreen, SectionTitle, Loader, ErrorState } from "@/src/components/ui";
import { TickerStrip } from "@/src/components/TickerStrip";
import { NhlLogo } from "@/src/components/NhlLogo";
import { TickerDesk } from "@/src/components/TickerDesk";
import { GameRail } from "@/src/components/GameRail";
import { GameDepth } from "@/src/components/GameDepth";

function fmtTime(utc?: string | null) {
  if (!utc) return "";
  const d = new Date(utc);
  let h = d.getHours();
  const m = d.getMinutes();
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m.toString().padStart(2, "0")} ${ap}`;
}

function niceDate(iso?: string | null) {
  if (!iso) return "";
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

export default function Home() {
  const router = useRouter();
  const feed = useApi(() => api.nhlHome());
  const recapsQ = useApi(() => api.nhlRecaps());

  const slateGames = useMemo(() => feed.data?.slate?.games || [], [feed.data]);
  const finals = useMemo(() => recapsQ.data?.games || [], [recapsQ.data]);

  // HAPPENING / RECENT — live games first, then recent finals (importance, not a schedule list).
  const happening = useMemo(() => {
    const live = slateGames.filter((g) => g.group === "live");
    const seen = new Set<string>();
    const out: NhlGameCard[] = [];
    [...live, ...finals].forEach((g) => {
      if (!seen.has(g.id)) { seen.add(g.id); out.push(g as NhlGameCard); }
    });
    return out;
  }, [slateGames, finals]);

  // NEXT — what's coming (upcoming only).
  const upcoming = useMemo(() => slateGames.filter((g) => g.group === "upcoming"), [slateGames]);

  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (selectedId && happening.some((g) => g.id === selectedId)) return;
    const heroId = feed.data?.hero?.game?.id;
    if (heroId && happening.some((g) => g.id === heroId)) setSelectedId(heroId);
    else if (happening.length) setSelectedId(happening[0].id);
  }, [happening, selectedId, feed.data]);
  const selectedGame = useMemo(() => happening.find((g) => g.id === selectedId), [happening, selectedId]);

  const tickerItems = useMemo(() => {
    return slateGames.map((x) => {
      if (x.group === "final") return `${x.away.abbr} ${x.away.score}, ${x.home.abbr} ${x.home.score} · FINAL`;
      if (x.group === "live") return `${x.away.abbr} ${x.away.score}-${x.home.score} ${x.home.abbr} · P${x.period} ${x.clock}`;
      return `${x.away.abbr} @ ${x.home.abbr} · ${fmtTime(x.start_utc)}`;
    });
  }, [slateGames]);

  const hero = feed.data?.hero?.game;
  const heroLive = hero?.status && !["OFF", "FINAL"].includes(hero.status);

  return (
    <TabScreen>
      {tickerItems.length ? <TickerStrip items={tickerItems} /> : null}

      {feed.loading ? (
        <Loader label="Tuning in the wire…" />
      ) : feed.error ? (
        <ErrorState message="Unable to load THE TICKER" onRetry={() => feed.reload()} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl tintColor={colors.blue} refreshing={false} onRefresh={() => { feed.reload(); recapsQ.reload(); }} />}
        >
          {/* 1. SHOW — Reggie + Marc open The Ticker (prepared/cached, honest, no fake personalization) */}
          <TickerDesk surface="home" fallbackTitle="YOUR HOCKEY STARTS HERE" />

          {/* 2. HAPPENING / RECENT — the headline worth knowing, as a game (not another desk) */}
          {hero ? (
            <Pressable
              testID="home-spotlight"
              style={styles.spot}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(`/game/${hero.id}`); }}
            >
              <View style={styles.spotTop}>
                <Text style={styles.spotKicker}>
                  {heroLive ? "HAPPENING NOW" : (hero.series?.round_label
                    ? `${hero.series.round_label}${hero.series.game_number ? ` · GAME ${hero.series.game_number}` : ""}`
                    : "WORTH KNOWING")}
                </Text>
                <View style={[styles.badge, heroLive && { backgroundColor: colors.red }]}>
                  {heroLive ? <View style={styles.badgeDot} /> : null}
                  <Text style={styles.badgeText}>{heroLive ? "LIVE" : "FINAL"}</Text>
                </View>
              </View>
              <View style={styles.spotScoreRow}>
                <NhlLogo abbr={hero.away.abbr} url={hero.away.logo} size={30} />
                <Text style={styles.spotTeam}>{hero.away.abbr}</Text>
                <Text style={styles.spotScore}>{hero.away.score}</Text>
                <Text style={styles.spotDash}>–</Text>
                <Text style={styles.spotScore}>{hero.home.score}</Text>
                <Text style={styles.spotTeam}>{hero.home.abbr}</Text>
                <NhlLogo abbr={hero.home.abbr} url={hero.home.logo} size={30} />
                <View style={{ flex: 1 }} />
                <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
              </View>
            </Pressable>
          ) : null}

          {/* Browse the hockey that matters — selecting only changes depth below */}
          {happening.length ? (
            <View style={styles.section}>
              <SectionTitle title="Around the NHL" accent={colors.blue} />
              <GameRail games={happening} selectedId={selectedId} onSelect={setSelectedId} />
              <GameDepth summary={selectedGame} />
            </View>
          ) : null}

          {/* 3. NEXT — what's coming (compact, points to the NEXT show; taps open the Game) */}
          {upcoming.length ? (
            <View style={styles.section}>
              <SectionTitle
                title="Coming Up"
                accent={colors.blue}
                action={feed.data?.slate?.date ? <Text style={styles.dateTxt}>{niceDate(feed.data.slate.date)}</Text> : undefined}
              />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.upRow}>
                {upcoming.map((g) => (
                  <Pressable key={g.id} style={styles.upCard} onPress={() => router.push(`/game/${g.id}`)}>
                    <Text style={styles.upTime}>{fmtTime(g.start_utc)}</Text>
                    <View style={styles.upTeams}>
                      <NhlLogo abbr={g.away.abbr} url={g.away.logo} size={18} />
                      <Text style={styles.upAbbr}>{g.away.abbr}</Text>
                      <Text style={styles.upAt}>@</Text>
                      <Text style={styles.upAbbr}>{g.home.abbr}</Text>
                      <NhlLogo abbr={g.home.abbr} url={g.home.logo} size={18} />
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}

          {/* 4. MY TEAMS / MY PLAYERS — future personalization slots.
              Rendered ONLY when real follows exist (capability-driven). No fake teams,
              no empty "Coming Soon" boxes. Onboarding/follows will populate this cleanly. */}

          <View style={{ height: spacing.xxxl }} />
        </ScrollView>
      )}
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: 110, gap: spacing.lg },

  spot: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.sm },
  spotTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  spotKicker: { color: colors.blue, fontFamily: fonts.accent, fontSize: 11, fontWeight: "700", letterSpacing: 2 },
  badge: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.surfaceHi, borderWidth: 1, borderColor: colors.borderStrong, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.sm },
  badgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.white },
  badgeText: { color: colors.white, fontFamily: fonts.display, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  spotScoreRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  spotTeam: { color: colors.text, fontFamily: fonts.display, fontSize: fontSize.lg, fontWeight: "700", letterSpacing: 0.5 },
  spotScore: { color: colors.white, fontFamily: fonts.display, fontSize: 26, fontWeight: "800", lineHeight: 28 },
  spotDash: { color: colors.textFaint, fontFamily: fonts.display, fontSize: 20, fontWeight: "700" },

  section: { gap: spacing.sm },
  dateTxt: { color: colors.textFaint, fontFamily: fonts.accent, fontSize: 11, fontWeight: "600", letterSpacing: 1 },

  upRow: { gap: spacing.sm, paddingRight: spacing.lg },
  upCard: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: 6, minWidth: 132 },
  upTime: { color: colors.textFaint, fontFamily: fonts.accent, fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  upTeams: { flexDirection: "row", alignItems: "center", gap: 6 },
  upAbbr: { color: colors.text, fontFamily: fonts.display, fontSize: 13, fontWeight: "800" },
  upAt: { color: colors.textFaint, fontFamily: fonts.display, fontSize: 11 },
});
