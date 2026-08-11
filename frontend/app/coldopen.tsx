import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { colors, fonts, spacing, radius, hostStyle } from "@/src/theme";
import { api, ColdOpenBeat } from "@/src/lib/api";
import { useApi } from "@/src/lib/useApi";
import { Loader, ErrorState } from "@/src/components/ui";
import { TickerLogo } from "@/src/components/TickerLogo";
import { storage } from "@/src/utils/storage";
import { playDataUri, stopAudio } from "@/src/lib/audio";
import { VKEY_ID } from "@/app/voices";

const HERO = require("../assets/images/broadcast-desk.png");

export default function ColdOpen() {
  const router = useRouter();
  const co = useApi(() => api.coldOpen());
  const [step, setStep] = useState(0);
  const [voices, setVoices] = useState<{ rayo?: string; casey?: string }>({});
  const [audioOn, setAudioOn] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const advanceRef = useRef(0);
  const scrollRef = useRef<ScrollView>(null);

  const beats: ColdOpenBeat[] = co.data?.beats || [];
  const done = step >= beats.length - 1;
  const hasVoices = !!(voices.rayo || voices.casey);

  useEffect(() => {
    (async () => {
      const r = await storage.getItem<string>(VKEY_ID.rayo, "");
      const c = await storage.getItem<string>(VKEY_ID.casey, "");
      let server: { rayo: string | null; casey: string | null } = { rayo: null, casey: null };
      try {
        server = await api.voicesSelected();
      } catch {}
      setVoices({ rayo: r || server.rayo || undefined, casey: c || server.casey || undefined });
    })();
    return () => stopAudio();
  }, []);

  // Playback / auto-advance driver
  useEffect(() => {
    if (!beats.length) return;
    const myStep = step;
    advanceRef.current = myStep;
    const goNext = () => {
      if (advanceRef.current === myStep && myStep < beats.length - 1) setStep((s) => s + 1);
    };
    const beat = beats[myStep];
    const voiceId = beat.host === "rayo" ? voices.rayo : beat.host === "casey" ? voices.casey : undefined;

    if (audioOn && voiceId && beat.host !== "system") {
      let cancelled = false;
      setSpeaking(true);
      (async () => {
        try {
          const res = await api.tts(beat.text, voiceId, beat.host === "casey" ? 1.12 : 1.0);
          if (cancelled) return;
          await playDataUri(res.audio);
        } catch {}
        if (!cancelled) {
          setSpeaking(false);
          goNext();
        }
      })();
      return () => {
        cancelled = true;
        setSpeaking(false);
        stopAudio();
      };
    }
    const timer = setTimeout(goNext, myStep === 0 ? 900 : 2600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, beats.length, audioOn, voices.rayo, voices.casey]);

  useEffect(() => {
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
    return () => clearTimeout(t);
  }, [step]);

  const advance = () => {
    Haptics.selectionAsync();
    if (step < beats.length - 1) setStep((s) => s + 1);
  };

  const revealed = beats.slice(0, step + 1);

  return (
    <View style={styles.root}>
      <Image source={HERO} style={StyleSheet.absoluteFill} contentFit="cover" />
      <LinearGradient colors={["rgba(5,7,12,0.75)", "rgba(5,7,12,0.9)", "rgba(5,7,12,0.99)"]} style={StyleSheet.absoluteFill} />

      <View style={styles.topBar}>
        <TickerLogo width={110} />
        <View style={styles.topRight}>
          <Pressable testID="cast-voices" onPress={() => { stopAudio(); router.push("/voices"); }} hitSlop={10} style={styles.iconBtn}>
            <Ionicons name="mic" size={18} color={hasVoices ? colors.green : colors.textDim} />
          </Pressable>
          <Pressable testID="toggle-audio" onPress={() => { setAudioOn((v) => { if (v) stopAudio(); return !v; }); }} hitSlop={10} style={styles.iconBtn}>
            <Ionicons name={audioOn ? "volume-high" : "volume-mute"} size={18} color={audioOn ? colors.white : colors.textDim} />
          </Pressable>
          <Pressable testID="close-cold-open" onPress={() => { stopAudio(); router.back(); }} hitSlop={14} style={styles.iconBtn}>
            <Ionicons name="close" size={20} color={colors.text} />
          </Pressable>
        </View>
      </View>

      {!hasVoices ? (
        <Pressable testID="cast-hint" style={styles.hint} onPress={() => router.push("/voices")}>
          <Ionicons name="sparkles" size={13} color={colors.green} />
          <Text style={styles.hintText}>Tap to cast Rayo & Casey’s voices</Text>
        </Pressable>
      ) : null}

      {co.loading ? (
        <Loader label="Rolling the cold open…" />
      ) : co.error ? (
        <ErrorState message="Couldn't load the cold open" onRetry={co.reload} />
      ) : (
        <>
          <Pressable style={styles.stage} onPress={advance} testID="cold-open-stage">
            <ScrollView ref={scrollRef} contentContainerStyle={styles.stageContent} showsVerticalScrollIndicator={false}>
              <View style={styles.matchup}>
                <Text style={styles.matchLabel}>COLD OPEN · THE WAVE’S RECORD NIGHT</Text>
                <Text style={styles.matchScore}>
                  {co.data.away?.abbr} {co.data.matchup.away_score}  —  {co.data.matchup.home_score} {co.data.home?.abbr}
                </Text>
              </View>
              {revealed.map((b, i) => {
                const vid = b.host === "rayo" ? voices.rayo : b.host === "casey" ? voices.casey : undefined;
                return (
                  <BeatView
                    key={b.id}
                    beat={b}
                    isLast={i === revealed.length - 1}
                    speaking={speaking && i === revealed.length - 1}
                    voiced={audioOn && !!vid}
                  />
                );
              })}
            </ScrollView>
          </Pressable>

          <View style={styles.bottom}>
            {!done ? (
              <Pressable style={styles.skip} onPress={advance} testID="cold-open-next">
                <Text style={styles.skipText}>TAP TO CONTINUE</Text>
                <Ionicons name="play-forward" size={14} color={colors.textDim} />
              </Pressable>
            ) : (
              <Animated.View entering={FadeIn}>
                <Pressable style={styles.watch} testID="watch-victory" onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)}>
                  <Ionicons name="play-circle" size={20} color={colors.bg} />
                  <Text style={styles.watchText}>WATCH LIVE ON VICTORY+</Text>
                </Pressable>
                <Pressable style={styles.replay} onPress={() => setStep(0)} testID="cold-open-replay">
                  <Ionicons name="refresh" size={14} color={colors.textDim} />
                  <Text style={styles.replayText}>Replay</Text>
                </Pressable>
              </Animated.View>
            )}
          </View>
        </>
      )}
    </View>
  );
}

