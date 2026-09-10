import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";

import { colors, fonts, spacing, radius } from "@/src/theme";
import { api } from "@/src/lib/api";
import { useApi } from "@/src/lib/useApi";
import { Screen, Loader, ErrorState, SectionTitle } from "@/src/components/ui";
import { NhlLogo } from "@/src/components/NhlLogo";
import { TickerDesk } from "@/src/components/TickerDesk";

function niceDate(iso?: string) {
  if (!iso) return "";
  try { return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }); }
  catch { return iso; }
}
function fmtTime(utc?: string) {
  if (!utc) return "";
  const d = new Date(utc); let h = d.getHours(); const m = d.getMinutes();
  const ap = h >= 12 ? "PM" : "AM"; h = h % 12; if (h === 0) h = 12;
  return `${h}:${m.toString().padStart(2, "0")} ${ap}`;
}

export default function TeamPage() {
  const { id, league } = useLocalSearchParams<{ id: string; league?: string }>();
  const lg = league || "nhl";
  const isNhl = lg === "nhl";
  const lq = isNhl ? "" : `?league=${lg}`;
  const router = useRouter();
  const q = useApi(() => (isNhl ? api.nhlTeam(id) : api.leagueTeam(lg, id)), [id, lg]);

  if (q.loading) return <Screen><BackBar /><Loader label="Loading the team…" /></Screen>;
  if (q.error || !q.data) return <Screen><BackBar /><ErrorState message="Failed to load team" onRetry={q.reload} /></Screen>;

  const { team, record, goals, form, scorers, goalie, recent, next: nextGame, roster } = q.data;
  const diff = goals.diff ?? 0;

  return (
    <Screen>
      <BackBar />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* IDENTITY */}
        <View style={styles.banner}>
          <NhlLogo abbr={team.abbr} url={team.logo} size={68} />
          <Text style={styles.name}>{team.name}</Text>
          <Text style={styles.meta}>#{record.div_rank} {team.division} · #{record.conf_rank} {team.conference}</Text>
          <Text style={styles.record}>{record.wins}-{record.losses}-{record.ot}  ·  {record.points} PTS</Text>
        </View>

        {/* Reggie + Marc — present on the team, speak only on deliberate Play */}
        <TickerDesk surface="team" subject={id} league={lg} fallbackTitle={`${team.name.toUpperCase()} · ON THE DESK`} />

        {/* TICKER READ — verified data restated, one line (no second host panel) */}
        <View style={styles.read}>
          <Ionicons name="mic" size={13} color={colors.blue} />
          <Text style={styles.readText}>
            {team.short} sit #{record.div_rank} in the {team.division}, {form.l10} over their last 10 ({form.streak}).
          </Text>
        </View>

        {/* KEY NUMBERS */}
        <View style={styles.grid}>
          <Stat label="GF" value={goals.gf} />
          <Stat label="GA" value={goals.ga} />
          <Stat label="DIFF" value={`${diff > 0 ? "+" : ""}${diff}`} accent={diff >= 0 ? colors.blue : colors.red} />
          <Stat label="L10" value={form.l10} />
          <Stat label="HOME" value={form.home} />
          <Stat label="ROAD" value={form.road} />
        </View>

        {/* NEXT GAME */}
        {nextGame ? (
          <View style={styles.section}>
            <SectionTitle title="Next Game" accent={colors.blue} />
            <Pressable style={styles.card} testID="team-next" onPress={() => router.push(`/game/${nextGame.id}${lq}`)}>
              <View style={styles.gRow}>
                <NhlLogo abbr={nextGame.away.abbr} url={nextGame.away.logo} size={26} />
                <Text style={styles.gAbbr}>{nextGame.away.abbr}</Text>
                <Text style={styles.gAt}>@</Text>
                <Text style={styles.gAbbr}>{nextGame.home.abbr}</Text>
                <NhlLogo abbr={nextGame.home.abbr} url={nextGame.home.logo} size={26} />
                <View style={{ flex: 1 }} />
                <Text style={styles.gWhen}>{niceDate(nextGame.date)}{nextGame.start_utc ? `\n${fmtTime(nextGame.start_utc)}` : ""}</Text>
              </View>
            </Pressable>
          </View>
        ) : null}

        {/* TOP SCORERS — people first */}
        {scorers?.length ? (
          <View style={styles.section}>
            <SectionTitle title="Leading the Way" accent={colors.blue} />
            <View style={styles.card}>
              {scorers.map((s: any, i: number) => (
                <Pressable key={s.player_id ?? i} style={styles.pRow} onPress={() => s.player_id && router.push(`/player/${s.player_id}${lq}`)}>
                  <Text style={styles.pRank}>{i + 1}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pName}>{s.name}</Text>
                    <Text style={styles.pMeta}>{s.pos} · {s.gp} GP</Text>
                  </View>
                  <Text style={styles.pPts}>{s.points}</Text>
                  <Text style={styles.pSub}>{s.goals}G {s.assists}A</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {/* GOALIE */}
        {goalie ? (
          <View style={styles.section}>
            <SectionTitle title="In Goal" accent={colors.blue} />
            <View style={styles.card}>
              <Pressable style={styles.pRow} onPress={() => goalie.player_id && router.push(`/player/${goalie.player_id}${lq}`)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.pName}>{goalie.name}</Text>
                  <Text style={styles.pMeta}>{goalie.record}{goalie.so ? ` · ${goalie.so} SO` : ""}</Text>
                </View>
                <Text style={styles.pPts}>{goalie.svpct ?? "–"}</Text>
                <Text style={styles.pSub}>{goalie.gaa ?? "–"} GAA</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* TEAM HIGHLIGHTS — reserved future slot; renders nothing until a real source exists. */}

        {/* RECENT RESULTS */}
        {recent?.length ? (
          <View style={styles.section}>
            <SectionTitle title="Recent Results" accent={colors.blue} />
            <View style={{ gap: spacing.sm }}>
              {recent.map((g: any) => (
                <Pressable key={g.id} style={styles.card} onPress={() => router.push(`/game/${g.id}${lq}`)}>
                  <View style={styles.gRow}>
                    <NhlLogo abbr={g.away.abbr} url={g.away.logo} size={24} />
                    <Text style={styles.gAbbr}>{g.away.abbr} {g.away.score}</Text>
                    <Text style={styles.gAt}>–</Text>
                    <Text style={styles.gAbbr}>{g.home.score} {g.home.abbr}</Text>
                    <NhlLogo abbr={g.home.abbr} url={g.home.logo} size={24} />
                    <View style={{ flex: 1 }} />
                    <Text style={styles.gWhen}>{niceDate(g.date)}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {/* ROSTER */}
        {roster ? (
          <View style={styles.section}>
            <SectionTitle title="Roster" accent={colors.blue} />
            {(["forwards", "defensemen", "goalies"] as const).map((grp) =>
              roster[grp]?.length ? (
                <View key={grp} style={styles.rosterBlock}>
                  <Text style={styles.rosterLabel}>{grp.toUpperCase()}</Text>
                  <View style={styles.rosterWrap}>
                    {roster[grp].map((p: any) => (
                      <Pressable key={p.player_id} style={styles.chip} onPress={() => p.player_id && router.push(`/player/${p.player_id}${lq}`)}>
                        <Text style={styles.chipNum}>{p.number ?? "–"}</Text>
                        <Text style={styles.chipName} numberOfLines={1}>{p.name}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null
            )}
          </View>
        ) : null}

        <View style={{ height: spacing.xxxl }} />
      </ScrollView>
    </Screen>
  );
}

function Stat({ label, value, accent }: { label: string; value: any; accent?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statVal, accent && { color: accent }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export function BackBar() {
  const router = useRouter();
  return (
    <View style={styles.backBar}>
      <Pressable testID="back-button" onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
        <Ionicons name="chevron-back" size={22} color={colors.text} />
        <Text style={styles.backText}>Back</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  backBar: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 2, alignSelf: "flex-start" },
  backText: { color: colors.text, fontFamily: fonts.display, fontSize: 15, fontWeight: "700" },

  content: { paddingBottom: spacing.xxxl, gap: spacing.md },
  banner: { alignItems: "center", paddingTop: spacing.sm, paddingBottom: spacing.md, gap: 4 },
  name: { color: colors.white, fontFamily: fonts.display, fontSize: 26, fontWeight: "800", letterSpacing: 0.5, marginTop: spacing.sm, textAlign: "center" },
  meta: { color: colors.textDim, fontFamily: fonts.accent, fontSize: 11, fontWeight: "600", letterSpacing: 1 },
  record: { color: colors.white, fontFamily: fonts.display, fontSize: 16, fontWeight: "800", letterSpacing: 0.5, marginTop: 2 },

  read: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.blueDim, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  readText: { color: colors.textDim, fontFamily: fonts.body, fontSize: 12.5, lineHeight: 17, flex: 1 },

  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: spacing.lg, gap: spacing.sm },
  stat: { width: "31%", flexGrow: 1, backgroundColor: colors.surface, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, paddingVertical: spacing.md, alignItems: "center", gap: 2 },
  statVal: { color: colors.text, fontFamily: fonts.display, fontSize: 18, fontWeight: "800" },
  statLabel: { color: colors.textFaint, fontFamily: fonts.accent, fontSize: 9, fontWeight: "700", letterSpacing: 1 },

  section: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md },

  gRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  gAbbr: { color: colors.text, fontFamily: fonts.display, fontSize: 15, fontWeight: "800" },
  gAt: { color: colors.textFaint, fontFamily: fonts.display, fontSize: 13, fontWeight: "700" },
  gWhen: { color: colors.textFaint, fontFamily: fonts.accent, fontSize: 10, fontWeight: "600", letterSpacing: 0.5, textAlign: "right" },

  pRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  pRank: { color: colors.blue, fontFamily: fonts.display, fontSize: 14, fontWeight: "800", width: 16 },
  pName: { color: colors.text, fontFamily: fonts.display, fontSize: 15, fontWeight: "700" },
  pMeta: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 11 },
  pPts: { color: colors.white, fontFamily: fonts.display, fontSize: 18, fontWeight: "800", width: 40, textAlign: "right" },
  pSub: { color: colors.textDim, fontFamily: fonts.body, fontSize: 11, width: 54, textAlign: "right" },

  rosterBlock: { gap: 6, marginTop: spacing.xs },
  rosterLabel: { color: colors.textFaint, fontFamily: fonts.accent, fontSize: 10, fontWeight: "700", letterSpacing: 1.2 },
  rosterWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.surface, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 8, paddingVertical: 6 },
  chipNum: { color: colors.blue, fontFamily: fonts.display, fontSize: 12, fontWeight: "800", minWidth: 16 },
  chipName: { color: colors.textDim, fontFamily: fonts.display, fontSize: 12, fontWeight: "600", maxWidth: 120 },
});
