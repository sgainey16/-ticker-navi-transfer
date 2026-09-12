import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";

import { colors, fonts, spacing, radius } from "@/src/theme";
import { api } from "@/src/lib/api";
import { useApi } from "@/src/lib/useApi";
import { Screen, Loader, ErrorState, SectionTitle } from "@/src/components/ui";
import { BackBar } from "@/app/team/[id]";
import { NhlLogo } from "@/src/components/NhlLogo";
import { setContextLeague } from "@/src/lib/context";

function niceDate(iso?: string) {
  if (!iso) return "";
  try { return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }); }
  catch { return iso; }
}
function fmtTime(utc?: string) {
  if (!utc) return "";
  const d = new Date(utc); let h = d.getHours(); const m = d.getMinutes();
  const ap = h >= 12 ? "PM" : "AM"; h = h % 12; if (h === 0) h = 12;
  return `${h}:${m.toString().padStart(2, "0")} ${ap}`;
}
function age(iso?: string) {
  if (!iso) return null;
  const b = new Date(iso); const n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--;
  return a;
}

export default function PlayerPage() {
  const { id, league, name, pos } = useLocalSearchParams<{ id: string; league?: string; name?: string; pos?: string }>();
  const lg = (league || "nhl").toLowerCase();
  const lq = lg !== "nhl" ? `?league=${lg}` : "";
  const router = useRouter();
  const q = useApi(() => (lg === "nhl" ? api.nhlPlayer(id) : api.leaguePlayer(lg, id, name || "", pos || "")), [id, lg]);
  React.useEffect(() => { setContextLeague(lg); }, [lg]);

  if (q.loading) return <Screen><BackBar /><Loader label="Loading the player…" /></Screen>;
  if (q.error || !q.data) return <Screen><BackBar /><ErrorState message="Failed to load player" onRetry={q.reload} /></Screen>;

  const { player: p, skater, goalie, last5, next: nextGame, highlights, ep } = q.data;
  const a = age(p.birth_date);
  // PLAYER HIGHLIGHTS are capability-driven, never required. The page is complete without them.
  // `highlights` is only present when the provider supplies verified player-linked video for this
  // player_id. When absent/empty the entire section disappears — no empty space, no "Coming Soon",
  // no unavailable message, no fake content. Same Player Page across leagues; richer when data is.
  const hasHighlights = Array.isArray(highlights) && highlights.length > 0;

  const read = goalie
    ? `${goalie.svpct ?? "–"} SV%, ${goalie.gaa ?? "–"} GAA across ${goalie.gp ?? 0} games this season.`
    : `${skater?.goals ?? 0}G, ${skater?.assists ?? 0}A, ${skater?.points ?? 0} points in ${skater?.gp ?? 0} games this season.`;

  return (
    <Screen>
      <BackBar />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* IDENTITY */}
        <View style={styles.header}>
          {p.headshot ? <Image source={p.headshot} style={styles.headshot} contentFit="cover" /> : <View style={styles.headshot} />}
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{p.name}</Text>
            <Pressable style={styles.teamRow} onPress={() => p.team_abbr && router.push(`/team/${p.team_abbr}${lq}`)} testID="player-team">
              <NhlLogo abbr={p.team_abbr} url={p.team_logo} size={20} />
              <Text style={styles.teamText}>#{p.number} · {p.pos} · {p.team_abbr}</Text>
            </Pressable>
            <Text style={styles.bio}>
              {[p.height, p.weight ? `${p.weight} lb` : null, p.shoots ? `Shoots ${p.shoots}` : null].filter(Boolean).join(" · ")}
            </Text>
            <Text style={styles.bio}>
              {[a != null ? `Age ${a}` : null, [p.birth_city, p.birth_country].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}
            </Text>
          </View>
        </View>

        {/* TICKER read — verified restatement, one line */}
        <View style={styles.readWrap}>
          <Ionicons name="mic" size={13} color={colors.blue} />
          <Text style={styles.readText}>{read}</Text>
        </View>

        {/* BACKGROUND — Elite Prospects depth Highlightly can't give: draft, path, styles, bio.
            Renders only when EP has a verified match; otherwise absent (no placeholder). */}
        {ep ? (
          <View style={styles.section}>
            <SectionTitle title="Background" accent={colors.blue} />
            <View style={styles.epCard}>
              {ep.draft ? <EpRow icon="trophy-outline" label="Draft" value={ep.draft} /> : null}
              {ep.nhl_rights ? <EpRow icon="shield-checkmark-outline" label="Rights" value={ep.nhl_rights} /> : null}
              {ep.birthplace ? <EpRow icon="location-outline" label="Born" value={[ep.birthplace, ep.dob].filter(Boolean).join(" · ")} /> : null}
              {ep.youth_team ? <EpRow icon="home-outline" label="Youth" value={ep.youth_team} /> : null}
              {(ep.height || ep.weight) ? <EpRow icon="body-outline" label="Frame" value={[ep.height, ep.weight, ep.shoots ? `shoots ${ep.shoots}` : null].filter(Boolean).join(" · ")} /> : null}
              {ep.styles?.length ? (
                <View style={styles.styleWrap}>
                  {ep.styles.map((s: string) => (<View key={s} style={styles.chip}><Text style={styles.chipText}>{s}</Text></View>))}
                </View>
              ) : null}
              {ep.career_leagues?.length ? <EpRow icon="git-branch-outline" label="Path" value={ep.career_leagues.slice(0, 8).join("  ›  ")} /> : null}
              {ep.bio ? <Text style={styles.epBio}>{ep.bio}</Text> : null}
              <Text style={styles.epCredit}>via Elite Prospects</Text>
            </View>
          </View>
        ) : null}

        {/* SEASON STATS */}
        <View style={styles.section}>
          <SectionTitle title="This Season" accent={colors.blue} />
          <View style={styles.grid}>
            {goalie ? (
              <>
                <Stat label="GP" value={goalie.gp} />
                <Stat label="REC" value={`${goalie.wins ?? 0}-${goalie.losses ?? 0}-${goalie.ot ?? 0}`} />
                <Stat label="GAA" value={goalie.gaa ?? "–"} />
                <Stat label="SV%" value={goalie.svpct ?? "–"} accent={colors.blue} />
                <Stat label="SO" value={goalie.shutouts ?? 0} />
              </>
            ) : (
              <>
                <Stat label="GP" value={skater?.gp} />
                <Stat label="G" value={skater?.goals} />
                <Stat label="A" value={skater?.assists} />
                <Stat label="PTS" value={skater?.points} accent={colors.blue} />
                {skater?.plus_minus != null ? <Stat label="+/-" value={`${skater.plus_minus > 0 ? "+" : ""}${skater.plus_minus}`} /> : null}
                <Stat label="SHOTS" value={skater?.shots} />
                {skater?.shooting_pct != null ? <Stat label="S%" value={`${skater.shooting_pct}%`} /> : null}
                <Stat label="PIM" value={skater?.pim} />
                {skater?.pp_goals != null ? <Stat label="PPG" value={skater.pp_goals} /> : null}
              </>
            )}
          </View>
        </View>

        {/* PLAYER HIGHLIGHTS — capability-gated. Renders only when verified player-linked video
            exists for this player_id; otherwise the section is entirely absent (no placeholder). */}
        {hasHighlights ? (
          <View style={styles.section}>
            <SectionTitle title="Player Highlights" accent={colors.blue} />
            {/* Player-specific video experience mounts here when a legitimate source is connected. */}
          </View>
        ) : null}

        {/* NEXT GAME */}
        {nextGame ? (
          <View style={styles.section}>
            <SectionTitle title="Next Game" accent={colors.blue} />
            <Pressable style={styles.card} onPress={() => router.push(`/game/${nextGame.id}${lq}`)}>
              <View style={styles.gRow}>
                <NhlLogo abbr={nextGame.away.abbr} url={nextGame.away.logo} size={24} />
                <Text style={styles.gAbbr}>{nextGame.away.abbr}</Text>
                <Text style={styles.gAt}>@</Text>
                <Text style={styles.gAbbr}>{nextGame.home.abbr}</Text>
                <NhlLogo abbr={nextGame.home.abbr} url={nextGame.home.logo} size={24} />
                <View style={{ flex: 1 }} />
                <Text style={styles.gWhen}>{niceDate(nextGame.date)}{nextGame.start_utc ? `  ${fmtTime(nextGame.start_utc)}` : ""}</Text>
              </View>
            </Pressable>
          </View>
        ) : null}

        {/* RECENT GAMES */}
        {last5?.length ? (
          <View style={styles.section}>
            <SectionTitle title="Last 5 Games" accent={colors.blue} />
            <View style={styles.card}>
              {last5.map((g: any, i: number) => (
                <Pressable key={i} style={styles.lgRow} onPress={() => router.push(`/game/${g.game_id}${lq}`)}>
                  <Text style={styles.lgOpp}>{g.home_road === "R" ? "@" : "vs"} {g.opp}</Text>
                  <Text style={styles.lgDate}>{niceDate(g.date)}</Text>
                  <View style={{ flex: 1 }} />
                  {goalie ? (
                    <Text style={styles.lgStat}>{g.decision ?? "–"} · {g.shots_against - g.goals_against}/{g.shots_against} SV</Text>
                  ) : (
                    <Text style={styles.lgStat}>{g.goals}G {g.assists}A · {g.points}P</Text>
                  )}
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        <View style={{ height: spacing.xxxl }} />
      </ScrollView>
    </Screen>
  );
}

function EpRow({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={styles.epRow}>
      <Ionicons name={icon} size={15} color={colors.blue} style={{ marginTop: 1 }} />
      <Text style={styles.epLabel}>{label}</Text>
      <Text style={styles.epValue}>{value}</Text>
    </View>
  );
}

function Stat({ label, value, accent }: { label: string; value: any; accent?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statVal, accent && { color: accent }]}>{value ?? "–"}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxxl, gap: spacing.md },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.xs },
  headshot: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.surfaceHi, borderWidth: 1, borderColor: colors.border },
  name: { color: colors.white, fontFamily: fonts.display, fontSize: 22, fontWeight: "800", letterSpacing: 0.3 },
  teamRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 },
  teamText: { color: colors.textDim, fontFamily: fonts.display, fontSize: 13, fontWeight: "700", letterSpacing: 0.3 },
  bio: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 11.5, marginTop: 2 },

  readWrap: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.blueDim, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  readText: { color: colors.textDim, fontFamily: fonts.body, fontSize: 12.5, lineHeight: 17, flex: 1 },

  section: { gap: spacing.sm, paddingHorizontal: spacing.lg },

  epCard: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.blueDim, padding: spacing.md, gap: spacing.sm },
  epRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  epLabel: { color: colors.textFaint, fontFamily: fonts.accent, fontSize: 10, fontWeight: "700", letterSpacing: 1, width: 52, marginTop: 2 },
  epValue: { color: colors.text, fontFamily: fonts.body, fontSize: 13, lineHeight: 18, flex: 1 },
  styleWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { backgroundColor: colors.bgElev, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.blueDim, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { color: colors.blue, fontFamily: fonts.display, fontSize: 11.5, fontWeight: "700" },
  epBio: { color: colors.textDim, fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, marginTop: 2 },
  epCredit: { color: colors.textFaint, fontFamily: fonts.accent, fontSize: 9, fontWeight: "600", letterSpacing: 1 },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  stat: { width: "22%", flexGrow: 1, backgroundColor: colors.surface, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, paddingVertical: spacing.md, alignItems: "center", gap: 2 },
  statVal: { color: colors.text, fontFamily: fonts.display, fontSize: 17, fontWeight: "800" },
  statLabel: { color: colors.textFaint, fontFamily: fonts.accent, fontSize: 9, fontWeight: "700", letterSpacing: 1 },

  card: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  gRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  gAbbr: { color: colors.text, fontFamily: fonts.display, fontSize: 15, fontWeight: "800" },
  gAt: { color: colors.textFaint, fontFamily: fonts.display, fontSize: 13, fontWeight: "700" },
  gWhen: { color: colors.textFaint, fontFamily: fonts.accent, fontSize: 10, fontWeight: "600", letterSpacing: 0.5 },

  lgRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  lgOpp: { color: colors.text, fontFamily: fonts.display, fontSize: 14, fontWeight: "700", width: 62 },
  lgDate: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 11 },
  lgStat: { color: colors.textDim, fontFamily: fonts.display, fontSize: 13, fontWeight: "700" },
});
