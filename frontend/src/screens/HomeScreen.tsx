import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { colors, fonts, spacing, radius, fontSize } from "@/src/theme";
import { api, Team } from "@/src/lib/api";
import { useApi } from "@/src/lib/useApi";
import { TabScreen, SectionTitle, Loader, ErrorState, LiveBadge, Pill } from "@/src/components/ui";
import { goToTab } from "@/src/lib/tabnav";
import { useBroadcast } from "@/src/lib/broadcast";
import { TickerLogo } from "@/src/components/TickerLogo";
import { TickerStrip } from "@/src/components/TickerStrip";
import { ScoreRow } from "@/src/components/ScoreRow";
import { TeamLogo } from "@/src/components/TeamLogo";

const HERO = require("../../assets/images/broadcast-desk.png");

export default function Home() {
  const router = useRouter();
  const broadcast = useBroadcast();
  const home = useApi(() => api.home());
  const teams = useApi(() => api.teams());

  const teamMap = useMemo(() => {
    const m: Record<string, Team> = {};
    teams.data?.teams.forEach((t) => (m[t.id] = t));
    return m;
  }, [teams.data]);

  const loading = home.loading || teams.loading;
  const error = home.error || teams.error;

  return (
    <TabScreen>
      <TickerStrip items={home.data?.ticker || ["Loading the wire…"]} />

      {loading ? (
        <Loader label="Loading broadcast feed…" />
      ) : error ? (
        <ErrorState message="Unable to load broadcast feed" onRetry={() => { home.reload(); teams.reload(); }} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl tintColor={colors.green} refreshing={false} onRefresh={() => { home.reload(); teams.reload(); }} />}
        >
          <View style={styles.topRow}>
            <Text style={styles.hi}>THE BROADCAST HUB</Text>
            <Pill label="2025-26 SEASON" color={colors.green} bg={colors.greenDim} />
          </View>

          {/* HERO COLD OPEN */}
          <Pressable
            testID="cold-open-hero"
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); broadcast.start("home"); }}
            style={styles.hero}
          >
            <Image source={HERO} style={StyleSheet.absoluteFill} contentFit="cover" />
            <LinearGradient colors={["rgba(5,7,12,0.15)", "rgba(5,7,12,0.55)", "rgba(5,7,12,0.96)"]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
            <View style={styles.heroTop}>
              <TickerLogo width={116} />
              <LiveBadge label="COLD OPEN" />
            </View>
            <View style={styles.heroBottom}>
              <Text style={styles.heroKicker}>THE VICTORY+ HOOK</Text>
              <Text style={styles.heroTitle}>{home.data.cold_open.subtitle}</Text>
              <Text style={styles.heroScore}>
                {teamMap[home.data.cold_open.matchup.away]?.abbr} {home.data.cold_open.matchup.away_score}
                {"  —  "}
                {home.data.cold_open.matchup.home_score} {teamMap[home.data.cold_open.matchup.home]?.abbr}
              </Text>
              <View style={styles.playBtn}>
                <Ionicons name="play" size={16} color={colors.bg} />
                <Text style={styles.playText}>PLAY THE COLD OPEN</Text>
              </View>
            </View>
          </Pressable>

          {/* FEATURED GAME */}
          <View style={styles.section}>
            <SectionTitle title="Featured" action={<Pill label="RECORD NIGHT" color={colors.gold} bg={"#2A2205"} />} />
            <ScoreRow
              home={teamMap[home.data.recaps[0].home_id]}
              away={teamMap[home.data.recaps[0].away_id]}
              homeScore={home.data.recaps[0].home_score}
              awayScore={home.data.recaps[0].away_score}
              date={home.data.recaps[0].date}
              onPress={() => router.push(`/game/${home.data.featured_game}`)}
            />
          </View>

          {/* SCORING LEADER */}
          <View style={styles.section}>
            <SectionTitle title="On Top" accent={colors.gold} />
            <Pressable testID="leader-card" style={styles.leader} onPress={() => router.push(`/player/${home.data.leader.id}`)}>
              <TeamLogo abbr={teamMap[home.data.leader.team_id]?.abbr || ""} primary={teamMap[home.data.leader.team_id]?.primary || colors.gold} secondary={teamMap[home.data.leader.team_id]?.secondary} size={52} />
              <View style={{ flex: 1 }}>
                <Text style={styles.leaderLabel}>{home.data.leader.label}</Text>
                <Text style={styles.leaderName}>{home.data.leader.name}</Text>
                <Text style={styles.leaderTeam}>{teamMap[home.data.leader.team_id]?.name}</Text>
              </View>
              <View style={styles.leaderStat}>
                <Text style={styles.leaderNum}>52</Text>
                <Text style={styles.leaderUnit}>GOALS</Text>
              </View>
            </Pressable>
          </View>

          {/* STANDINGS SNAPSHOT */}
          <View style={styles.section}>
            <SectionTitle title="Standings" action={<Pressable testID="see-standings" onPress={() => goToTab("scores")}><Text style={styles.seeAll}>SEE ALL</Text></Pressable>} />
            {(["Eastern", "Western"] as const).map((conf) => (
              <View key={conf} style={styles.confBlock}>
                <Text style={styles.confLabel}>{conf.toUpperCase()} · TOP 2</Text>
                {home.data.standings_snippet[conf].map((r: any) => (
                  <Pressable key={r.id} style={styles.standRow} onPress={() => router.push(`/team/${r.id}`)}>
                    <Text style={styles.standRank}>{r.rank}</Text>
                    <TeamLogo abbr={r.abbr} primary={r.primary} secondary={r.secondary} size={28} />
                    <Text style={styles.standName}>{r.short}</Text>
                    <Text style={styles.standRec}>{r.wins}-{r.losses}</Text>
                    <Text style={styles.standPts}>{r.points}<Text style={styles.standPtsUnit}> PTS</Text></Text>
                  </Pressable>
                ))}
              </View>
            ))}
          </View>

          {/* RECAPS */}
          <View style={styles.section}>
            <SectionTitle title="Recaps" />
            <View style={{ gap: spacing.sm }}>
              {home.data.recaps.map((g: any) => (
                <ScoreRow key={g.id} home={teamMap[g.home_id]} away={teamMap[g.away_id]} homeScore={g.home_score} awayScore={g.away_score} date={g.date} onPress={() => router.push(`/game/${g.id}`)} />
              ))}
            </View>
          </View>
        </ScrollView>
      )}
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: 110, gap: spacing.xl },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  hi: { color: colors.textDim, fontFamily: fonts.display, fontSize: 15, fontWeight: "700", letterSpacing: 1.5 },

  hero: { height: 300, borderRadius: radius.lg, overflow: "hidden", borderWidth: 1, borderColor: colors.border, justifyContent: "space-between" },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.lg },
  heroBottom: { padding: spacing.lg, gap: spacing.xs },
  heroKicker: { color: colors.green, fontFamily: fonts.accent, fontSize: 11, fontWeight: "700", letterSpacing: 2 },
  heroTitle: { color: colors.white, fontFamily: fonts.display, fontSize: fontSize.xxl, fontWeight: "800", letterSpacing: 0.5 },
  heroScore: { color: colors.textDim, fontFamily: fonts.display, fontSize: fontSize.lg, fontWeight: "700", letterSpacing: 1, marginTop: 2 },
  playBtn: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", backgroundColor: colors.green, paddingHorizontal: spacing.lg, paddingVertical: 10, borderRadius: radius.pill, marginTop: spacing.md },
  playText: { color: colors.bg, fontFamily: fonts.display, fontSize: 14, fontWeight: "800", letterSpacing: 0.8 },

  section: { gap: spacing.sm },
  seeAll: { color: colors.green, fontFamily: fonts.display, fontSize: 13, fontWeight: "700", letterSpacing: 1 },

  leader: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.lg },
  leaderLabel: { color: colors.gold, fontFamily: fonts.accent, fontSize: 10, fontWeight: "600", letterSpacing: 1 },
  leaderName: { color: colors.white, fontFamily: fonts.display, fontSize: fontSize.xl, fontWeight: "800", letterSpacing: 0.3 },
  leaderTeam: { color: colors.textDim, fontFamily: fonts.body, fontSize: 12 },
  leaderStat: { alignItems: "center" },
  leaderNum: { color: colors.gold, fontFamily: fonts.display, fontSize: 34, fontWeight: "800", lineHeight: 34 },
  leaderUnit: { color: colors.textFaint, fontFamily: fonts.accent, fontSize: 9, fontWeight: "600", letterSpacing: 1 },

  confBlock: { gap: 4, marginBottom: spacing.sm },
  confLabel: { color: colors.textFaint, fontFamily: fonts.accent, fontSize: 10, fontWeight: "600", letterSpacing: 1.2, marginBottom: 4, marginTop: spacing.sm },
  standRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  standRank: { color: colors.textFaint, fontFamily: fonts.display, fontSize: 16, fontWeight: "700", width: 16 },
  standName: { color: colors.text, fontFamily: fonts.display, fontSize: 16, fontWeight: "700", flex: 1, letterSpacing: 0.3 },
  standRec: { color: colors.textDim, fontFamily: fonts.display, fontSize: 15, fontWeight: "600" },
  standPts: { color: colors.green, fontFamily: fonts.display, fontSize: 18, fontWeight: "800", width: 62, textAlign: "right" },
  standPtsUnit: { color: colors.textFaint, fontFamily: fonts.accent, fontSize: 9, fontWeight: "600" },
});
