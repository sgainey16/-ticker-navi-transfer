import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";

import { colors, fonts, spacing, radius } from "@/src/theme";
import { useApi } from "@/src/lib/useApi";
import { loadTeam, prefetchTeam } from "@/src/lib/cache";
import { Screen, Loader, ErrorState, SectionTitle } from "@/src/components/ui";
import { NhlLogo } from "@/src/components/NhlLogo";
import { TeamDesk } from "@/src/components/TeamDesk";
import { HighlightsModule } from "@/src/components/HighlightsModule";

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
  const q = useApi(() => loadTeam(lg, id), [id, lg]);

  if (q.loading) return <Screen><BackBar /><Loader label="Loading the team…" /></Screen>;
  if (q.error || !q.data) return <Screen><BackBar /><ErrorState message="Failed to load team" onRetry={q.reload} /></Screen>;

  const { team, record, goals, form, scorers, goalie, recent, next: nextGame, roster } = q.data;
  const divisionTeams = (q.data as any).division_teams || [];
  const diff = goals.diff ?? 0;
  const hasGoals = goals.gf != null || goals.ga != null;
  const gp = record.gp ?? ((record.wins || 0) + (record.losses || 0) + (record.ot || 0));
  const early = gp > 0 && gp < 10;
  const recForm = `${record.wins ?? 0}-${record.losses ?? 0}${record.ot ? `-${record.ot}` : ""}`;
  const hasL10 = !early && !!form.l10 && form.l10 !== "–";
  const readLine = early
    ? `${team.short} are ${record.wins ?? 0}-${record.losses ?? 0} to start the season, #${record.div_rank} in the ${team.division}.`
    : hasL10
      ? `${team.short} sit #${record.div_rank} in the ${team.division}, ${form.l10} over their last 10.`
      : `${team.short} sit #${record.div_rank} in the ${team.division} at ${recForm}.`;
  const lastFinal = recent && recent.length ? recent[0] : null;

  return (
    <Screen>
      <BackBar />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* CONTEXT BREADCRUMB — move up & sideways, never trapped */}
        <View style={styles.crumbs}>
          <Pressable style={styles.crumb} onPress={() => router.push(`/league/${lg}`)} testID="crumb-league">
            <Ionicons name="layers-outline" size={12} color={colors.blue} />
            <Text style={styles.crumbText}>{lg.toUpperCase()}</Text>
          </Pressable>
          <Ionicons name="chevron-forward" size={11} color={colors.textFaint} />
          <Pressable style={styles.crumb} onPress={() => router.push(`/league/${lg}?division=${encodeURIComponent(team.division || "")}`)} testID="crumb-division">
            <Text style={styles.crumbText} numberOfLines={1}>{team.division}</Text>
          </Pressable>
          <Ionicons name="chevron-forward" size={11} color={colors.textFaint} />
          <Text style={styles.crumbHere} numberOfLines={1}>{team.short}</Text>
        </View>

        {/* IDENTITY */}
        <View style={styles.banner}>
          <NhlLogo abbr={team.abbr} url={team.logo} size={64} />
          <Text style={styles.name}>{team.name}</Text>
          <Text style={styles.record}>{recForm}{record.points != null ? `  ·  ${record.points} PTS` : ""}  ·  #{record.div_rank} {team.division}</Text>
        </View>

        {/* Reggie + Marc — ONE continuous desk: PLAY the show or TALK to join */}
        <TeamDesk subject={id} league={lg} fallbackTitle={`${team.name.toUpperCase()} · ON THE DESK`} />

        {/* TICKER READ — one grounded line, sample-size aware */}
        <View style={styles.read}>
          <Ionicons name="mic" size={13} color={colors.blue} />
          <Text style={styles.readText}>{readLine}</Text>
        </View>

        {/* SEASON STRIP — stats support the story, they don't dominate */}
        <View style={styles.strip}>
          <StripStat label={early ? "START" : "RECORD"} value={recForm} />
          {hasGoals ? (
            <>
              <StripDivider />
              <StripStat label="GF" value={goals.gf ?? "–"} />
              <StripStat label="GA" value={goals.ga ?? "–"} />
              <StripStat label="DIFF" value={`${diff > 0 ? "+" : ""}${diff}`} accent={diff >= 0 ? colors.blue : colors.red} />
            </>
          ) : null}
          {hasL10 ? (<><StripDivider /><StripStat label="LAST 10" value={form.l10} /></>) : null}
        </View>

        {/* NEXT GAME — opponent tappable (jump straight to Kamloops), card opens the game */}
        {nextGame ? (
          <View style={styles.section}>
            <SectionTitle title="Next Game" accent={colors.blue} />
            <Pressable style={styles.card} testID="team-next" onPress={() => router.push(`/game/${nextGame.id}${lq}`)}>
              <View style={styles.gRow}>
                <TeamTap abbr={nextGame.away.abbr} logo={nextGame.away.logo} onPress={() => { prefetchTeam(lg, nextGame.away.abbr); router.push(`/team/${nextGame.away.abbr}${lq}`); }} />
                <Text style={styles.gAt}>@</Text>
                <TeamTap abbr={nextGame.home.abbr} logo={nextGame.home.logo} onPress={() => { prefetchTeam(lg, nextGame.home.abbr); router.push(`/team/${nextGame.home.abbr}${lq}`); }} />
                <View style={{ flex: 1 }} />
                <Text style={styles.gWhen}>{niceDate(nextGame.date)}{nextGame.start_utc ? `\n${fmtTime(nextGame.start_utc)}` : ""}</Text>
                <Ionicons name="chevron-forward" size={15} color={colors.textFaint} />
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
                <Pressable key={s.player_id ?? i} style={styles.pRow} onPress={() => s.player_id && router.push(`/player/${s.player_id}${lq}${lq ? "&" : "?"}name=${encodeURIComponent(s.name || "")}&pos=${encodeURIComponent(s.pos || "")}`)}>
                  <Text style={styles.pRank}>{i + 1}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pName}>{s.name}</Text>
                    <Text style={styles.pMeta}>{s.pos}{s.gp != null ? ` · ${s.gp} GP` : ""}</Text>
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

        {/* LAST GAME — watch it: verified Highlightly video (renders nothing if none matched) */}
        {lastFinal ? (
          <View style={styles.section}>
            <SectionTitle title="Last Game" accent={colors.blue} />
            <Pressable style={styles.card} onPress={() => router.push(`/game/${lastFinal.id}${lq}`)}>
              <View style={styles.gRow}>
                <NhlLogo abbr={lastFinal.away.abbr} url={lastFinal.away.logo} size={24} />
                <Text style={styles.gAbbr}>{lastFinal.away.abbr} {lastFinal.away.score ?? ""}</Text>
                <Text style={styles.gAt}>–</Text>
                <Text style={styles.gAbbr}>{lastFinal.home.score ?? ""} {lastFinal.home.abbr}</Text>
                <NhlLogo abbr={lastFinal.home.abbr} url={lastFinal.home.logo} size={24} />
                <View style={{ flex: 1 }} />
                <Text style={styles.gWhen}>{niceDate(lastFinal.date)}</Text>
                <Ionicons name="chevron-forward" size={15} color={colors.textFaint} />
              </View>
            </Pressable>
            <HighlightsModule league={lg} home={lastFinal.home?.name} away={lastFinal.away?.name} date={lastFinal.start_utc || lastFinal.date} />
          </View>
        ) : null}

        {/* RECENT RESULTS (older finals) */}
        {recent && recent.length > 1 ? (
          <View style={styles.section}>
            <SectionTitle title="Recent Results" accent={colors.blue} />
            <View style={{ gap: spacing.sm }}>
              {recent.slice(1).map((g: any) => (
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

        {/* AROUND THE DIVISION — sideways movement to every rival (incl. Kamloops) */}
        {divisionTeams.length ? (
          <View style={styles.section}>
            <SectionTitle title={`Around the ${team.division}`} accent={colors.blue} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
              {divisionTeams.map((d: any) => {
                const here = d.abbr === team.abbr;
                return (
                  <Pressable
                    key={d.abbr}
                    style={[styles.divCard, here && styles.divCardHere]}
                    disabled={here}
                    onPressIn={() => !here && prefetchTeam(lg, d.abbr)}
                    onPress={() => !here && router.push(`/team/${d.abbr}${lq}`)}
                    testID={`division-team-${d.abbr}`}
                  >
                    <NhlLogo abbr={d.abbr} url={d.logo} size={34} />
                    <Text style={styles.divName} numberOfLines={1}>{d.short || d.abbr}</Text>
                    <Text style={styles.divRec}>{d.wins ?? 0}-{d.losses ?? 0}{d.ot != null ? `-${d.ot}` : ""}</Text>
                    <Text style={styles.divRank}>#{d.div_rank}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
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

function StripStat({ label, value, accent }: { label: string; value: any; accent?: string }) {
  return (
    <View style={styles.stripCell}>
      <Text style={[styles.stripVal, accent && { color: accent }]}>{value}</Text>
      <Text style={styles.stripLabel}>{label}</Text>
    </View>
  );
}

function StripDivider() {
  return <View style={styles.stripDivider} />;
}

function TeamTap({ abbr, logo, onPress }: { abbr: string; logo?: string | null; onPress: () => void }) {
  return (
    <Pressable style={styles.teamTap} onPress={onPress} hitSlop={6} testID={`next-team-${abbr}`}>
      <NhlLogo abbr={abbr} url={logo} size={26} />
      <Text style={styles.gAbbr}>{abbr}</Text>
    </Pressable>
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

  crumbs: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.lg, paddingTop: spacing.xs },
  crumb: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.surface, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.blueDim, paddingHorizontal: 10, paddingVertical: 5, maxWidth: 160 },
  crumbText: { color: colors.blue, fontFamily: fonts.display, fontSize: 12, fontWeight: "700", letterSpacing: 0.3 },
  crumbHere: { color: colors.textDim, fontFamily: fonts.display, fontSize: 12, fontWeight: "700", flexShrink: 1 },

  banner: { alignItems: "center", paddingTop: spacing.xs, paddingBottom: spacing.sm, gap: 4 },
  name: { color: colors.white, fontFamily: fonts.display, fontSize: 25, fontWeight: "800", letterSpacing: 0.5, marginTop: spacing.sm, textAlign: "center" },
  record: { color: colors.textDim, fontFamily: fonts.display, fontSize: 13, fontWeight: "700", letterSpacing: 0.3, marginTop: 2, textAlign: "center" },

  read: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.blueDim, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  readText: { color: colors.text, fontFamily: fonts.body, fontSize: 13.5, lineHeight: 18, flex: 1 },

  strip: { flexDirection: "row", alignItems: "center", marginHorizontal: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingVertical: spacing.sm, paddingHorizontal: spacing.xs },
  stripCell: { flex: 1, alignItems: "center", gap: 2, paddingHorizontal: 2 },
  stripVal: { color: colors.text, fontFamily: fonts.display, fontSize: 15, fontWeight: "800" },
  stripLabel: { color: colors.textFaint, fontFamily: fonts.accent, fontSize: 8.5, fontWeight: "700", letterSpacing: 1 },
  stripDivider: { width: StyleSheet.hairlineWidth, alignSelf: "stretch", backgroundColor: colors.border, marginVertical: 2 },

  section: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md },

  gRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  gAbbr: { color: colors.text, fontFamily: fonts.display, fontSize: 15, fontWeight: "800" },
  gAt: { color: colors.textFaint, fontFamily: fonts.display, fontSize: 13, fontWeight: "700" },
  gWhen: { color: colors.textFaint, fontFamily: fonts.accent, fontSize: 10, fontWeight: "600", letterSpacing: 0.5, textAlign: "right" },

  teamTap: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4, paddingHorizontal: 4, borderRadius: radius.sm },

  rail: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingRight: spacing.xl },
  divCard: { width: 96, alignItems: "center", gap: 3, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingVertical: spacing.md, paddingHorizontal: 6 },
  divCardHere: { borderColor: colors.blue, backgroundColor: colors.bgElev },
  divName: { color: colors.text, fontFamily: fonts.display, fontSize: 12.5, fontWeight: "700", marginTop: 2 },
  divRec: { color: colors.textDim, fontFamily: fonts.body, fontSize: 11 },
  divRank: { color: colors.blue, fontFamily: fonts.accent, fontSize: 9, fontWeight: "700", letterSpacing: 0.5 },

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
