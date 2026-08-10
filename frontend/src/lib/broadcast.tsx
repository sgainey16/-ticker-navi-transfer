import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeOutUp } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { colors, fonts, spacing, radius, hostStyle } from "@/src/theme";
import { api, ColdOpenBeat } from "@/src/lib/api";
import { storage } from "@/src/utils/storage";
import { playDataUri, stopAudio } from "@/src/lib/audio";
import { VKEY_ID } from "@/app/voices";
import { TickerMark } from "@/src/components/TickerLogo";

type Ctx = {
  start: (page: string) => void;
  onPage: (page: string) => void;
  stop: () => void;
  active: boolean;
};
const BroadcastCtx = createContext<Ctx>({ start: () => {}, onPage: () => {}, stop: () => {}, active: false });
export const useBroadcast = () => useContext(BroadcastCtx);

export function BroadcastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [active, setActive] = useState(false);
  const [segmentKey, setSegmentKey] = useState<string>("");
  const [beats, setBeats] = useState<ColdOpenBeat[]>([]);
  const [step, setStep] = useState(0);
  const [audioOn, setAudioOn] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const voicesRef = useRef<{ rayo?: string; casey?: string }>({});
  const [voices, setVoices] = useState<{ rayo?: string; casey?: string }>({});
  const advanceRef = useRef(0);

  // Resolve the cast (Rayo / Casey) voice IDs once when the app mounts.
  useEffect(() => {
    (async () => {
      const r = await storage.getItem<string>(VKEY_ID.rayo, "");
      const c = await storage.getItem<string>(VKEY_ID.casey, "");
      let server: { rayo: string | null; casey: string | null } = { rayo: null, casey: null };
      try {
        server = await api.voicesSelected();
      } catch {}
      const resolved = { rayo: r || server.rayo || undefined, casey: c || server.casey || undefined };
      voicesRef.current = resolved;
      setVoices(resolved);
    })();
  }, []);

  const loadSegment = useCallback(async (page: string) => {
    stopAudio();
    setSpeaking(false);
    let list: ColdOpenBeat[] = [];
    try {
      const seg = await api.segment(page);
      list = seg.beats || [];
    } catch {
      list = [];
    }
    setBeats(list);
    setStep(0);
    setSegmentKey(page);
  }, []);

  const start = useCallback((page: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setAudioOn(true);
    setActive(true);
    loadSegment(page);
  }, [loadSegment]);

  // Called when the viewer switches tabs — swap the banter to that page.
  const onPage = useCallback((page: string) => {
    if (!active) return;
    if (page === segmentKey) return;
    loadSegment(page);
  }, [active, segmentKey, loadSegment]);

  const stop = useCallback(() => {
    stopAudio();
    setSpeaking(false);
    setActive(false);
  }, []);

  // Playback / auto-advance driver (persists across tabs).
  useEffect(() => {
    if (!active || !beats.length) return;
    const myStep = step;
    advanceRef.current = myStep;
    const goNext = () => {
      if (advanceRef.current === myStep && myStep < beats.length - 1) setStep((s) => s + 1);
    };
    const beat = beats[myStep];
    if (!beat) return;
    const voiceId = beat.host === "rayo" ? voices.rayo : beat.host === "casey" ? voices.casey : undefined;

    if (audioOn && voiceId && beat.host !== "system") {
      let cancelled = false;
      setSpeaking(true);
      (async () => {
        try {
          const res = await api.tts(beat.text, voiceId);
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
    const timer = setTimeout(goNext, myStep === 0 ? 700 : 2600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, step, segmentKey, audioOn, voices.rayo, voices.casey]);

  const beat = beats[step];
  const isSystem = beat?.host === "system";
  const s = beat && beat.host !== "system" ? hostStyle[beat.host] : null;
  const accent = isSystem ? colors.green : s?.accent || colors.green;

  return (
    <BroadcastCtx.Provider value={{ start, onPage, stop, active }}>
      {children}
      {active && beat ? (
        <Animated.View
          entering={FadeInDown.duration(300)}
          exiting={FadeOutUp.duration(200)}
          style={[styles.bar, { top: insets.top + 52 + 8, borderColor: accent }]}
          testID="onair-bar"
        >
          <TickerMark size={20} />
          <View style={styles.status}>
            <View style={[styles.dot, { backgroundColor: speaking ? accent : "rgba(255,255,255,0.25)" }]} />
            <Text style={[styles.onAirText, { color: speaking ? accent : colors.textFaint }]}>ON AIR</Text>
          </View>
          <View style={styles.spacer} />
          <Pressable testID="onair-mute" hitSlop={8} style={styles.ctrl} onPress={() => setAudioOn((v) => { if (v) stopAudio(); return !v; })}>
            <Ionicons name={audioOn ? "volume-high" : "volume-mute"} size={18} color={audioOn ? colors.white : colors.textDim} />
          </Pressable>
          <Pressable testID="onair-close" hitSlop={8} style={styles.ctrl} onPress={stop}>
            <Ionicons name="close" size={18} color={colors.text} />
          </Pressable>
        </Animated.View>
      ) : null}
    </BroadcastCtx.Provider>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: "rgba(11,14,21,0.94)",
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingLeft: spacing.md,
    paddingRight: 6,
    paddingVertical: 6,
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  status: { flexDirection: "row", alignItems: "center", gap: 6 },
  spacer: { width: spacing.sm },
  dot: { width: 7, height: 7, borderRadius: 4 },
  onAirText: { fontFamily: fonts.display, fontSize: 12, fontWeight: "800", letterSpacing: 1.5 },
  ctrl: { width: 30, height: 30, borderRadius: 15, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" },
});
