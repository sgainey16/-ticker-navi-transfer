import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Linking } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";

import { colors, fonts, spacing, radius } from "@/src/theme";
import { api, DeskSegment, DeskBeat, ConverseSuggestion } from "@/src/lib/api";
import { playDataUri, beginSession, endSession, currentSession, subscribeSession, unlockAudio } from "@/src/lib/audio";
import { useVoiceRecorder } from "@/src/lib/recorder";
import { useFollows, TeamFollow, PlayerFollow } from "@/src/lib/follows";

const DESK = require("../../assets/images/broadcast-desk.png");

const SHOW_CONTINUE =
  "Keep the show rolling: raise ONE genuinely interesting player or storyline on this team " +
  "from the facts, Reggie and Marc riffing briefly, then wrap up naturally. One connection only — do not open several threads.";

type Mode = "idle" | "show" | "convo";
type ThreadItem = { who: "you" | "reggie" | "marc"; text: string };
const HOST_COLOR: Record<string, string> = { reggie: colors.green, marc: colors.blue, you: colors.textDim };
const HOST_NAME: Record<string, string> = { reggie: "REGGIE", marc: "MARC", you: "YOU" };

/**
 * TeamDesk — ONE continuous Reggie + Marc desk on the Team page. PLAY runs the
 * grounded team show (with one webbed continuation, then a quiet ending); TALK
 * lets the fan join hands-free (listen → detect end of speech → respond → listen
 * again); STOP always, immediately silences. Everything shares the single global
 * audio session and is grounded only in this team's verified facts.
 */
