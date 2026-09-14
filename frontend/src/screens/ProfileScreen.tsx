import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { colors, fonts, spacing, radius } from "@/src/theme";
import { useFollows } from "@/src/lib/follows";
import { TabScreen } from "@/src/components/ui";
import { NhlLogo } from "@/src/components/NhlLogo";

const REGION_LABEL: Record<string, string> = {
  canada: "Canada", usa: "United States", europe: "Europe", world: "Elsewhere",
};

function lastName(name?: string) { if (!name) return "?"; const p = name.trim().split(/\s+/); return p[p.length - 1] || name; }

export default function ProfileScreen() {
  const router = useRouter();
  const { follows } = useFollows();

  const teams = follows.teams || [];
  const players = follows.players || [];
  const leagues = follows.leagues || [];
  const region = follows.region;
  const favTeam = useMemo(() => teams.find((t) => t.fav || t.tier === 1) || teams[0], [teams]);

  return (
    <TabScreen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* identity */}
        <View style={styles.hero}>
          <View style={styles.avatar}><Ionicons name="person" size={30} color={colors.blue} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroName}>MY TICKER</Text>
            <Text style={styles.heroSub}>
              {region ? `${REGION_LABEL[region] || region} · ` : ""}{teams.length} teams · {players.length} players
            </Text>
          </View>
        </View>

        {/* Draft Board */}
        <Section title="MY DRAFT BOARD" action={<Pressable onPress={() => { Haptics.selectionAsync(); router.replace("/onboarding?reset=1"); }}><Text style={styles.edit}>EDIT</Text></Pressable>}>
          {teams.length || players.length ? (
            <View style={styles.card}>
              {teams.map((t) => (
                <Pressable key={`t${t.abbr}`} style={styles.dbRow} onPress={() => { Haptics.selectionAsync(); router.push(`/team/${t.abbr}${t.league && t.league !== "nhl" ? `?league=${t.league}` : ""}`); }} testID={`profile-team-${t.abbr}`}>
                  <NhlLogo abbr={t.abbr} url={t.logo} size={26} />
                  <Text style={styles.dbName}>{t.name || t.abbr}</Text>
                  {t.fav || t.tier === 1 ? <Ionicons name="star" size={13} color={colors.gold} /> : null}
                  <Ionicons name="chevron-forward" size={15} color={colors.textFaint} />
                </Pressable>
              ))}
              {players.map((p) => (
                <Pressable key={`p${p.player_id}`} style={styles.dbRow} onPress={() => { Haptics.selectionAsync(); router.push(`/player/${p.player_id}${p.league && p.league !== "nhl" ? `?league=${p.league}` : ""}`); }} testID={`profile-player-${p.player_id}`}>
                  <View style={styles.pAvatar}><Text style={styles.pInit}>{lastName(p.name)[0]}</Text></View>
                  <Text style={styles.dbName}>{p.name || p.player_id}</Text>
                  {p.fav || p.tier === 1 ? <Ionicons name="star" size={13} color={colors.gold} /> : null}
                  <Ionicons name="chevron-forward" size={15} color={colors.textFaint} />
                </Pressable>
              ))}
            </View>
          ) : (
            <Pressable style={styles.buildCard} onPress={() => { Haptics.selectionAsync(); router.replace("/onboarding?reset=1"); }}>
              <Ionicons name="albums-outline" size={20} color={colors.blue} />
              <Text style={styles.buildText}>Build your Draft Board — pick the teams & players you follow.</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
            </Pressable>
          )}
        </Section>

        {/* Interests */}
        <Section title="MY HOCKEY INTERESTS">
          <View style={styles.card}>
            <View style={styles.metaRow}>
              <Text style={styles.metaKey}>Region</Text>
              <Text style={styles.metaVal}>{region ? (REGION_LABEL[region] || region) : "Not set"}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaKey}>Leagues</Text>
              <Text style={styles.metaVal}>{leagues.length ? leagues.map((l) => l.toUpperCase()).join(" · ") : "All"}</Text>
            </View>
          </View>
        </Section>

        {/* Betting IQ — 18+ gated placeholder */}
        <Section title="BETTING IQ">
          <Pressable style={styles.lockCard} onPress={() => { Haptics.selectionAsync(); }} testID="profile-betting-iq">
            <View style={styles.lockIcon}><Ionicons name="lock-closed" size={18} color={colors.gold} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.lockTitle}>Betting IQ · 18+</Text>
              <Text style={styles.lockSub}>Predictions & insights. Unlocks after age verification. Coming later.</Text>
            </View>
            <View style={styles.ageBadge}><Text style={styles.ageText}>18+</Text></View>
          </Pressable>
        </Section>

        {/* Settings */}
        <Section title="SETTINGS">
          <View style={styles.card}>
            <Pressable style={styles.setRow} onPress={() => { Haptics.selectionAsync(); router.push("/voices"); }} testID="profile-voices">
              <Ionicons name="mic-outline" size={18} color={colors.blue} />
              <Text style={styles.setName}>Host voices</Text>
              <Ionicons name="chevron-forward" size={15} color={colors.textFaint} />
            </Pressable>
            <Pressable style={styles.setRow} onPress={() => { Haptics.selectionAsync(); router.replace("/onboarding?reset=1"); }} testID="profile-reset">
              <Ionicons name="refresh-outline" size={18} color={colors.textDim} />
              <Text style={styles.setName}>Start over (redo onboarding)</Text>
              <Ionicons name="chevron-forward" size={15} color={colors.textFaint} />
            </Pressable>
          </View>
        </Section>

        <View style={{ height: 120 }} />
      </ScrollView>
    </TabScreen>
  );
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.secHead}>
        <Text style={styles.secLabel}>{title}</Text>
        {action}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.lg, gap: spacing.xl },
  hero: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg },
  avatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.blueSoft, borderWidth: 1, borderColor: colors.blueDim, alignItems: "center", justifyContent: "center" },
  heroName: { color: colors.white, fontFamily: fonts.display, fontSize: 22, fontWeight: "800", letterSpacing: 0.5 },
  heroSub: { color: colors.textDim, fontFamily: fonts.body, fontSize: 12.5, marginTop: 2 },

  section: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  secHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  secLabel: { color: colors.textDim, fontFamily: fonts.accent, fontSize: 12, fontWeight: "700", letterSpacing: 1.5 },
  edit: { color: colors.blue, fontFamily: fonts.display, fontSize: 12, fontWeight: "800", letterSpacing: 1 },

  card: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  dbRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  dbName: { flex: 1, color: colors.text, fontFamily: fonts.display, fontSize: 15, fontWeight: "700" },
  pAvatar: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.surfaceHi, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  pInit: { color: colors.white, fontFamily: fonts.display, fontSize: 12, fontWeight: "800" },

  buildCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.blueDim, padding: spacing.lg },
  buildText: { flex: 1, color: colors.text, fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19 },

  metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  metaKey: { color: colors.textDim, fontFamily: fonts.body, fontSize: 13 },
  metaVal: { color: colors.white, fontFamily: fonts.display, fontSize: 14, fontWeight: "700", letterSpacing: 0.5 },

  lockCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  lockIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(245,179,1,0.12)", alignItems: "center", justifyContent: "center" },
  lockTitle: { color: colors.white, fontFamily: fonts.display, fontSize: 15, fontWeight: "800", letterSpacing: 0.3 },
  lockSub: { color: colors.textDim, fontFamily: fonts.body, fontSize: 12, marginTop: 2, lineHeight: 17 },
  ageBadge: { backgroundColor: colors.gold, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3 },
  ageText: { color: colors.bg, fontFamily: fonts.display, fontSize: 12, fontWeight: "800" },

  setRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  setName: { flex: 1, color: colors.text, fontFamily: fonts.body, fontSize: 14 },
});
