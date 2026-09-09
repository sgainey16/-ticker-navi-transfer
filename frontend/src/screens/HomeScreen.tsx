import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { colors, fonts, spacing, radius, fontSize } from "@/src/theme";
import { api, NhlGameCard } from "@/src/lib/api";
import { useApi } from "@/src/lib/useApi";
import { TabScreen, SectionTitle, Loader, ErrorState, Pill } from "@/src/components/ui";
import { TickerStrip } from "@/src/components/TickerStrip";
import { TickerLogo } from "@/src/components/TickerLogo";
import { NhlLogo } from "@/src/components/NhlLogo";

const HERO = require("../../assets/images/broadcast-desk.png");

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

function slateLabel(gt?: number | null) {
  if (gt === 1) return "PRESEASON";
  if (gt === 3) return "STANLEY CUP PLAYOFFS";
  return "AROUND THE NHL";
}

export default function Home() {
  const router = useRouter();
  const feed = useApi(() => api.nhlHome());

  const games = useMemo(() => feed.data?.slate?.games || [], [feed.data]);
  const grouped = useMemo(() => {
    const g = { live: [] as NhlGameCard[], upcoming: [] as NhlGameCard[], final: [] as NhlGameCard[] };
    games.forEach((x) => g[x.group]?.push(x));
    return g;
  }, [games]);

  const tickerItems = useMemo(() => {
    const items = games.map((x) => {
      if (x.group === "final") return `${x.away.abbr} ${x.away.score}, ${x.home.abbr} ${x.home.score} · FINAL`;
      if (x.group === "live") return `${x.away.abbr} ${x.away.score}-${x.home.score} ${x.home.abbr} · P${x.period} ${x.clock}`;
      return `${x.away.abbr} @ ${x.home.abbr} · ${fmtTime(x.start_utc)}`;
    });
    return items;
  }, [games]);

  const hero = feed.data?.hero;
  const hg = hero?.game;
  const heroLive = hg?.status && !["OFF", "FINAL"].includes(hg.status);

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
          refreshControl={<RefreshControl tintColor={colors.blue} refreshing={false} onRefresh={() => feed.reload()} />}
        >
          {/* HEADER */}
          <View style={styles.topRow}>
            <View>
              <Text style={styles.brand}>THE TICKER</Text>
              <Text style={styles.brandSub}>ALL HOCKEY. ALL FANS. NO INTERMISSION.</Text>
            </View>
            <Pill label="NHL" color={colors.white} bg={colors.blueDim} />
          </View>

          {/* HERO — most recent completed game + Reggie/Marc take */}
          {hg ? (
            <Pressable
              testID="ticker-hero"
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/recap/latest"); }}
              style={styles.hero}
            >
              <Image source={HERO} style={StyleSheet.absoluteFill} contentFit="cover" />
              <LinearGradient colors={["rgba(5,7,12,0.35)", "rgba(5,7,12,0.72)", "rgba(5,7,12,0.97)"]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
              <View style={styles.heroTop}>
                <TickerLogo width={112} />
                <View style={[styles.badge, heroLive && { backgroundColor: colors.red }]}>
                  {heroLive ? <View style={styles.badgeDot} /> : null}
                  <Text style={styles.badgeText}>{heroLive ? "LIVE" : "FINAL"}</Text>
                </View>
              </View>

              <View style={styles.heroBottom}>
                <Text style={styles.heroKicker}>
                  {hg.series?.round_label
                    ? `${hg.series.round_label}${hg.series.game_number ? ` · GAME ${hg.series.game_number}` : ""}`
                    : "LATEST FINAL"}
                </Text>

                <View style={styles.heroScoreRow}>
                  <NhlLogo abbr={hg.away.abbr} url={hg.away.logo} size={34} />
                  <Text style={styles.heroTeam}>{hg.away.abbr}</Text>
                  <Text style={styles.heroScore}>{hg.away.score}</Text>
                  <Text style={styles.heroDash}>–</Text>
                  <Text style={styles.heroScore}>{hg.home.score}</Text>
                  <Text style={styles.heroTeam}>{hg.home.abbr}</Text>
                  <NhlLogo abbr={hg.home.abbr} url={hg.home.logo} size={34} />
                </View>

                <View style={styles.playBtn}>
                  <Ionicons name="play" size={15} color={colors.white} />
                  <Text style={styles.playText}>PLAY THE CALL</Text>
                </View>
              </View>
            </Pressable>
          ) : null}

          {/* SLATE */}
          {games.length ? (
            <View style={styles.section}>
              <SectionTitle
                title={slateLabel(games[0]?.game_type)}
                accent={colors.blue}
                action={<Text style={styles.dateTxt}>{feed.data?.slate?.date}</Text>}
              />

              {grouped.live.length ? (
                <SlateGroup label="LIVE NOW" games={grouped.live} router={router} />
              ) : null}
              {grouped.upcoming.length ? (
                <SlateGroup label="UPCOMING" games={grouped.upcoming} router={router} />
              ) : null}
              {grouped.final.length ? (
                <SlateGroup label="FINAL" games={grouped.final} router={router} />
              ) : null}
            </View>
          ) : null}
        </ScrollView>
      )}
    </TabScreen>
  );
}

