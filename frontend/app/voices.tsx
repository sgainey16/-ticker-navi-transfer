import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { colors, fonts, spacing, radius, hostStyle } from "@/src/theme";
import { api } from "@/src/lib/api";
import { storage } from "@/src/utils/storage";
import { playDataUri, stopAudio } from "@/src/lib/audio";

const RAYO_IMG = require("../assets/images/rayo.jpg");
const CASEY_IMG = require("../assets/images/casey.jpg");

export const VKEY_ID = { rayo: "masl_voice_rayo", casey: "masl_voice_casey" } as const;
export const VKEY_GV = { rayo: "masl_voice_rayo_gv", casey: "masl_voice_casey_gv" } as const;

type Preview = { generated_voice_id: string; audio: string; duration: number | null };

export default function Voices() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [selectedGv, setSelectedGv] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const rg = await storage.getItem<string>(VKEY_GV.rayo, "");
      const cg = await storage.getItem<string>(VKEY_GV.casey, "");
      setSelectedGv({ rayo: rg || "", casey: cg || "" });
    })();
    return () => stopAudio();
  }, []);

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="close-voices" onPress={() => { stopAudio(); router.back(); }} hitSlop={12} style={styles.close}>
          <Ionicons name="chevron-down" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>CAST THE BOOTH</Text>
          <Text style={styles.headerSub}>Audition & pick each host's voice</Text>
        </View>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>
          Generate voice candidates for each host, tap to preview, then lock in your pick. Selected voices power the Cold Open.
        </Text>
        <HostCaster host="rayo" img={RAYO_IMG} initialGv={selectedGv.rayo} />
        <HostCaster host="casey" img={CASEY_IMG} initialGv={selectedGv.casey} />
        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </View>
  );
}

