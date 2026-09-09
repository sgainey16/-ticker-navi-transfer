import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { colors, fonts, spacing, radius } from "@/src/theme";
import { api } from "@/src/lib/api";
import { useApi } from "@/src/lib/useApi";
import { Screen, Loader, ErrorState, SectionTitle } from "@/src/components/ui";
import { BackBar } from "@/app/team/[id]";
import { NhlLogo } from "@/src/components/NhlLogo";

const FINAL = ["OFF", "FINAL"];

function periodName(p: number, type?: string) {
  if (type === "OT") return "OT";
  if (type === "SO") return "SO";
  return ["1st", "2nd", "3rd", "4th"][p - 1] || `P${p}`;
}
function strengthTag(s?: string, en?: boolean) {
  if (en) return "EN";
  if (s === "pp") return "PP";
  if (s === "sh") return "SH";
  return "";
}
function fmtDate(d?: string) {
  if (!d) return "";
  try { return new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }); }
  catch { return d; }
}
function fmtTime(utc?: string) {
  if (!utc) return "";
  const d = new Date(utc);
  let h = d.getHours(); const m = d.getMinutes();
  const ap = h >= 12 ? "PM" : "AM"; h = h % 12; if (h === 0) h = 12;
  return `${h}:${m.toString().padStart(2, "0")} ${ap}`;
}
function seriesLine(g: any): string | null {
  const s = g.series;
  if (!s) return null;
  if (s.clinched_by) {
    const hi = Math.max(s.home_wins ?? 0, s.away_wins ?? 0);
    const lo = Math.min(s.home_wins ?? 0, s.away_wins ?? 0);
    return `${s.clinched_by} win the series ${hi}–${lo}`;
  }
  if (s.home_wins != null && s.away_wins != null) {
    if (s.home_wins === s.away_wins) return `Series tied ${s.home_wins}–${s.away_wins}`;
    const lead = s.home_wins > s.away_wins ? g.home.abbr : g.away.abbr;
    const hi = Math.max(s.home_wins, s.away_wins), lo = Math.min(s.home_wins, s.away_wins);
    return `${lead} lead the series ${hi}–${lo}`;
  }
  return s.round_label || null;
}

// Team stats categories to surface (label + provider key), rendered only if present.
const STAT_ROWS: [string, string][] = [
  ["Shots on Goal", "sog"],
  ["Power Play", "powerPlay"],
  ["PIM", "pim"],
  ["Faceoff %", "faceoffWinningPctg"],
  ["Hits", "hits"],
  ["Blocked Shots", "blockedShots"],
];

function fmtStat(k: string, v: any): string {
  if (v == null) return "–";
  if (typeof v === "number" && v > 0 && v < 1) return `${(v * 100).toFixed(1)}%`;
  return String(v);
}

