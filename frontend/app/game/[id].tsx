import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useLocalSearchParams } from "expo-router";

import { colors, fonts, spacing, radius, hostStyle } from "@/src/theme";
import { api } from "@/src/lib/api";
import { useApi } from "@/src/lib/useApi";
import { Screen, Loader, ErrorState, SectionTitle } from "@/src/components/ui";
import { TeamLogo } from "@/src/components/TeamLogo";
import { StatCompare } from "@/src/components/stats";
import { ArenaBoard } from "@/src/components/ArenaBoard";
import { BackBar } from "@/app/team/[id]";

export default function GameDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useApi(() => api.game(id), [id]);

  if (q.loading) return <Screen><BackBar /><Loader /></Screen>;
  if (q.error || !q.data) return <Screen><BackBar /><ErrorState message="Failed to load match" onRetry={q.reload} /></Screen>;

  const { game, home, away } = q.data;
  const hs = game.stats.home;
  const as = game.stats.away;

  return (
    <Screen>
      <BackBar />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* SCOREBOARD */}
        <View style={styles.board}>
          <TeamCol team={away} score={game.away_score} win={game.away_score > game.home_score} />
          <View style={styles.center}>
            <Text style={styles.final}>FINAL</Text>
            <Text style={styles.vs}>VS</Text>
            <Text style={styles.date}>{fmt(game.date)}</Text>
          </View>
          <TeamCol team={home} score={game.home_score} win={game.home_score > game.away_score} />
        </View>

        {/* QUARTER LINE SCORE */}
        <View style={styles.lineScore}>
          <View style={styles.lsHead}>
            <Text style={[styles.lsCell, styles.lsTeamCol]} />
            {["Q1", "Q2", "Q3", "Q4", "T"].map((q) => (
              <Text key={q} style={[styles.lsCell, styles.lsHeadTxt]}>{q}</Text>
            ))}
          </View>
          {[{ t: away, k: 1 }, { t: home, k: 0 }].map(({ t, k }) => (
            <View key={t.id} style={styles.lsRow}>
              <View style={[styles.lsTeamCol, styles.lsTeamCell]}>
                <TeamLogo abbr={t.abbr} primary={t.primary} secondary={t.secondary} size={22} />
                <Text style={styles.lsAbbr}>{t.abbr}</Text>
              </View>
              {game.quarters.map((qr, i) => (
                <Text key={i} style={[styles.lsCell, styles.lsNum]}>{qr[k]}</Text>
              ))}
              <Text style={[styles.lsCell, styles.lsTotal]}>{k === 0 ? game.home_score : game.away_score}</Text>
            </View>
          ))}
        </View>

        {/* TEAM STATS */}
        <View style={styles.section}>
          <SectionTitle title="Team Stats" />
          <View style={styles.statLegend}>
            <Legend color={colors.blue} label={away.abbr} />
            <Text style={styles.ppLabel}>POWER PLAY  {as.power_play}  /  {hs.power_play}</Text>
            <Legend color={colors.green} label={home.abbr} right />
          </View>
          <View style={styles.statCard}>
            <StatCompare label="Shots" away={as.shots} home={hs.shots} awayColor={colors.blue} homeColor={colors.green} />
            <StatCompare label="On Goal" away={as.sog} home={hs.sog} awayColor={colors.blue} homeColor={colors.green} />
            <StatCompare label="Possession %" away={as.possession} home={hs.possession} awayColor={colors.blue} homeColor={colors.green} />
            <StatCompare label="Saves" away={as.saves} home={hs.saves} awayColor={colors.blue} homeColor={colors.green} />
          </View>
        </View>

        {/* TACTICS BOARD */}
        <View style={styles.section}>
          <SectionTitle title="On The Turf" />
          <View style={styles.statCard}>
            <ArenaBoard homeColor={colors.green} awayColor={colors.blue} />
          </View>
        </View>

        {/* SCORING TIMELINE */}
        <View style={styles.section}>
          <SectionTitle title="Scoring" />
          <View style={styles.statCard}>
            {game.timeline.map((e, i) => {
              const t = e.team === home.id ? home : away;
              return (
                <View key={i} style={styles.tlRow}>
                  <View style={[styles.tlDot, { backgroundColor: e.team === home.id ? colors.green : colors.blue }]} />
                  <Text style={styles.tlQ}>Q{e.q} · {e.time}</Text>
                  <TeamLogo abbr={t.abbr} primary={t.primary} secondary={t.secondary} size={20} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tlPlayer}>{e.player}</Text>
                    <Text style={styles.tlNote}>{e.note}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* HOST COMMENTARY */}
        <View style={styles.section}>
          <SectionTitle title="From The Booth" />
          <HostQuote host="rayo" name={'Mateo "Rayo" Reyes'} text={game.commentary.rayo} />
          <HostQuote host="casey" name="Casey Whitfield" text={game.commentary.casey} />
        </View>
        <View style={{ height: spacing.xxxl }} />
      </ScrollView>
    </Screen>
  );
}