function SlateGroup({ label, games, router }: { label: string; games: NhlGameCard[]; router: ReturnType<typeof useRouter> }) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupLabel}>{label}</Text>
      <View style={{ gap: spacing.sm }}>
        {games.map((g) => (
          <GameCard key={g.id} g={g} onPress={g.group === "final" ? () => router.push(`/recap/${g.id}`) : undefined} />
        ))}
      </View>
    </View>
  );
}

function GameCard({ g, onPress }: { g: NhlGameCard; onPress?: () => void }) {
  const isFinal = g.group === "final";
  const isLive = g.group === "live";
  const winnerAway = isFinal && (g.away.score ?? 0) > (g.home.score ?? 0);
  const winnerHome = isFinal && (g.home.score ?? 0) > (g.away.score ?? 0);

  return (
    <Pressable style={[styles.card, onPress && styles.cardTappable]} onPress={onPress} disabled={!onPress}>
      {/* away */}
      <View style={styles.side}>
        <NhlLogo abbr={g.away.abbr} url={g.away.logo} size={30} />
        <View>
          <Text style={[styles.cardAbbr, winnerAway && styles.winner]}>{g.away.abbr}</Text>
          {g.away.record ? <Text style={styles.cardRec}>{g.away.record}</Text> : null}
        </View>
      </View>

      {/* center */}
      <View style={styles.center}>
        {isFinal || isLive ? (
          <Text style={styles.centerScore}>{g.away.score} – {g.home.score}</Text>
        ) : (
          <Text style={styles.centerTime}>{fmtTime(g.start_utc)}</Text>
        )}
        <Text style={styles.centerState}>
          {isLive ? `P${g.period ?? ""} ${g.clock ?? ""}`.trim() : isFinal ? "FINAL" : "PUCK DROP"}
        </Text>
      </View>

      {/* home */}
      <View style={[styles.side, styles.sideRight]}>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={[styles.cardAbbr, winnerHome && styles.winner]}>{g.home.abbr}</Text>
          {g.home.record ? <Text style={styles.cardRec}>{g.home.record}</Text> : null}
        </View>
        <NhlLogo abbr={g.home.abbr} url={g.home.logo} size={30} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: 110, gap: spacing.xl },

  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brand: { color: colors.white, fontFamily: fonts.display, fontSize: 26, fontWeight: "800", letterSpacing: 1 },
  brandSub: { color: colors.textFaint, fontFamily: fonts.accent, fontSize: 9, fontWeight: "600", letterSpacing: 1.6, marginTop: 2 },

  hero: { minHeight: 320, borderRadius: radius.lg, overflow: "hidden", borderWidth: 1, borderColor: colors.border, justifyContent: "space-between" },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.lg },
  heroBottom: { padding: spacing.lg, gap: spacing.sm },
  badge: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.surfaceHi, borderWidth: 1, borderColor: colors.borderStrong, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.sm },
  badgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.white },
  badgeText: { color: colors.white, fontFamily: fonts.display, fontSize: 11, fontWeight: "800", letterSpacing: 1 },

  heroKicker: { color: colors.blue, fontFamily: fonts.accent, fontSize: 11, fontWeight: "700", letterSpacing: 2 },
  heroScoreRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  heroTeam: { color: colors.text, fontFamily: fonts.display, fontSize: fontSize.lg, fontWeight: "700", letterSpacing: 0.5 },
  heroScore: { color: colors.white, fontFamily: fonts.display, fontSize: 30, fontWeight: "800", lineHeight: 32 },
  heroDash: { color: colors.textFaint, fontFamily: fonts.display, fontSize: 22, fontWeight: "700" },

  playBtn: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", backgroundColor: colors.blue, paddingHorizontal: spacing.lg, paddingVertical: 10, borderRadius: radius.pill, marginTop: spacing.sm },
  playText: { color: colors.white, fontFamily: fonts.display, fontSize: 14, fontWeight: "800", letterSpacing: 0.8 },

  section: { gap: spacing.sm },
  dateTxt: { color: colors.textFaint, fontFamily: fonts.accent, fontSize: 11, fontWeight: "600", letterSpacing: 1 },

  group: { gap: spacing.sm, marginTop: spacing.xs },
  groupLabel: { color: colors.textFaint, fontFamily: fonts.accent, fontSize: 10, fontWeight: "700", letterSpacing: 1.4, marginTop: spacing.xs },

  card: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  cardTappable: { borderColor: colors.blueDim },
  side: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  sideRight: { justifyContent: "flex-end" },
  cardAbbr: { color: colors.text, fontFamily: fonts.display, fontSize: 17, fontWeight: "700", letterSpacing: 0.4 },
  cardRec: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 10 },
  winner: { color: colors.white },

  center: { alignItems: "center", minWidth: 78 },
  centerScore: { color: colors.white, fontFamily: fonts.display, fontSize: 20, fontWeight: "800", letterSpacing: 1 },
  centerTime: { color: colors.text, fontFamily: fonts.display, fontSize: 16, fontWeight: "700" },
  centerState: { color: colors.textFaint, fontFamily: fonts.accent, fontSize: 9, fontWeight: "600", letterSpacing: 1, marginTop: 2 },
});