function HostCaster({ host, img, initialGv }: { host: "rayo" | "casey"; img: any; initialGv?: string }) {
  const s = hostStyle[host];
  const [previews, setPreviews] = useState<Preview[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [selectedGv, setSelectedGv] = useState<string>(initialGv || "");
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => setSelectedGv(initialGv || ""), [initialGv]);

  const generate = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLoading(true);
    setError(null);
    try {
      const res = await api.designVoices(host);
      setPreviews(res.previews);
    } catch (e: any) {
      setError("Couldn't generate voices. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const preview = async (p: Preview) => {
    Haptics.selectionAsync();
    if (playing === p.generated_voice_id) {
      stopAudio();
      setPlaying(null);
      return;
    }
    setPlaying(p.generated_voice_id);
    await playDataUri(p.audio);
    setPlaying((cur) => (cur === p.generated_voice_id ? null : cur));
  };

  const select = async (p: Preview) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSaving(p.generated_voice_id);
    try {
      const res = await api.selectVoice(host, p.generated_voice_id);
      await storage.setItem(VKEY_ID[host], res.voice_id);
      await storage.setItem(VKEY_GV[host], p.generated_voice_id);
      setSelectedGv(p.generated_voice_id);
    } catch {
      setError("Couldn't save that voice. Try again.");
    } finally {
      setSaving(null);
    }
  };

  return (
    <View style={[styles.hostCard, { borderColor: s.accent + "55" }]}>
      <View style={styles.hostHead}>
        <Image source={img} style={[styles.avatar, { borderColor: s.accent }]} contentFit="cover" />
        <View style={{ flex: 1 }}>
          <Text style={[styles.hostName, { color: s.accent }]}>{host === "rayo" ? "Mateo “Rayo” Reyes" : "Casey Whitfield"}</Text>
          <Text style={styles.hostRole}>{s.label}</Text>
        </View>
        {selectedGv ? (
          <View style={[styles.castPill, { backgroundColor: s.accent + "22", borderColor: s.accent }]}>
            <Ionicons name="checkmark-circle" size={14} color={s.accent} />
            <Text style={[styles.castText, { color: s.accent }]}>CAST</Text>
          </View>
        ) : null}
      </View>

      {previews.length === 0 ? (
        <Pressable testID={`generate-${host}`} style={[styles.genBtn, { backgroundColor: s.accent }]} onPress={generate} disabled={loading}>
          {loading ? <ActivityIndicator color={colors.bg} /> : <Ionicons name="sparkles" size={16} color={colors.bg} />}
          <Text style={styles.genText}>{loading ? "DESIGNING VOICES…" : "GENERATE 3 VOICES"}</Text>
        </Pressable>
      ) : (
        <View style={{ gap: spacing.sm }}>
          {previews.map((p, i) => {
            const isSel = selectedGv === p.generated_voice_id;
            const isPlaying = playing === p.generated_voice_id;
            return (
              <View key={p.generated_voice_id} style={[styles.candidate, isSel && { borderColor: s.accent, backgroundColor: s.accent + "12" }]}>
                <Pressable testID={`preview-${host}-${i}`} style={[styles.playBtn, { borderColor: s.accent }]} onPress={() => preview(p)}>
                  <Ionicons name={isPlaying ? "pause" : "play"} size={16} color={s.accent} />
                </Pressable>
                <View style={{ flex: 1 }}>
                  <Text style={styles.candName}>Voice {i + 1}</Text>
                  <Text style={styles.candMeta}>{isPlaying ? "Playing…" : "Tap to preview"}</Text>
                </View>
                <Pressable testID={`select-${host}-${i}`} style={[styles.useBtn, isSel ? { backgroundColor: s.accent } : { borderColor: s.accent, borderWidth: 1 }]} onPress={() => select(p)} disabled={saving !== null}>
                  {saving === p.generated_voice_id ? (
                    <ActivityIndicator size="small" color={isSel ? colors.bg : s.accent} />
                  ) : (
                    <Text style={[styles.useText, { color: isSel ? colors.bg : s.accent }]}>{isSel ? "SELECTED" : "USE"}</Text>
                  )}
                </Pressable>
              </View>
            );
          })}
          <Pressable testID={`regen-${host}`} style={styles.regen} onPress={generate} disabled={loading}>
            <Ionicons name="refresh" size={14} color={colors.textDim} />
            <Text style={styles.regenText}>{loading ? "Designing…" : "Regenerate"}</Text>
          </Pressable>
        </View>
      )}
      {error ? <Text style={styles.err}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  close: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surfaceAlt, alignItems: "center", justifyContent: "center" },
  headerCenter: { flex: 1 },
  headerTitle: { color: colors.text, fontFamily: fonts.display, fontSize: 18, fontWeight: "800", letterSpacing: 1 },
  headerSub: { color: colors.textDim, fontFamily: fonts.body, fontSize: 11 },

  content: { padding: spacing.lg, gap: spacing.lg },
  intro: { color: colors.textDim, fontFamily: fonts.body, fontSize: 13, lineHeight: 20 },

  hostCard: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg, gap: spacing.md },
  hostHead: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, backgroundColor: colors.surfaceAlt },
  hostName: { fontFamily: fonts.display, fontSize: 18, fontWeight: "800", letterSpacing: 0.3 },
  hostRole: { color: colors.textFaint, fontFamily: fonts.accent, fontSize: 10, fontWeight: "600", letterSpacing: 1 },
  castPill: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  castText: { fontFamily: fonts.display, fontSize: 11, fontWeight: "800", letterSpacing: 1 },

  genBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: radius.pill, paddingVertical: spacing.md },
  genText: { color: colors.bg, fontFamily: fonts.display, fontSize: 15, fontWeight: "800", letterSpacing: 0.8 },

  candidate: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.sm },
  playBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  candName: { color: colors.text, fontFamily: fonts.display, fontSize: 16, fontWeight: "700" },
  candMeta: { color: colors.textDim, fontFamily: fonts.body, fontSize: 12 },
  useBtn: { minWidth: 84, height: 36, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.md },
  useText: { fontFamily: fonts.display, fontSize: 13, fontWeight: "800", letterSpacing: 0.8 },
  regen: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: spacing.sm },
  regenText: { color: colors.textDim, fontFamily: fonts.body, fontSize: 13 },
  err: { color: colors.red, fontFamily: fonts.body, fontSize: 12 },
});