function TeamCol({ team, score, win }: { team: any; score: number; win: boolean }) {
  return (
    <View style={styles.teamCol}>
      <TeamLogo abbr={team.abbr} primary={team.primary} secondary={team.secondary} size={48} />
      <Text style={styles.teamColName}>{team.short}</Text>
      <Text style={[styles.bigScore, { color: win ? colors.green : colors.text }]}>{score}</Text>
    </View>
  );
}

function Legend({ color, label, right }: { color: string; label: string; right?: boolean }) {
  return (
    <View style={[styles.legend, right && { flexDirection: "row-reverse" }]}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendTxt}>{label}</Text>
    </View>
  );
}

function HostQuote({ host, name, text }: { host: "rayo" | "casey"; name: string; text: string }) {
  const s = hostStyle[host];
  return (
    <View style={[styles.quote, { borderLeftColor: s.accent }]} testID={`commentary-${host}`}>
      <View style={styles.quoteHead}>
        <Text style={[styles.quoteName, { color: s.accent }]}>{name}</Text>
        <Text style={styles.quoteRole}>{s.label}</Text>
      </View>
      <Text style={styles.quoteText}>{text}</Text>
    </View>
  );
}

function fmt(d: string) {
  try { return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
  catch { return d; }
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxxl },
  board: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.xl, paddingVertical: spacing.lg },
  teamCol: { alignItems: "center", gap: 4, flex: 1 },
  teamColName: { color: colors.textDim, fontFamily: fonts.display, fontSize: 14, fontWeight: "700", letterSpacing: 0.5 },
  bigScore: { fontFamily: fonts.display, fontSize: 56, fontWeight: "800", lineHeight: 58 },
  center: { alignItems: "center", gap: 2 },
  final: { color: colors.red, fontFamily: fonts.accent, fontSize: 11, fontWeight: "700", letterSpacing: 1.5 },
  vs: { color: colors.textFaint, fontFamily: fonts.display, fontSize: 16, fontWeight: "700" },
  date: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 11 },

  lineScore: { marginHorizontal: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  lsHead: { flexDirection: "row", alignItems: "center", paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  lsRow: { flexDirection: "row", alignItems: "center", paddingTop: spacing.sm },
  lsCell: { flex: 1, textAlign: "center" },
  lsTeamCol: { flex: 2 },
  lsTeamCell: { flexDirection: "row", alignItems: "center", gap: 6 },
  lsHeadTxt: { color: colors.textFaint, fontFamily: fonts.accent, fontSize: 11, fontWeight: "600", letterSpacing: 0.5 },
  lsAbbr: { color: colors.text, fontFamily: fonts.display, fontSize: 15, fontWeight: "700" },
  lsNum: { color: colors.textDim, fontFamily: fonts.display, fontSize: 16, fontWeight: "600" },
  lsTotal: { color: colors.green, fontFamily: fonts.display, fontSize: 18, fontWeight: "800" },

  section: { paddingHorizontal: spacing.lg, marginTop: spacing.xl, gap: spacing.sm },
  statCard: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.lg },
  statLegend: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.xs },
  legend: { flexDirection: "row", alignItems: "center", gap: 6, width: 60 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendTxt: { color: colors.text, fontFamily: fonts.display, fontSize: 13, fontWeight: "700" },
  ppLabel: { color: colors.textDim, fontFamily: fonts.accent, fontSize: 10, fontWeight: "600", letterSpacing: 0.5, flex: 1, textAlign: "center" },

  tlRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  tlDot: { width: 8, height: 8, borderRadius: 4 },
  tlQ: { color: colors.textFaint, fontFamily: fonts.display, fontSize: 12, fontWeight: "700", width: 62 },
  tlPlayer: { color: colors.text, fontFamily: fonts.display, fontSize: 15, fontWeight: "700" },
  tlNote: { color: colors.textDim, fontFamily: fonts.body, fontSize: 11, fontStyle: "italic" },

  quote: { backgroundColor: colors.surface, borderRadius: radius.md, borderLeftWidth: 3, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm },
  quoteHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  quoteName: { fontFamily: fonts.display, fontSize: 14, fontWeight: "800", letterSpacing: 0.3 },
  quoteRole: { color: colors.textFaint, fontFamily: fonts.accent, fontSize: 9, fontWeight: "600", letterSpacing: 1 },
  quoteText: { color: colors.text, fontFamily: fonts.body, fontSize: 14, lineHeight: 21 },
});