export function TeamDesk({ subject, league, fallbackTitle }: { subject: string; league: string; fallbackTitle?: string }) {
  const router = useRouter();
  const { follows, saveFollows, isTeam, isPlayer } = useFollows();
  const rec = useVoiceRecorder();

  const [seg, setSeg] = useState<DeskSegment | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>("idle");
  const [speaking, setSpeaking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [thread, setThread] = useState<ThreadItem[]>([]);
  const [suggestions, setSuggestions] = useState<ConverseSuggestion[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  const modeRef = useRef<Mode>("idle");
  const convoIdRef = useRef<string | null>(null);
  const tokenRef = useRef(0);
  const bridgesRef = useRef<{ audio: string }[]>([]);

  const lg = league || "nhl";
  const lq = lg === "nhl" ? "" : `?league=${lg}`;

  const setModeBoth = useCallback((m: Mode) => { modeRef.current = m; setMode(m); }, []);
  const flash = useCallback((m: string) => { setToast(m); setTimeout(() => setToast(null), 2600); }, []);
  const pushThread = useCallback((items: ThreadItem[]) => setThread((p) => [...p, ...items].slice(-8)), []);

  // fetch the prepared team show once (no autoplay)
  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const data = await api.tickerSegment("team", subject, lg);
        if (alive) setSeg(data);
      } catch { if (alive) setSeg(null); } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [subject, lg]);

  // if another surface grabs the audio session, drop our speaking state
  useEffect(() => subscribeSession(() => {
    if (currentSession() !== tokenRef.current) setSpeaking(false);
  }), []);

  // full teardown on unmount
  useEffect(() => () => {
    modeRef.current = "idle";
    if (currentSession() === tokenRef.current) endSession();
    rec.abort(); rec.closeMic();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // pre-synthesize grounded, varied bridge clips so retrieval time is filled naturally
  const primeBridges = useCallback(async () => {
    if (bridgesRef.current.length) return;
    try {
      const b = await api.bridges(subject, lg);
      const pick = [...b.lines].sort(() => Math.random() - 0.5).slice(0, 3);
      const clips: { audio: string }[] = [];
      for (const ln of pick) {
        const vid = ln.host === "marc" ? b.voices.marc : b.voices.reggie;
        if (!vid) continue;
        try { const r = await api.tts(ln.text, vid, ln.host === "marc" ? 1.08 : 1.0); clips.push({ audio: r.audio }); } catch { /* ignore */ }
      }
      bridgesRef.current = clips;
    } catch { /* ignore */ }
  }, [subject, lg]);

  const playBridge = useCallback(async () => {
    const clips = bridgesRef.current;
    if (!clips.length) return;
    const token = beginSession();
    tokenRef.current = token;
    setSpeaking(true);
    const c = clips[Math.floor(Math.random() * clips.length)];
    if (c) { try { await playDataUri(c.audio); } catch { /* ignore */ } }
  }, []);

  const playReply = useCallback(async (beats: DeskBeat[], voices: { reggie: string | null; marc: string | null }) => {
    const token = beginSession();
    tokenRef.current = token;
    setSpeaking(true);
    for (const b of beats) {
      if (currentSession() !== token) return false;
      const vid = b.host === "reggie" ? voices.reggie : voices.marc;
      if (!vid) continue;
      try {
        const res = await api.tts(b.text, vid, b.host === "marc" ? 1.08 : 1.0);
        if (currentSession() !== token) return false;
        await playDataUri(res.audio);
      } catch { /* silent on audio failure */ }
    }
    const ok = currentSession() === token;
    if (ok) setSpeaking(false);
    return ok;
  }, []);

  const applyFollow = useCallback((kind: string, entity: any) => {
    if (kind === "follow_team") {
      if (isTeam(entity.abbr)) { flash(`Already following ${entity.name || entity.abbr}`); return; }
      const t: TeamFollow = { abbr: entity.abbr, name: entity.name, league: entity.league, logo: entity.logo };
      saveFollows({ ...follows, teams: [...follows.teams, t] });
      flash(`Following ${entity.name || entity.abbr}`);
    } else if (kind === "follow_player") {
      if (isPlayer(entity.player_id)) { flash(`Already following ${entity.name}`); return; }
      const p: PlayerFollow = { player_id: entity.player_id, team_abbr: entity.team_abbr, name: entity.name, pos: entity.pos, league: entity.league };
      saveFollows({ ...follows, players: [...follows.players, p] });
      flash(`Following ${entity.name}`);
    }
  }, [follows, saveFollows, isTeam, isPlayer, flash]);

  const openSuggestion = useCallback((s: ConverseSuggestion) => {
    Haptics.selectionAsync();
    if (s.kind === "player") router.push(`/player/${s.entity.player_id}${lq}`);
    else if (s.kind === "team") router.push(`/team/${s.entity.abbr}${lq}`);
    else if (s.kind === "game") router.push(`/game/${s.entity.id}${lq}`);
    else applyFollow(s.kind, s.entity);
  }, [router, lq, applyFollow]);

  const stopAll = useCallback(() => {
    setModeBoth("idle");
    endSession();
    setSpeaking(false);
    setBusy(false);
    rec.abort();
    rec.closeMic();
  }, [setModeBoth, rec]);

  // ---- PLAY: the team show + one webbed continuation, then a quiet ending ----
  const startShow = useCallback(async () => {
    if (!seg || !seg.beats.length || busy) return;
    unlockAudio();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    rec.abort(); rec.closeMic();
    setModeBoth("show");
    const ok = await playReply(seg.beats, seg.voices);
    if (!ok || modeRef.current !== "show") return;
    try {
      setBusy(true);
      const r = await api.converse({ subject, league: lg, conversation_id: convoIdRef.current, directive: SHOW_CONTINUE });
      convoIdRef.current = r.conversation_id;
      setBusy(false);
      if (modeRef.current !== "show") return;
      setSuggestions(r.suggestions || []);
      await playReply(r.beats, r.voices);
    } catch { setBusy(false); }
    if (modeRef.current === "show") setModeBoth("idle");
  }, [seg, busy, rec, playReply, setModeBoth, subject, lg]);

  // ---- TALK: join the same session, hands-free turn-taking ----
  const conversationLoop = useCallback(async () => {
    let empties = 0;
    while (modeRef.current === "convo") {
      const clip = await rec.captureUtterance();
      if (modeRef.current !== "convo") break;
      if (!clip) { empties += 1; if (empties >= 2) break; continue; }
      empties = 0;
      setBusy(true);
      playBridge(); // instant acknowledgement — cover retrieval latency, no dead air
      try {
        const r = await api.converse({ subject, league: lg, conversation_id: convoIdRef.current, clip });
        convoIdRef.current = r.conversation_id;
        pushThread([{ who: "you", text: r.user_text }, ...r.beats.map((b) => ({ who: b.host as ThreadItem["who"], text: b.text }))]);
        setSuggestions(r.suggestions || []);
        if (r.action?.type === "follow") applyFollow(r.action.kind, r.action.entity);
        setBusy(false);
        if (modeRef.current !== "convo") break;
        await playReply(r.beats, r.voices);
      } catch { setBusy(false); flash("Couldn't reach the desk."); }
    }
    rec.closeMic();
    if (modeRef.current === "convo") setModeBoth("idle");
  }, [rec, subject, lg, pushThread, applyFollow, playReply, playBridge, flash, setModeBoth]);

  const startTalk = useCallback(async () => {
    unlockAudio();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    endSession();          // user speech takes priority over the running show
    setSpeaking(false);
    setModeBoth("convo");
    const ok = await rec.openMic();
    if (!ok) { setModeBoth("idle"); return; }   // denied -> settings UI shows
    primeBridges();  // warm up grounded, varied latency-cover clips
    conversationLoop();
  }, [rec, setModeBoth, conversationLoop, primeBridges]);

  const active = mode !== "idle";
  const status = rec.listening ? "LISTENING" : busy ? "THINKING" : speaking ? "ON AIR" : "";
  const title = seg?.title || fallbackTitle || "ON THE DESK";
  const ready = !!seg && seg.state === "ready" && seg.beats.length > 0;
  const denied = rec.permission === "denied";

  return (
    <View testID="team-desk">
      {/* the desk panel — Reggie + Marc together, one panel */}
      <View style={styles.panel}>
        <Image source={DESK} style={StyleSheet.absoluteFill} contentFit="cover" />
        <LinearGradient colors={["rgba(5,7,12,0.30)", "rgba(5,7,12,0.66)", "rgba(5,7,12,0.96)"]} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
        {/* protected lower-third: keeps title + controls readable and off the hosts' faces */}
        <LinearGradient colors={["rgba(5,7,12,0)", "rgba(5,7,12,0.9)", "rgba(5,7,12,0.99)"]} locations={[0, 0.4, 1]} style={[styles.lowerThird, { pointerEvents: "none" }]} />

        <View style={styles.top}>
          <View style={styles.deskTag}><Ionicons name="mic" size={11} color={colors.blue} /><Text style={styles.deskTagText}>REGGIE + MARC</Text></View>
          {status ? (
            <View style={styles.onair}>
              <View style={[styles.dot, { backgroundColor: rec.listening ? colors.red : speaking ? colors.blue : colors.gold }]} />
              <Text style={styles.onairText}>{status}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.bottom}>
          <Text style={styles.tag}>LIVE DESK</Text>
          <Text style={styles.title} numberOfLines={2}>{title}</Text>

          {rec.listening ? (
            <View style={styles.levelRow}>
              <View style={styles.levelTrack}><View style={[styles.levelFill, { width: `${Math.round(20 + rec.level * 80)}%` }]} /></View>
              <Text style={styles.levelHint}>go ahead — I’m listening</Text>
            </View>
          ) : null}

          {loading ? (
            <View style={styles.loadRow}><ActivityIndicator size="small" color={colors.blue} /><Text style={styles.loadText}>Cueing the desk…</Text></View>
          ) : (
            <View style={styles.controls}>
              <Pressable
                testID="desk-play"
                disabled={!ready || busy}
                style={[styles.btn, styles.playBtn, (!ready || busy) && styles.btnDim]}
                onPress={startShow}
              >
                <Ionicons name="play" size={15} color={colors.white} />
                <Text style={styles.btnText}>{mode === "show" ? "SHOW" : "PLAY"}</Text>
              </Pressable>

              <Pressable
                testID="desk-talk"
                disabled={busy && mode !== "convo"}
                style={[styles.btn, styles.talkBtn, rec.listening && styles.talkActive]}
                onPress={startTalk}
              >
                <Ionicons name="mic" size={15} color={colors.white} />
                <Text style={styles.btnText}>{rec.listening ? "LISTENING" : "TALK"}</Text>
              </Pressable>

              <Pressable
                testID="desk-stop"
                disabled={!active && !speaking}
                style={[styles.iconBtn, (!active && !speaking) && styles.btnDim]}
                hitSlop={8}
                onPress={stopAll}
              >
                <Ionicons name="stop" size={16} color={colors.white} />
              </Pressable>
            </View>
          )}
          {!loading && !ready ? <Text style={styles.quietText}>The desk is quiet right now.</Text> : null}
        </View>
      </View>

      {/* connected extension: mic-permission help, compact thread, webbing chips */}
      {(denied || thread.length > 0 || suggestions.length > 0 || toast) ? (
        <View style={styles.ext}>
          {denied ? (
            <View style={styles.permRow}>
              <Text style={styles.permText}>Microphone is off. Turn it on to talk to the desk.</Text>
              <Pressable style={styles.settingsBtn} onPress={() => Linking.openSettings()}><Text style={styles.settingsText}>Open Settings</Text></Pressable>
            </View>
          ) : null}

          {thread.length ? (
            <View style={styles.threadBox}>
              {thread.slice(-4).map((t, i) => (
                <View key={i} style={styles.line}>
                  <Text style={[styles.who, { color: HOST_COLOR[t.who] }]}>{HOST_NAME[t.who]}</Text>
                  <Text style={styles.lineText}>{t.text}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {suggestions.length ? (
            <View style={styles.chips}>
              {suggestions.map((s, i) => {
                const follow = s.kind === "follow_team" || s.kind === "follow_player";
                const already = follow && (s.kind === "follow_team" ? isTeam(s.entity.abbr) : isPlayer(s.entity.player_id));
                return (
                  <Pressable key={i} testID={`desk-suggestion-${i}`} onPress={() => openSuggestion(s)} style={[styles.chip, follow && styles.chipFollow, already && styles.chipDone]}>
                    <Ionicons name={already ? "checkmark" : follow ? "add" : s.kind === "game" ? "calendar" : s.kind === "team" ? "shield" : "person"} size={13} color={already || follow ? colors.green : colors.blue} />
                    <Text style={styles.chipText} numberOfLines={1}>{already ? `Following ${s.entity.name || s.entity.abbr}` : s.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {toast ? <Text style={styles.toast}>{toast}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { height: 216, borderRadius: radius.lg, overflow: "hidden", borderWidth: 1, borderColor: colors.border, justifyContent: "space-between" },
  lowerThird: { position: "absolute", left: 0, right: 0, bottom: 0, height: 150 },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.md },
  deskTag: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(11,14,21,0.72)", borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  deskTagText: { color: colors.white, fontFamily: fonts.accent, fontSize: 10, fontWeight: "700", letterSpacing: 1.5 },
  onair: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(11,14,21,0.72)", borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  onairText: { color: colors.white, fontFamily: fonts.display, fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },

  bottom: { padding: spacing.lg, paddingTop: spacing.md, gap: 7 },
  tag: { color: colors.blue, fontFamily: fonts.accent, fontSize: 11, fontWeight: "700", letterSpacing: 2 },
  title: { color: colors.white, fontFamily: fonts.display, fontSize: 20, fontWeight: "800", letterSpacing: 0.3 },

  levelRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
  levelTrack: { flex: 1, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.18)", overflow: "hidden" },
  levelFill: { height: 4, borderRadius: 2, backgroundColor: colors.red },
  levelHint: { color: "rgba(255,255,255,0.7)", fontFamily: fonts.body, fontSize: 11 },

  controls: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.xs },
  btn: { flexDirection: "row", alignItems: "center", gap: 7, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: 11 },
  playBtn: { backgroundColor: colors.blue },
  talkBtn: { backgroundColor: colors.green },
  talkActive: { backgroundColor: colors.red },
  btnDim: { opacity: 0.45 },
  btnText: { color: colors.white, fontFamily: fonts.display, fontSize: 13.5, fontWeight: "800", letterSpacing: 1 },
  iconBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
  loadRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: spacing.xs },
  loadText: { color: colors.textDim, fontFamily: fonts.body, fontSize: 12 },
  quietText: { color: colors.textDim, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },

  ext: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderTopWidth: 0,
    borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg,
    padding: spacing.md, gap: spacing.sm,
  },
  permRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, backgroundColor: colors.bgElev, borderRadius: radius.md, padding: spacing.sm },
  permText: { color: colors.textDim, fontFamily: fonts.body, fontSize: 12, flex: 1 },
  settingsBtn: { backgroundColor: colors.blue, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7 },
  settingsText: { color: colors.white, fontFamily: fonts.display, fontSize: 12, fontWeight: "800" },

  threadBox: { gap: spacing.sm },
  line: { gap: 2 },
  who: { fontFamily: fonts.accent, fontSize: 9.5, fontWeight: "800", letterSpacing: 1.2 },
  lineText: { color: colors.text, fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19 },

  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.bgElev, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.blueDim, paddingHorizontal: 11, paddingVertical: 7, maxWidth: "100%" },
  chipFollow: { borderColor: colors.greenDim },
  chipDone: { borderColor: colors.greenDim, opacity: 0.7 },
  chipText: { color: colors.text, fontFamily: fonts.display, fontSize: 12.5, fontWeight: "700", flexShrink: 1 },

  toast: { color: colors.green, fontFamily: fonts.display, fontSize: 12, fontWeight: "700", textAlign: "center" },
});
