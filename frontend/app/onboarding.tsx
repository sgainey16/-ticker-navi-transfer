import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { colors, fonts, spacing, radius } from "@/src/theme";
import { api } from "@/src/lib/api";
import { useFollows, Tier, Follows } from "@/src/lib/follows";
import { NhlLogo } from "@/src/components/NhlLogo";
import { TickerLogo } from "@/src/components/TickerLogo";

type TeamLite = { abbr: string; name: string; logo?: string | null };
type PlayerLite = { player_id: string; team_abbr: string; name: string; pos?: string; number?: number };

const STAR: Record<Tier, { label: string; sub: string; color: string }> = {
  1: { label: "1ST STAR", sub: "MY CORE", color: colors.gold },
  2: { label: "2ND STAR", sub: "MY REGULARS", color: colors.blue },
  3: { label: "3RD STAR", sub: "KEEP ME POSTED", color: "#9AA6B8" },
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[parts.length - 1]?.[0] || "")).toUpperCase();
}

export default function Onboarding() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { reset } = useLocalSearchParams<{ reset?: string }>();
  const { completeOnboarding, resetOnboarding } = useFollows();

  const [step, setStep] = useState(0); // 0 NHL, 1 Teams, 2 Players, 3 Stars
  const [teams, setTeams] = useState<Record<string, TeamLite>>({});      // selected teams
  const [players, setPlayers] = useState<Record<string, PlayerLite>>({}); // selected players
  const [tiers, setTiers] = useState<Record<string, Tier>>({});           // key -> tier

  // Dev reset entry: /onboarding?reset=1 clears any saved follows on mount.
  useEffect(() => { if (reset === "1") resetOnboarding(); }, [reset, resetOnboarding]);

  // --- team catalog ---
  const standings = useApiLocal(() => api.nhlStandings());
  const teamCatalog: TeamLite[] = useMemo(() => {
    const d = standings.data;
    if (!d) return [];
    const all = [...(d.Eastern || []), ...(d.Western || [])].map((r: any) => ({ abbr: r.abbr, name: r.name, logo: r.logo }));
    return all.sort((a, b) => a.name.localeCompare(b.name));
  }, [standings.data]);

  // --- rosters for selected teams (loaded when entering Players step) ---
  const [rosters, setRosters] = useState<Record<string, PlayerLite[]>>({});
  const [rosterLoading, setRosterLoading] = useState(false);
  useEffect(() => {
    if (step !== 2) return;
    const need = Object.keys(teams).filter((abbr) => !rosters[abbr]);
    if (!need.length) return;
    setRosterLoading(true);
    Promise.all(need.map(async (abbr) => {
      try {
        const data = await api.nhlTeam(abbr);
        const r = data.roster || {};
        const list: PlayerLite[] = [...(r.forwards || []), ...(r.defensemen || []), ...(r.goalies || [])]
          .map((p: any) => ({ player_id: String(p.player_id), team_abbr: abbr, name: p.name, pos: p.pos, number: p.number }));
        return [abbr, list] as const;
      } catch {
        return [abbr, []] as const;
      }
    })).then((pairs) => {
      setRosters((prev) => { const next = { ...prev }; pairs.forEach(([a, l]) => (next[a] = l)); return next; });
      setRosterLoading(false);
    });
  }, [step, teams]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleTeam = (t: TeamLite) => {
    Haptics.selectionAsync();
    setTeams((prev) => {
      const next = { ...prev };
      if (next[t.abbr]) { delete next[t.abbr]; setTiers((ti) => { const n = { ...ti }; delete n[`team:${t.abbr}`]; return n; }); }
      else next[t.abbr] = t;
      return next;
    });
  };
  const togglePlayer = (p: PlayerLite) => {
    Haptics.selectionAsync();
    setPlayers((prev) => {
      const next = { ...prev };
      if (next[p.player_id]) { delete next[p.player_id]; setTiers((ti) => { const n = { ...ti }; delete n[`player:${p.player_id}`]; return n; }); }
      else next[p.player_id] = p;
      return next;
    });
  };
  const setTier = (key: string, tier: Tier) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTiers((prev) => { const n = { ...prev }; if (n[key] === tier) delete n[key]; else n[key] = tier; return n; });
  };

  const selectedTeamList = useMemo(() => Object.values(teams), [teams]);
  const selectedPlayerList = useMemo(() => Object.values(players), [players]);

  const finish = async () => {
    const follows: Follows = {
      teams: selectedTeamList.map((t) => ({ abbr: t.abbr, tier: tiers[`team:${t.abbr}`] })),
      players: selectedPlayerList.map((p) => ({ player_id: p.player_id, team_abbr: p.team_abbr, tier: tiers[`player:${p.player_id}`] })),
    };
    await completeOnboarding(follows);
    router.replace("/");
  };

  const canGoPlayers = selectedTeamList.length > 0;

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.md }]}>
      {/* header */}
      <View style={styles.header}>
        <TickerLogo width={96} />
        <View style={styles.dots}>
          {[0, 1, 2, 3].map((i) => <View key={i} style={[styles.dot, i === step && styles.dotOn, i < step && styles.dotDone]} />)}
        </View>
      </View>

      {step === 0 && (
        <View style={styles.centerStep}>
          <Text style={styles.big}>What hockey do you{"\n"}care about?</Text>
          <Text style={styles.lead}>The Ticker learns your world, then Reggie & Marc program around it. Takes a few taps.</Text>
          <View style={styles.leagueCard}>
            <View style={styles.leagueBadge}><Text style={styles.leagueBadgeText}>NHL</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.leagueName}>National Hockey League</Text>
              <Text style={styles.leagueSub}>The only league on The Ticker right now.</Text>
            </View>
            <Ionicons name="checkmark-circle" size={22} color={colors.blue} />
          </View>
          <Pressable style={styles.devReset} onPress={() => resetOnboarding()}>
            <Text style={styles.devResetText}>Start over (dev reset)</Text>
          </Pressable>
        </View>
      )}

      {step === 1 && (
        <View style={styles.flexStep}>
          <Text style={styles.stepTitle}>Pick your teams</Text>
          <Text style={styles.stepSub}>Tap every team you follow. {selectedTeamList.length} selected.</Text>
          {standings.loading ? (
            <ActivityIndicator color={colors.blue} style={{ marginTop: spacing.xl }} />
          ) : (
            <ScrollView contentContainerStyle={styles.teamGrid} showsVerticalScrollIndicator={false}>
              {teamCatalog.map((t) => {
                const on = !!teams[t.abbr];
                return (
                  <Pressable key={t.abbr} style={[styles.teamCell, on && styles.teamCellOn]} onPress={() => toggleTeam(t)} testID={`team-${t.abbr}`}>
                    <NhlLogo abbr={t.abbr} url={t.logo} size={40} />
                    <Text style={[styles.teamAbbr, on && { color: colors.white }]}>{t.abbr}</Text>
                    {on ? <View style={styles.checkDot}><Ionicons name="checkmark" size={11} color={colors.white} /></View> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>
      )}

      {step === 2 && (
        <View style={styles.flexStep}>
          <Text style={styles.stepTitle}>Pick your players</Text>
          <Text style={styles.stepSub}>{selectedPlayerList.length} selected · optional</Text>
          {rosterLoading ? (
            <ActivityIndicator color={colors.blue} style={{ marginTop: spacing.xl }} />
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.xl }}>
              {selectedTeamList.map((t) => (
                <View key={t.abbr} style={styles.rosterBlock}>
                  <View style={styles.rosterHead}>
                    <NhlLogo abbr={t.abbr} url={t.logo} size={22} />
                    <Text style={styles.rosterTeam}>{t.name}</Text>
                  </View>
                  <View style={styles.chipWrap}>
                    {(rosters[t.abbr] || []).map((p) => {
                      const on = !!players[p.player_id];
                      return (
                        <Pressable key={p.player_id} style={[styles.pChip, on && styles.pChipOn]} onPress={() => togglePlayer(p)} testID={`player-${p.player_id}`}>
                          <View style={[styles.pAvatar, on && { borderColor: colors.blue }]}><Text style={styles.pInit}>{initials(p.name)}</Text></View>
                          <Text style={[styles.pName, on && { color: colors.white }]} numberOfLines={1}>{p.name}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      )}

      {step === 3 && (
        <View style={styles.flexStep}>
          <Text style={styles.stepTitle}>Set your Stars</Text>
          <Text style={styles.stepSub}>Optional. Elevate the few that matter most — the rest stay followed.</Text>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.xl, gap: spacing.sm }}>
            {selectedTeamList.map((t) => (
              <StarRow key={`t${t.abbr}`} title={t.name} sub={t.abbr} logo={<NhlLogo abbr={t.abbr} url={t.logo} size={30} />}
                tier={tiers[`team:${t.abbr}`]} onSet={(tr) => setTier(`team:${t.abbr}`, tr)} />
            ))}
            {selectedPlayerList.map((p) => (
              <StarRow key={`p${p.player_id}`} title={p.name} sub={`${p.pos || ""} · ${p.team_abbr}`}
                logo={<View style={styles.pAvatarSm}><Text style={styles.pInit}>{initials(p.name)}</Text></View>}
                tier={tiers[`player:${p.player_id}`]} onSet={(tr) => setTier(`player:${p.player_id}`, tr)} />
            ))}
            {!selectedTeamList.length && !selectedPlayerList.length ? (
              <Text style={styles.stepSub}>No follows yet — that&apos;s fine. You can add them anytime.</Text>
            ) : null}
          </ScrollView>
        </View>
      )}

      {/* footer nav */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        {step > 0 ? (
          <Pressable style={styles.backBtn} onPress={() => setStep((s) => s - 1)}>
            <Ionicons name="chevron-back" size={18} color={colors.textDim} />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
        ) : <View />}
        {step < 3 ? (
          <Pressable
            style={[styles.nextBtn, step === 1 && !canGoPlayers && styles.nextBtnDim]}
            disabled={step === 1 && !canGoPlayers}
            onPress={() => setStep((s) => s + 1)}
            testID="onboard-next"
          >
            <Text style={styles.nextText}>{step === 0 ? "Get started" : "Continue"}</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.white} />
          </Pressable>
        ) : (
          <Pressable style={styles.nextBtn} onPress={finish} testID="onboard-finish">
            <Text style={styles.nextText}>Enter The Ticker</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.white} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

function StarRow({ title, sub, logo, tier, onSet }: { title: string; sub: string; logo: React.ReactNode; tier?: Tier; onSet: (t: Tier) => void }) {
  return (
    <View style={styles.starRow}>
      {logo}
      <View style={{ flex: 1 }}>
        <Text style={styles.starName} numberOfLines={1}>{title}</Text>
        <Text style={styles.starSub}>{sub}</Text>
      </View>
      <View style={styles.starPicks}>
        {([1, 2, 3] as Tier[]).map((tr) => {
          const on = tier === tr;
          return (
            <Pressable key={tr} style={[styles.starChip, on && { backgroundColor: STAR[tr].color, borderColor: STAR[tr].color }]} onPress={() => onSet(tr)} testID={`tier-${tr}`}>
              <Ionicons name={on ? "star" : "star-outline"} size={11} color={on ? colors.bg : STAR[tr].color} />
              <Text style={[styles.starChipText, { color: on ? colors.bg : STAR[tr].color }]}>{tr === 1 ? "1ST" : tr === 2 ? "2ND" : "3RD"}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// tiny local copy of useApi to avoid import cycle surprises
function useApiLocal<T>(fn: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { let a = true; fn().then((d) => a && setData(d)).catch(() => {}).finally(() => a && setLoading(false)); return () => { a = false; }; }, []); // eslint-disable-line
  return { data, loading };
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.lg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.lg },
  dots: { flexDirection: "row", gap: 6 },
  dot: { width: 22, height: 4, borderRadius: 2, backgroundColor: colors.surfaceHi },
  dotOn: { backgroundColor: colors.blue },
  dotDone: { backgroundColor: colors.blueDim },

  centerStep: { flex: 1, justifyContent: "center", gap: spacing.lg },
  big: { color: colors.white, fontFamily: fonts.display, fontSize: 34, fontWeight: "800", lineHeight: 38, letterSpacing: 0.3 },
  lead: { color: colors.textDim, fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  leagueCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.blueDim, borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.sm },
  leagueBadge: { backgroundColor: colors.blue, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 6 },
  leagueBadgeText: { color: colors.white, fontFamily: fonts.display, fontSize: 14, fontWeight: "800", letterSpacing: 1 },
  leagueName: { color: colors.white, fontFamily: fonts.display, fontSize: 16, fontWeight: "700" },
  leagueSub: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  devReset: { alignSelf: "center", marginTop: spacing.md, padding: spacing.sm },
  devResetText: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 12, textDecorationLine: "underline" },

  flexStep: { flex: 1 },
  stepTitle: { color: colors.white, fontFamily: fonts.display, fontSize: 26, fontWeight: "800", letterSpacing: 0.3 },
  stepSub: { color: colors.textDim, fontFamily: fonts.body, fontSize: 13, marginTop: 2, marginBottom: spacing.md },

  teamGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, paddingBottom: spacing.xl },
  teamCell: { width: "22%", flexGrow: 1, aspectRatio: 1, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", gap: 4 },
  teamCellOn: { borderColor: colors.blue, backgroundColor: colors.surfaceHi },
  teamAbbr: { color: colors.textDim, fontFamily: fonts.display, fontSize: 12, fontWeight: "800", letterSpacing: 0.5 },
  checkDot: { position: "absolute", top: 6, right: 6, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.blue, alignItems: "center", justifyContent: "center" },

  rosterBlock: { marginBottom: spacing.lg },
  rosterHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: spacing.sm },
  rosterTeam: { color: colors.white, fontFamily: fonts.display, fontSize: 15, fontWeight: "700" },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  pChip: { flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: colors.surface, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, paddingRight: spacing.md, paddingLeft: 4, paddingVertical: 4 },
  pChipOn: { borderColor: colors.blue, backgroundColor: colors.surfaceHi },
  pAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.surfaceHi, borderWidth: 1.5, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  pAvatarSm: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.surfaceHi, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  pInit: { color: colors.white, fontFamily: fonts.display, fontSize: 11, fontWeight: "800" },
  pName: { color: colors.textDim, fontFamily: fonts.body, fontSize: 12.5, maxWidth: 120 },

  starRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  starName: { color: colors.white, fontFamily: fonts.display, fontSize: 15, fontWeight: "700" },
  starSub: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 11, marginTop: 1 },
  starPicks: { flexDirection: "row", gap: 5 },
  starChip: { flexDirection: "row", alignItems: "center", gap: 3, borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 7, paddingVertical: 5 },
  starChipText: { fontFamily: fonts.display, fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },

  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 2, padding: spacing.sm },
  backText: { color: colors.textDim, fontFamily: fonts.display, fontSize: 14, fontWeight: "700" },
  nextBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.blue, borderRadius: radius.pill, paddingHorizontal: spacing.xl, paddingVertical: 12 },
  nextBtnDim: { opacity: 0.4 },
  nextText: { color: colors.white, fontFamily: fonts.display, fontSize: 15, fontWeight: "800", letterSpacing: 0.5 },
});