function BeatView({ beat, isLast, speaking, voiced }: { beat: ColdOpenBeat; isLast: boolean; speaking: boolean; voiced: boolean }) {
  if (beat.host === "system") {
    return (
      <Animated.View entering={FadeInDown.duration(500)} style={styles.reveal}>
        <Text style={styles.revealText}>{beat.text}</Text>
        <View style={styles.revealBar} />
      </Animated.View>
    );
  }
  const s = hostStyle[beat.host];
  return (
    <Animated.View entering={FadeInDown.duration(400)} style={[styles.beat, { opacity: isLast ? 1 : 0.55 }]}>
      <View style={styles.beatHead}>
        <View style={[styles.hostChip, { backgroundColor: s.soft, borderColor: s.accent }]}>
          <Text style={[styles.hostName, { color: s.accent }]}>{beat.host === "rayo" ? "RAYO" : "CASEY"}</Text>
        </View>
        {speaking ? (
          <View style={styles.speakingRow}>
            <View style={[styles.speakDot, { backgroundColor: s.accent }]} />
            <Text style={[styles.speaking, { color: s.accent }]}>ON AIR</Text>
          </View>
        ) : beat.kicker ? (
          <Text style={styles.kicker}>{beat.kicker}</Text>
        ) : null}
      </View>
      {voiced ? (
        <View style={[styles.lowerThirdVoiced, { borderLeftColor: s.accent }]}>
          <Text style={styles.beatName}>{beat.host === "rayo" ? "Mateo “Rayo” Reyes" : "Casey Whitfield"}</Text>
          <Text style={[styles.beatHandle, { color: s.accent }]}>{s.handle}</Text>
          <Ionicons name="volume-medium" size={16} color={s.accent} style={{ position: "absolute", right: 14, top: 16 }} />
        </View>
      ) : (
        <View style={[styles.lowerThird, { borderLeftColor: s.accent }]}>
          <Text style={styles.beatText}>{beat.text}</Text>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingTop: 54 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  topRight: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" },
  hint: { flexDirection: "row", alignSelf: "center", alignItems: "center", gap: 6, backgroundColor: colors.greenDim, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 6, marginBottom: spacing.sm },
  hintText: { color: colors.green, fontFamily: fonts.display, fontSize: 12, fontWeight: "700", letterSpacing: 0.5 },

  stage: { flex: 1 },
  stageContent: { padding: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md },
  matchup: { marginBottom: spacing.md },
  matchLabel: { color: colors.green, fontFamily: fonts.accent, fontSize: 11, fontWeight: "700", letterSpacing: 1.5 },
  matchScore: { color: colors.white, fontFamily: fonts.display, fontSize: 30, fontWeight: "800", letterSpacing: 1 },

  beat: { gap: spacing.sm },
  beatHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  hostChip: { paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.sm, borderWidth: 1 },
  hostName: { fontFamily: fonts.display, fontSize: 13, fontWeight: "800", letterSpacing: 1 },
  kicker: { color: colors.textDim, fontFamily: fonts.accent, fontSize: 10, fontWeight: "600", letterSpacing: 1.5 },
  speakingRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  speakDot: { width: 7, height: 7, borderRadius: 4 },
  speaking: { fontFamily: fonts.display, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  lowerThird: { backgroundColor: "rgba(16,20,28,0.82)", borderRadius: radius.md, borderLeftWidth: 3, borderWidth: 1, borderColor: colors.border, padding: spacing.lg },
  lowerThirdVoiced: { backgroundColor: "rgba(16,20,28,0.82)", borderRadius: radius.md, borderLeftWidth: 3, borderWidth: 1, borderColor: colors.border, paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
  beatName: { color: colors.white, fontFamily: fonts.display, fontSize: 18, fontWeight: "800", letterSpacing: 0.3 },
  beatHandle: { fontFamily: fonts.accent, fontSize: 12, fontWeight: "600", letterSpacing: 0.5, marginTop: 2 },
  beatText: { color: colors.white, fontFamily: fonts.body, fontSize: 17, lineHeight: 26 },

  reveal: { alignItems: "center", paddingVertical: spacing.xl, gap: spacing.md },
  revealText: { color: colors.green, fontFamily: fonts.display, fontSize: 30, fontWeight: "800", letterSpacing: 1.5, textAlign: "center" },
  revealBar: { width: 60, height: 4, borderRadius: 2, backgroundColor: colors.green },

  bottom: { padding: spacing.lg, paddingBottom: spacing.xl, alignItems: "center" },
  skip: { flexDirection: "row", alignItems: "center", gap: 6, padding: spacing.sm },
  skipText: { color: colors.textDim, fontFamily: fonts.display, fontSize: 13, fontWeight: "700", letterSpacing: 1 },
  watch: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.green, borderRadius: radius.pill, paddingVertical: spacing.md, paddingHorizontal: spacing.xxl },
  watchText: { color: colors.bg, fontFamily: fonts.display, fontSize: 17, fontWeight: "800", letterSpacing: 1 },
  replay: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: spacing.md },
  replayText: { color: colors.textDim, fontFamily: fonts.body, fontSize: 13 },
});
