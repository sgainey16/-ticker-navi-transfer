import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";

import { colors, fonts, spacing, radius } from "@/src/theme";
import { api, HomeStory } from "@/src/lib/api";
import { playDataUri, beginSession, endSession, currentSession, subscribeSession, unlockAudio } from "@/src/lib/audio";
import { useVoiceRecorder } from "@/src/lib/recorder";
import { useFollows } from "@/src/lib/follows";
import YoutubeInline from "@/src/components/YoutubeInline";

const DESK = require("../../assets/images/broadcast-desk.png");
const HIGHLIGHT_HOLD = 30000;   // let a clip breathe before the show rolls on

type Voices = { reggie: string | null; marc: string | null };

/**
 * HomeShow — THE TICKER's produced, personalized Sports Desk. One PLAY starts the
 * show (nothing autoplays on open); it then AUTO-ADVANCES story → hosts → inline
 * highlight → next story. TALK joins the desk hands-free; STOP silences instantly.
 */
export function HomeShow() {
  const router = useRouter();
  const { follows } = useFollows();
  const rec = useVoiceRecorder();

  const [stories, setStories] = useState<HomeStory[]>([]);
  const [voices, setVoices] = useState<Voices>({ reggie: null, marc: null });
  const [loading, setLoading] = useState(true);
  const [idx, setIdx] = useState(0);
  const [mode, setMode] = useState<"idle" | "show" | "talk">("idle");
  const [speaking, setSpeaking] = useState(false);
  const [stage, setStage] = useState<"none" | "highlight">("none");
  const [caption, setCaption] = useState<{ who: string; text: string } | null>(null);

  const modeRef = useRef<"idle" | "show" | "talk">("idle");
  const tokenRef = useRef(0);
  const convoIdRef = useRef<string | null>(null);
  const resumeIdxRef = useRef(0);
  const followSig = JSON.stringify(follows);

  const setModeBoth = (m: "idle" | "show" | "talk") => { modeRef.current = m; setMode(m); };

  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const r = await api.homeShow(follows);
        if (!alive) return;
        setStories(r.stories || []);
        setVoices(r.voices);
      } catch { if (alive) setStories([]); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [followSig]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => subscribeSession(() => {
    if (currentSession() !== tokenRef.current) setSpeaking(false);
  }), []);
  useEffect(() => () => { modeRef.current = "idle"; if (currentSession() === tokenRef.current) endSession(); rec.abort(); rec.closeMic(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const speak = useCallback(async (beats: { host: string; text: string }[], token: number) => {
    for (const b of beats) {
      if (currentSession() !== token) return false;
      const vid = b.host === "reggie" ? voices.reggie : voices.marc;
      setCaption({ who: b.host, text: b.text });
      if (!vid) continue;
      setSpeaking(true);
      try {
        const res = await api.tts(b.text, vid, b.host === "marc" ? 1.08 : 1.0);
        if (currentSession() !== token) return false;
        await playDataUri(res.audio);
      } catch { /* silent */ }
      setSpeaking(false);
    }
    return currentSession() === token;
  }, [voices]);

  const wait = (ms: number, token: number) => new Promise<void>((resolve) => {
    const start = Date.now();
    const tick = () => {
      if (currentSession() !== token || Date.now() - start >= ms) return resolve();
      setTimeout(tick, 400);
    };
    tick();
  });

  const runShowFrom = useCallback(async (start: number) => {
    if (!stories.length) return;
    unlockAudio();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    rec.abort(); rec.closeMic();
    const token = beginSession();
    tokenRef.current = token;
    setModeBoth("show");
    for (let i = Math.max(0, start); i < stories.length; i++) {
      if (currentSession() !== token || modeRef.current !== "show") break;
      const s = stories[i];
      setIdx(i);
      setStage("none");
      setCaption(null);
      const ok = await speak(s.beats, token);
      if (!ok || modeRef.current !== "show") break;
      if (s.highlight?.youtube_id) {           // 2a — inline highlight, part of the show
        setStage("highlight");
        await wait(HIGHLIGHT_HOLD, token);
        setStage("none");
      } else {
        await wait(1200, token);                // brief graphic beat
      }
    }
    if (modeRef.current === "show") { setModeBoth("idle"); setStage("none"); setCaption(null); setSpeaking(false); }
  }, [stories, speak, rec]);

  const talkLoop = useCallback(async () => {
    let empties = 0;
    const s = stories[idx];
    while (modeRef.current === "talk") {
      const clip = await rec.captureUtterance();
      if (modeRef.current !== "talk") break;
      if (!clip) { empties += 1; if (empties >= 2) break; continue; }
      empties = 0;
      try {
        const r = await api.converse({ subject: s?.subject || "nhl", league: s?.league || "nhl", conversation_id: convoIdRef.current, clip });
        convoIdRef.current = r.conversation_id;
        if (modeRef.current !== "talk") break;
        const token = beginSession(); tokenRef.current = token;
        setCaption({ who: "you", text: r.user_text });
        await speak(r.beats, token);
      } catch { /* ignore */ }
    }
    rec.closeMic();
    if (modeRef.current === "talk") { setModeBoth("idle"); runShowFrom(resumeIdxRef.current); }  // quiet -> back to the rundown
  }, [rec, stories, idx, speak, runShowFrom]);

  const startTalk = useCallback(async () => {
    unlockAudio();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    resumeIdxRef.current = idx + 1;                 // after the chat, continue the rundown
    endSession(); setSpeaking(false); setStage("none");
    setModeBoth("talk");
    const ok = await rec.openMic();
    if (!ok) { setModeBoth("idle"); return; }
    talkLoop();
  }, [rec, talkLoop, idx]);

  const stopAll = useCallback(() => {
    setModeBoth("idle"); endSession(); setSpeaking(false); setStage("none"); setCaption(null);
    rec.abort(); rec.closeMic();
  }, [rec]);

  const active = stories[idx];
  const status = rec.listening ? "LISTENING" : speaking ? "ON AIR" : mode === "show" ? "ON AIR" : "";
  const playing = mode !== "idle";

  return (
    <View testID="home-show">
      <View style={styles.panel}>
        <Image source={DESK} style={StyleSheet.absoluteFill} contentFit="cover" />
        <LinearGradient colors={["rgba(5,7,12,0.30)", "rgba(5,7,12,0.66)", "rgba(5,7,12,0.96)"]} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
        <LinearGradient colors={["rgba(5,7,12,0)", "rgba(5,7,12,0.9)", "rgba(5,7,12,0.99)"]} locations={[0, 0.4, 1]} style={[styles.lower, { pointerEvents: "none" }]} />

        <View style={styles.top}>
          <View style={styles.tagPill}><Ionicons name="mic" size={11} color={colors.blue} /><Text style={styles.tagPillText}>REGGIE + MARC</Text></View>
          {status ? (
            <View style={styles.onair}>
              <View style={[styles.dot, { backgroundColor: rec.listening ? colors.red : speaking ? colors.blue : colors.gold }]} />
              <Text style={styles.onairText}>{status}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.bottom}>
          <Text style={[styles.kicker, playing && active?.breaking && styles.breaking]}>{playing && active ? (active.breaking ? `🔴 ${active.subtitle}` : `NOW: ${active.subtitle}`) : "MY TICKER"}</Text>
          <Text style={styles.title} numberOfLines={2}>{playing && active ? active.title : "YOUR HOCKEY STARTS HERE"}</Text>

          {loading ? (
            <View style={styles.loadRow}><ActivityIndicator size="small" color={colors.blue} /><Text style={styles.loadText}>Building your show…</Text></View>
          ) : stories.length ? (
            <View style={styles.controls}>
              <Pressable testID="home-play" style={[styles.btn, styles.playBtn]} onPress={() => (mode === "show" ? stopAll() : runShowFrom(0))}>
                <Ionicons name={mode === "show" ? "pause" : "play"} size={15} color={colors.white} />
                <Text style={styles.btnText}>{mode === "show" ? "PAUSE" : "PLAY MY SHOW"}</Text>
              </Pressable>
              <Pressable testID="home-talk" style={[styles.btn, styles.talkBtn, rec.listening && styles.talkActive]} onPress={startTalk}>
                <Ionicons name="mic" size={15} color={colors.white} />
                <Text style={styles.btnText}>{rec.listening ? "LISTENING" : "TALK"}</Text>
              </Pressable>
              <Pressable testID="home-stop" disabled={!playing && !speaking} style={[styles.iconBtn, (!playing && !speaking) && styles.dim]} hitSlop={8} onPress={stopAll}>
                <Ionicons name="stop" size={16} color={colors.white} />
              </Pressable>
            </View>
          ) : (
            <Text style={styles.quiet}>The desk is quiet right now.</Text>
          )}
        </View>
      </View>

      {/* STAGE — the show's visual: inline highlight, or the story graphic/caption */}
      {playing && active ? (
        <View style={styles.stage}>
          {stage === "highlight" && active.highlight?.youtube_id ? (
            <View style={styles.videoWrap}>
              <YoutubeInline videoId={active.highlight.youtube_id} height={198} />
              <Text style={styles.videoCap} numberOfLines={1}>{active.highlight.title}</Text>
            </View>
          ) : (
            <Pressable style={styles.graphic} onPress={() => active.game_link ? router.push(`/game/${active.game_link}`) : router.push(`/team/${active.subject}${active.league !== "nhl" ? `?league=${active.league}` : ""}`)}>
              {active.stat ? (
                <View style={styles.statBox}>
                  <Text style={styles.statVal}>{active.stat.value}</Text>
                  <Text style={styles.statLabel}>{active.stat.label}</Text>
                </View>
              ) : null}
              {caption ? (
                <View style={{ flex: 1 }}>
                  <Text style={styles.capWho}>{caption.who.toUpperCase()}</Text>
                  <Text style={styles.capText} numberOfLines={3}>{caption.text}</Text>
                </View>
              ) : <View style={{ flex: 1 }} />}
              <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
            </Pressable>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { height: 216, borderRadius: radius.lg, overflow: "hidden", borderWidth: 1, borderColor: colors.border, justifyContent: "space-between" },
  lower: { position: "absolute", left: 0, right: 0, bottom: 0, height: 150 },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.md },
  tagPill: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(11,14,21,0.72)", borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  tagPillText: { color: colors.white, fontFamily: fonts.accent, fontSize: 10, fontWeight: "700", letterSpacing: 1.5 },
  onair: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(11,14,21,0.72)", borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  onairText: { color: colors.white, fontFamily: fonts.display, fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },

  bottom: { padding: spacing.lg, paddingTop: spacing.md, gap: 7 },
  kicker: { color: colors.blue, fontFamily: fonts.accent, fontSize: 10.5, fontWeight: "700", letterSpacing: 1.5 },
  breaking: { color: colors.red },
  title: { color: colors.white, fontFamily: fonts.display, fontSize: 20, fontWeight: "800", letterSpacing: 0.3 },
  controls: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.xs },
  btn: { flexDirection: "row", alignItems: "center", gap: 7, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: 11 },
  playBtn: { backgroundColor: colors.blue },
  talkBtn: { backgroundColor: colors.green },
  talkActive: { backgroundColor: colors.red },
  dim: { opacity: 0.45 },
  btnText: { color: colors.white, fontFamily: fonts.display, fontSize: 13.5, fontWeight: "800", letterSpacing: 1 },
  iconBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
  loadRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: spacing.xs },
  loadText: { color: colors.textDim, fontFamily: fonts.body, fontSize: 12 },
  quiet: { color: colors.textDim, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },

  stage: { marginTop: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.blueDim, overflow: "hidden" },
  videoWrap: { gap: 0 },
  videoCap: { color: colors.textDim, fontFamily: fonts.body, fontSize: 11.5, padding: spacing.sm },
  graphic: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md },
  statBox: { alignItems: "center", backgroundColor: colors.bgElev, borderRadius: radius.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, minWidth: 96 },
  statVal: { color: colors.white, fontFamily: fonts.display, fontSize: 16, fontWeight: "800" },
  statLabel: { color: colors.textFaint, fontFamily: fonts.accent, fontSize: 8.5, fontWeight: "700", letterSpacing: 1 },
  capWho: { color: colors.blue, fontFamily: fonts.accent, fontSize: 9.5, fontWeight: "800", letterSpacing: 1.2 },
  capText: { color: colors.text, fontFamily: fonts.body, fontSize: 13, lineHeight: 18, marginTop: 2 },
});