export default function GameDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const q = useApi(() => api.nhlGame(id), [id]);

  if (q.loading) return <Screen><BackBar /><Loader label="Loading the game…" /></Screen>;
  if (q.error || !q.data) return <Screen><BackBar /><ErrorState message="Failed to load game" onRetry={q.reload} /></Screen>;

  const g = q.data.game;
  const isFinal = FINAL.includes(g.status);
  const isFuture = g.status === "FUT" || g.status === "PRE";
  const awayWin = isFinal && (g.away.score ?? 0) > (g.home.score ?? 0);
  const homeWin = isFinal && (g.home.score ?? 0) > (g.away.score ?? 0);
  const teamByAbbr = (abbr: string) => (abbr === g.home.abbr ? g.home : g.away);

  const goalPeriods: number[] = [...new Set((g.scoring || []).map((s: any) => s.period))] as number[];
  const statRows = STAT_ROWS.filter(([, k]) => g.team_stats?.[k]);

  return (
    <Screen>
      <BackBar />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* SCOREBOARD (single panel) */}
        {g.series?.round_label ? (
          <Text style={styles.seriesKicker}>{g.series.round_label}{g.series.game_number ? ` · GAME ${g.series.game_number}` : ""}</Text>
        ) : null}
        <View style={styles.board}>
          <TeamCol abbr={g.away.abbr} name={g.away.name} logo={g.away.logo} score={g.away.score} isFinal={isFinal} win={awayWin} />
          <View style={styles.center}>
            <Text style={[styles.status, !isFinal && { color: colors.blue }]}>
              {isFinal ? "FINAL" : isFuture ? "UPCOMING" : (g.status || "").toUpperCase()}
            </Text>
            {!isFinal && isFuture ? <Text style={styles.puck}>{fmtTime(g.start_utc)}</Text> : <Text style={styles.dash}>—</Text>}
          </View>
          <TeamCol abbr={g.home.abbr} name={g.home.name} logo={g.home.logo} score={g.home.score} isFinal={isFinal} win={homeWin} />
        </View>

        <Text style={styles.subMeta}>{fmtDate(g.date)}{g.venue ? ` · ${g.venue}` : ""}</Text>
        {seriesLine(g) ? <Text style={styles.seriesLine}>{seriesLine(g)}</Text> : null}

        {/* PLAY THE CALL -> existing Reggie + Marc recap engine (finals only) */}
        {isFinal ? (
          <Pressable
            style={styles.playBtn}
            testID="game-play-the-call"
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push(`/recap/${g.id}`); }}
          >
            <Ionicons name="play" size={16} color={colors.white} />
            <Text style={styles.playText}>PLAY THE CALL</Text>
          </Pressable>
        ) : null}

        {/* HIGHLIGHTS MODULE — clean slot for a future real clips module. Not built yet. */}

        {/* SCORING SUMMARY */}
        {g.scoring?.length ? (
          <View style={styles.section}>
            <SectionTitle title="Scoring Summary" accent={colors.blue} />
            <View style={styles.card}>
              {goalPeriods.map((p) => (
                <View key={p} style={styles.periodBlock}>
                  <Text style={styles.periodLabel}>{periodName(p, (g.scoring.find((s: any) => s.period === p) || {}).period_type)}</Text>
                  {g.scoring.filter((s: any) => s.period === p).map((s: any, i: number) => {
                    const t = teamByAbbr(s.team_abbr);
                    const tag = strengthTag(s.strength, s.empty_net);
                    return (
                      <View key={i} style={styles.playRow}>
                        <Text style={styles.playTime}>{s.time}</Text>
                        <NhlLogo abbr={t.abbr} url={t.logo} size={22} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.playMain}>
                            {s.scorer}{tag ? <Text style={styles.tag}>  {tag}</Text> : null}
                          </Text>
                          {s.assists?.length ? <Text style={styles.playSub}>Assists: {s.assists.join(", ")}</Text> : <Text style={styles.playSub}>Unassisted</Text>}
                        </View>
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* THREE STARS */}
        {g.three_stars?.length ? (
          <View style={styles.section}>
            <SectionTitle title="Three Stars" accent={colors.blue} />
            <View style={styles.card}>
              {g.three_stars.map((s: any) => (
                <View key={s.star} style={styles.starRow}>
                  <Text style={styles.starNum}>{s.star}</Text>
                  <NhlLogo abbr={s.team_abbr} url={teamByAbbr(s.team_abbr)?.logo} size={22} />
                  <Text style={styles.starName}>{s.name}</Text>
                  {s.note ? <Text style={styles.starNote}>{s.note}</Text> : null}
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* KEY PLAYERS (box score) */}
        {g.top_skaters?.length ? (
          <View style={styles.section}>
            <SectionTitle title="Key Players" accent={colors.blue} />
            <View style={styles.card}>
              <View style={styles.kpHead}>
                <Text style={[styles.kpH, { flex: 1 }]}>SKATER</Text>
                <Text style={styles.kpHNum}>G</Text>
                <Text style={styles.kpHNum}>A</Text>
                <Text style={styles.kpHNum}>P</Text>
                <Text style={styles.kpHNum}>SOG</Text>
              </View>
              {g.top_skaters.map((s: any, i: number) => (
                <View key={i} style={styles.kpRow}>
                  <NhlLogo abbr={s.team_abbr} url={teamByAbbr(s.team_abbr)?.logo} size={20} />
                  <Text style={styles.kpName} numberOfLines={1}>{s.name}</Text>
                  <Text style={styles.kpNum}>{s.goals}</Text>
                  <Text style={styles.kpNum}>{s.assists}</Text>
                  <Text style={styles.kpNumBold}>{s.points}</Text>
                  <Text style={styles.kpNum}>{s.sog ?? "–"}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* GOALIES */}
        {g.goalies?.length ? (
          <View style={styles.section}>
            <SectionTitle title="Goaltending" accent={colors.blue} />
            <View style={styles.card}>
              {g.goalies.map((gl: any, i: number) => (
                <View key={i} style={styles.kpRow}>
                  <NhlLogo abbr={gl.team_abbr} url={teamByAbbr(gl.team_abbr)?.logo} size={20} />
                  <Text style={styles.kpName} numberOfLines={1}>{gl.name}{gl.decision ? ` (${gl.decision})` : ""}{gl.shutout ? " · SO" : ""}</Text>
                  <Text style={styles.goalieStat}>{gl.saves}/{gl.shots_against} SV</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* TEAM STATS */}
        {statRows.length ? (
          <View style={styles.section}>
            <SectionTitle title="Team Stats" accent={colors.blue} />
            <View style={styles.card}>
              <View style={styles.tsHead}>
                <Text style={styles.tsTeam}>{g.away.abbr}</Text>
                <Text style={styles.tsLabelHead} />
                <Text style={styles.tsTeam}>{g.home.abbr}</Text>
              </View>
              {statRows.map(([label, k]) => (
                <View key={k} style={styles.tsRow}>
                  <Text style={styles.tsVal}>{fmtStat(k, g.team_stats[k].away)}</Text>
                  <Text style={styles.tsLabel}>{label}</Text>
                  <Text style={styles.tsVal}>{fmtStat(k, g.team_stats[k].home)}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* PENALTIES */}
        {g.penalties?.length ? (
          <View style={styles.section}>
            <SectionTitle title="Penalties" accent={colors.blue} />
            <View style={styles.card}>
              {g.penalties.map((p: any, i: number) => {
                const t = teamByAbbr(p.team_abbr);
                return (
                  <View key={i} style={styles.playRow}>
                    <Text style={styles.playTime}>{periodName(p.period, p.period_type)} {p.time}</Text>
                    <NhlLogo abbr={t.abbr} url={t.logo} size={20} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.playMain}>{p.player || t.abbr}</Text>
                      <Text style={styles.playSub}>{p.desc || p.type}{p.duration ? ` · ${p.duration} min` : ""}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        {isFuture && !g.scoring?.length ? (
          <View style={styles.section}>
            <Text style={styles.upcomingNote}>Full scoring, box score and the Reggie &amp; Marc call unlock once this game is final.</Text>
          </View>
        ) : null}

        <View style={{ height: spacing.xxxl }} />
      </ScrollView>
    </Screen>
  );
}

function TeamCol({ abbr, name, logo, score, isFinal, win }: { abbr: string; name: string; logo?: string | null; score?: number | null; isFinal: boolean; win: boolean }) {
  return (
    <View style={styles.teamCol}>
      <NhlLogo abbr={abbr} url={logo} size={52} />
      <Text style={styles.teamName} numberOfLines={2}>{name}</Text>
      {isFinal ? <Text style={[styles.bigScore, { color: win ? colors.white : colors.textDim }]}>{score}</Text> : <Text style={styles.teamAbbr}>{abbr}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md },
  seriesKicker: { color: colors.blue, fontFamily: fonts.accent, fontSize: 11, fontWeight: "700", letterSpacing: 2, textAlign: "center" },
  board: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingVertical: spacing.sm },
  teamCol: { alignItems: "center", gap: 6, flex: 1 },
  teamName: { color: colors.textDim, fontFamily: fonts.display, fontSize: 13, fontWeight: "700", letterSpacing: 0.3, textAlign: "center" },
  teamAbbr: { color: colors.text, fontFamily: fonts.display, fontSize: 18, fontWeight: "800", letterSpacing: 0.5 },
  bigScore: { fontFamily: fonts.display, fontSize: 52, fontWeight: "800", lineHeight: 54 },
  center: { alignItems: "center", gap: 4, paddingTop: spacing.lg, width: 78 },
  status: { color: colors.red, fontFamily: fonts.accent, fontSize: 12, fontWeight: "700", letterSpacing: 1.5 },
  dash: { color: colors.textFaint, fontFamily: fonts.display, fontSize: 22, fontWeight: "700" },
  puck: { color: colors.text, fontFamily: fonts.display, fontSize: 15, fontWeight: "700" },
  subMeta: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 12, textAlign: "center", marginTop: -2 },
  seriesLine: { color: colors.text, fontFamily: fonts.display, fontSize: 13, fontWeight: "700", textAlign: "center", letterSpacing: 0.3 },

  playBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.blue, borderRadius: radius.pill, paddingVertical: 14, marginTop: spacing.xs },
  playText: { color: colors.white, fontFamily: fonts.display, fontSize: 15, fontWeight: "800", letterSpacing: 1 },

  section: { gap: spacing.sm, marginTop: spacing.sm },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md },

  periodBlock: { marginBottom: spacing.sm },
  periodLabel: { color: colors.textFaint, fontFamily: fonts.accent, fontSize: 10, fontWeight: "700", letterSpacing: 1.2, marginBottom: 6 },
  playRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  playTime: { color: colors.textDim, fontFamily: fonts.display, fontSize: 12, fontWeight: "700", width: 64 },
  playMain: { color: colors.text, fontFamily: fonts.display, fontSize: 15, fontWeight: "700" },
  tag: { color: colors.blue, fontFamily: fonts.accent, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  playSub: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 11, marginTop: 1 },

  starRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm },
  starNum: { color: colors.blue, fontFamily: fonts.display, fontSize: 16, fontWeight: "800", width: 18 },
  starName: { color: colors.text, fontFamily: fonts.display, fontSize: 15, fontWeight: "700", flex: 1 },
  starNote: { color: colors.textDim, fontFamily: fonts.body, fontSize: 12 },

  kpHead: { flexDirection: "row", alignItems: "center", paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.sm },
  kpH: { color: colors.textFaint, fontFamily: fonts.accent, fontSize: 10, fontWeight: "600", letterSpacing: 0.5, marginLeft: 28 },
  kpHNum: { color: colors.textFaint, fontFamily: fonts.accent, fontSize: 10, fontWeight: "600", width: 30, textAlign: "center" },
  kpRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  kpName: { color: colors.text, fontFamily: fonts.display, fontSize: 14, fontWeight: "700", flex: 1 },
  kpNum: { color: colors.textDim, fontFamily: fonts.display, fontSize: 15, fontWeight: "600", width: 30, textAlign: "center" },
  kpNumBold: { color: colors.white, fontFamily: fonts.display, fontSize: 15, fontWeight: "800", width: 30, textAlign: "center" },
  goalieStat: { color: colors.textDim, fontFamily: fonts.display, fontSize: 13, fontWeight: "700" },

  tsHead: { flexDirection: "row", alignItems: "center", paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  tsTeam: { color: colors.text, fontFamily: fonts.display, fontSize: 14, fontWeight: "800", width: 56, textAlign: "center" },
  tsLabelHead: { flex: 1 },
  tsRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm },
  tsVal: { color: colors.text, fontFamily: fonts.display, fontSize: 15, fontWeight: "700", width: 56, textAlign: "center" },
  tsLabel: { color: colors.textDim, fontFamily: fonts.body, fontSize: 12, flex: 1, textAlign: "center" },

  upcomingNote: { color: colors.textDim, fontFamily: fonts.body, fontSize: 13, lineHeight: 19, textAlign: "center" },
});
