import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { colors, fonts, spacing, radius } from "@/src/theme";
import { api, DeskSegment } from "@/src/lib/api";
import { playDataUri, stopAudio } from "@/src/lib/audio";

const DESK = require("../../assets/images/broadcast-desk.png");

// Prepared segments are cached client-side per surface|subject so ordinary
// browsing / re-entry never refetches or regenerates. TTS is produced ONLY on
// deliberate play (api.tts is itself server-cached), so passive presence costs nothing.
const segCache: Record<string, DeskSegment> = {};

const SEGMENT_TAG: Record<string, string> = {
  preview: "PREVIEW", recap: "POSTGAME", game: "GAME DESK",
  opening: "ON THE DESK", reaction: "AROUND THE LEAGUE",
};

/**
 * TickerDesk — the single reusable Reggie + Marc sports-desk SHOW layer.
 * Presence is constant; programming changes by `surface` (+ optional `subject`).
 * One-panel rule: this IS the host presence. No face bubbles, no transcripts, no chat.
 */
export function TickerDesk({
  surface,
  subject,
  fallbackTitle,
  segmentFetcher,
  cacheKey,
}: {
  surface: string;
  subject?: string;
  fallbackTitle?: string;
  segmentFetcher?: () => Promise<DeskSegment>;
  cacheKey?: string;
}) {
  const key = cacheKey || `${surface}|${subject || "league"}`;
  const [seg, setSeg] = useState<DeskSegment | null>(segCache[key] || null);
  const [loading, setLoading] = useState(!segCache[key]);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const runRef = useRef(0); // increments to cancel any in-flight play loop

  // Fetch the prepared segment once per surface/subject (deliberate presence, no autoplay).
  useEffect(() => {
    let alive = true;
    if (segCache[key]) { setSeg(segCache[key]); setLoading(false); return; }
    setLoading(true);
    (async () => {
      try {
        const data = await (segmentFetcher ? segmentFetcher() : api.tickerSegment(surface, subject));
        segCache[key] = data;
        if (alive) setSeg(data);
      } catch {
        if (alive) setSeg(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [key, surface, subject]); // eslint-disable-line react-hooks/exhaustive-deps

  const stop = useCallback(() => {
    runRef.current += 1;
    stopAudio();
    setSpeaking(false);
    setPlaying(false);
  }, []);

  // Stop audio if the desk unmounts (leaving the surface).
  useEffect(() => () => { runRef.current += 1; stopAudio(); }, []);

  const play = useCallback(async () => {
    if (!seg || !seg.beats.length) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const myRun = runRef.current + 1;
    runRef.current = myRun;
    setPlaying(true);
    for (const beat of seg.beats) {
      if (runRef.current !== myRun) return; // cancelled
      const voiceId = beat.host === "reggie" ? seg.voices.reggie : seg.voices.marc;
      if (muted || !voiceId) continue;
      setSpeaking(true);
      try {
        const res = await api.tts(beat.text, voiceId, beat.host === "marc" ? 1.08 : 1.0);
        if (runRef.current !== myRun) return;
        await playDataUri(res.audio);
      } catch {
        // Audio failure never blocks the page — the desk simply falls silent.
      }
      if (runRef.current !== myRun) return;
      setSpeaking(false);
    }
    if (runRef.current === myRun) { setSpeaking(false); setPlaying(false); }
  }, [seg, muted]);

  const title = seg?.title || fallbackTitle || "THE TICKER";
  const tag = seg ? (SEGMENT_TAG[seg.segment_type] || "ON THE DESK") : "ON THE DESK";
  const ready = !!seg && seg.state === "ready" && seg.beats.length > 0;

  return (
    <View style={styles.wrap} testID="ticker-desk">
      <Image source={DESK} style={StyleSheet.absoluteFill} contentFit="cover" />
      <LinearGradient
        colors={["rgba(5,7,12,0.30)", "rgba(5,7,12,0.66)", "rgba(5,7,12,0.96)"]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* top: desk identity + live indicator */}
      <View style={styles.top}>
        <View style={styles.deskTag}>
          <Ionicons name="mic" size={11} color={colors.blue} />
          <Text style={styles.deskTagText}>REGGIE + MARC</Text>
        </View>
        {playing ? (
          <View style={styles.onair}>
            <View style={[styles.dot, { backgroundColor: speaking ? colors.blue : "rgba(255,255,255,0.35)" }]} />
            <Text style={styles.onairText}>ON AIR</Text>
          </View>
        ) : null}
      </View>

      {/* bottom: segment title + a single deliberate control */}
      <View style={styles.bottom}>
        <Text style={styles.tag}>{tag}</Text>
        <Text style={styles.title} numberOfLines={2}>{title}</Text>

        {loading ? (
          <View style={styles.loadRow}><ActivityIndicator size="small" color={colors.blue} /><Text style={styles.loadText}>Cueing the desk…</Text></View>
        ) : ready ? (
          <View style={styles.controls}>
            <Pressable
              testID="desk-play"
              style={styles.playBtn}
              onPress={() => (playing ? stop() : play())}
            >
              <Ionicons name={playing ? "pause" : "play"} size={16} color={colors.white} />
              <Text style={styles.playText}>{playing ? "PAUSE" : "PLAY THE DESK"}</Text>
            </Pressable>
            {playing ? (
              <Pressable testID="desk-mute" style={styles.iconBtn} hitSlop={8} onPress={() => setMuted((m) => { if (!m) stopAudio(); return !m; })}>
                <Ionicons name={muted ? "volume-mute" : "volume-high"} size={16} color={muted ? colors.textDim : colors.white} />
              </Pressable>
            ) : null}
          </View>
        ) : (
          <Text style={styles.quietText}>The desk is quiet right now.</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: 196, borderRadius: radius.lg, overflow: "hidden",
    borderWidth: 1, borderColor: colors.border, justifyContent: "space-between",
  },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.md },
  deskTag: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(11,14,21,0.72)", borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  deskTagText: { color: colors.white, fontFamily: fonts.accent, fontSize: 10, fontWeight: "700", letterSpacing: 1.5 },
  onair: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(11,14,21,0.72)", borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  onairText: { color: colors.white, fontFamily: fonts.display, fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },

  bottom: { padding: spacing.lg, gap: 6 },
  tag: { color: colors.blue, fontFamily: fonts.accent, fontSize: 11, fontWeight: "700", letterSpacing: 2 },
  title: { color: colors.white, fontFamily: fonts.display, fontSize: 24, fontWeight: "800", letterSpacing: 0.4 },
  controls: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.xs },
  playBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.blue, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: 11 },
  playText: { color: colors.white, fontFamily: fonts.display, fontSize: 14, fontWeight: "800", letterSpacing: 1 },
  iconBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
  loadRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: spacing.xs },
  loadText: { color: colors.textDim, fontFamily: fonts.body, fontSize: 12 },
  quietText: { color: colors.textDim, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
});
