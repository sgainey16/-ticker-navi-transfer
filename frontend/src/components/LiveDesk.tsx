import React, { useCallback, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, TextInput, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";

import { colors, fonts, spacing, radius } from "@/src/theme";
import { api, ConverseResponse, ConverseSuggestion, DeskBeat, VoiceClip } from "@/src/lib/api";
import { playDataUri, beginSession, endSession, currentSession, subscribeSession } from "@/src/lib/audio";
import { useVoiceRecorder } from "@/src/lib/recorder";
import { useFollows, TeamFollow, PlayerFollow } from "@/src/lib/follows";

type ThreadItem = { who: "you" | "reggie" | "marc"; text: string };

const HOST_COLOR: Record<string, string> = { reggie: colors.green, marc: colors.blue, you: colors.textDim };
const HOST_NAME: Record<string, string> = { reggie: "REGGIE", marc: "MARC", you: "YOU" };

/**
 * LiveDesk — the fan JOINS Reggie + Marc in one shared conversation, grounded in
 * this team's verified facts. Voice in (mic) -> Reggie + Marc reply in their real
 * voices -> tappable suggestions that navigate or Follow. One-panel extension of
 * the desk; participates in the single global audio session. Team page only.
 */
export function LiveDesk({ subject, league }: { subject: string; league: string }) {
  const router = useRouter();
  const { follows, saveFollows, isTeam, isPlayer } = useFollows();
  const rec = useVoiceRecorder();

  const [convoId, setConvoId] = useState<string | null>(null);
  const [thread, setThread] = useState<ThreadItem[]>([]);
  const [suggestions, setSuggestions] = useState<ConverseSuggestion[]>([]);
  const [busy, setBusy] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [muted, setMuted] = useState(false);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const tokenRef = useRef(0);

  const lg = league || "nhl";
  const lq = lg === "nhl" ? "" : `?league=${lg}`;

  React.useEffect(() => subscribeSession(() => {
    if (currentSession() !== tokenRef.current) setSpeaking(false);
  }), []);
  React.useEffect(() => () => { if (currentSession() === tokenRef.current) endSession(); }, []);

  const flash = useCallback((m: string) => { setToast(m); setTimeout(() => setToast(null), 2600); }, []);

  const playBeats = useCallback(async (beats: DeskBeat[], voices: { reggie: string | null; marc: string | null }) => {
    const token = beginSession();
    tokenRef.current = token;
    setSpeaking(true);
    for (const b of beats) {
      if (currentSession() !== token) return;
      const vid = b.host === "reggie" ? voices.reggie : voices.marc;
      if (muted || !vid) continue;
      try {
        const res = await api.tts(b.text, vid, b.host === "marc" ? 1.08 : 1.0);
        if (currentSession() !== token) return;
        await playDataUri(res.audio);
      } catch { /* silent on audio failure */ }
    }
    if (currentSession() === token) setSpeaking(false);
  }, [muted]);

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

  const send = useCallback(async (clip?: VoiceClip | null, text?: string) => {
    endSession();
    setBusy(true);
    setSuggestions([]);
    try {
      const r: ConverseResponse = await api.converse({ subject, league: lg, conversation_id: convoId, clip, text });
      setConvoId(r.conversation_id);
      const add: ThreadItem[] = [{ who: "you", text: r.user_text }, ...r.beats.map((b) => ({ who: b.host, text: b.text }))];
      setThread((prev) => [...prev, ...add].slice(-8));
      setSuggestions(r.suggestions || []);
      if (r.action?.type === "follow") applyFollow(r.action.kind, r.action.entity);
      await playBeats(r.beats, r.voices);
    } catch {
      flash("Couldn't reach the desk. Try again.");
    } finally {
      setBusy(false);
    }
  }, [subject, lg, convoId, playBeats, applyFollow, flash]);

  const onMic = useCallback(async () => {
    if (busy) return;
    if (rec.recording) {
      const clip = await rec.stop();
      if (clip) send(clip);
      else flash("Didn't catch that.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    endSession();
    setSpeaking(false);
    await rec.start();
  }, [busy, rec, send, flash]);

  const onSendText = useCallback(() => {
    const t = draft.trim();
    if (!t) return;
    setDraft("");
    setTyping(false);
    send(undefined, t);
  }, [draft, send]);

  const denied = rec.permission === "denied";
  const status = rec.recording ? "LISTENING" : busy ? "THINKING" : speaking ? "ON AIR" : "";

  return (
    <View style={styles.wrap} testID="live-desk">
      <View style={styles.head}>
        <View style={styles.headLeft}>
          <Ionicons name="radio" size={13} color={colors.green} />
          <Text style={styles.headTitle}>TALK TO THE DESK</Text>
        </View>
        {status ? (
          <View style={styles.status}>
            <View style={[styles.dot, { backgroundColor: rec.recording ? colors.red : speaking ? colors.green : colors.gold }]} />
            <Text style={styles.statusText}>{status}</Text>
          </View>
        ) : null}
      </View>

      {/* compact live thread — last few exchanges only, no transcript wall */}
      {thread.length ? (
        <View style={styles.thread}>
          {thread.slice(-4).map((t, i) => (
            <View key={i} style={styles.line}>
              <Text style={[styles.who, { color: HOST_COLOR[t.who] }]}>{HOST_NAME[t.who]}</Text>
              <Text style={styles.lineText}>{t.text}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.hint}>
          Tap the mic and talk hockey — ask who to watch, how they’re playing, or who’s up next.
        </Text>
      )}

      {/* suggestion chips — every one resolves to a real page or Follow */}
      {suggestions.length ? (
        <View style={styles.chips}>
          {suggestions.map((s, i) => {
            const follow = s.kind === "follow_team" || s.kind === "follow_player";
            const already = follow && (s.kind === "follow_team" ? isTeam(s.entity.abbr) : isPlayer(s.entity.player_id));
            return (
              <Pressable key={i} testID={`live-suggestion-${i}`} onPress={() => openSuggestion(s)} style={[styles.chip, follow && styles.chipFollow, already && styles.chipDone]}>
                <Ionicons
                  name={already ? "checkmark" : follow ? "add" : s.kind === "game" ? "calendar" : s.kind === "team" ? "shield" : "person"}
                  size={13}
                  color={already ? colors.green : follow ? colors.green : colors.blue}
                />
                <Text style={styles.chipText} numberOfLines={1}>{already ? `Following ${s.entity.name || s.entity.abbr}` : s.label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {denied ? (
        <View style={styles.permRow}>
          <Text style={styles.permText}>Microphone is off. Turn it on to talk to the desk.</Text>
          <Pressable style={styles.settingsBtn} onPress={() => Linking.openSettings()}>
            <Text style={styles.settingsText}>Open Settings</Text>
          </Pressable>
        </View>
      ) : null}

      {/* controls */}
      {typing ? (
        <View style={styles.typeRow}>
          <TextInput
            testID="live-text-input"
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder="Type to the desk…"
            placeholderTextColor={colors.textFaint}
            onSubmitEditing={onSendText}
            returnKeyType="send"
            autoFocus
          />
          <Pressable testID="live-text-send" style={styles.sendBtn} onPress={onSendText}>
            <Ionicons name="arrow-up" size={18} color={colors.white} />
          </Pressable>
          <Pressable style={styles.iconBtn} onPress={() => { setTyping(false); setDraft(""); }} hitSlop={8}>
            <Ionicons name="close" size={18} color={colors.textDim} />
          </Pressable>
        </View>
      ) : (
        <View style={styles.controls}>
          <Pressable
            testID="live-mic"
            disabled={busy}
            onPress={onMic}
            style={[styles.micBtn, rec.recording && styles.micActive, busy && styles.micBusy]}
          >
            {busy ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Ionicons name={rec.recording ? "stop" : "mic"} size={18} color={colors.white} />
            )}
            <Text style={styles.micText}>
              {busy ? "ON THE DESK…" : rec.recording ? "TAP TO SEND" : "TAP TO TALK"}
            </Text>
          </Pressable>

          {speaking ? (
            <>
              <Pressable testID="live-stop" style={styles.iconBtn} hitSlop={8} onPress={() => { endSession(); setSpeaking(false); }}>
                <Ionicons name="stop" size={16} color={colors.white} />
              </Pressable>
              <Pressable testID="live-mute" style={styles.iconBtn} hitSlop={8} onPress={() => setMuted((m) => { if (!m) endSession(); return !m; })}>
                <Ionicons name={muted ? "volume-mute" : "volume-high"} size={16} color={muted ? colors.textDim : colors.white} />
              </Pressable>
            </>
          ) : (
            <Pressable testID="live-type-toggle" style={styles.iconBtn} hitSlop={8} onPress={() => setTyping(true)}>
              <Ionicons name="chatbox-ellipses-outline" size={16} color={colors.textDim} />
            </Pressable>
          )}
        </View>
      )}

      {toast ? <Text style={styles.toast}>{toast}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: -spacing.sm, marginHorizontal: 0,
    backgroundColor: colors.surface,
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    borderTopLeftRadius: 0, borderTopRightRadius: 0,
    padding: spacing.md, gap: spacing.sm,
  },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  headTitle: { color: colors.white, fontFamily: fonts.accent, fontSize: 11, fontWeight: "700", letterSpacing: 1.6 },
  status: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { color: colors.textDim, fontFamily: fonts.display, fontSize: 10, fontWeight: "800", letterSpacing: 1.2 },

  thread: { gap: spacing.sm },
  line: { gap: 2 },
  who: { fontFamily: fonts.accent, fontSize: 9.5, fontWeight: "800", letterSpacing: 1.2 },
  lineText: { color: colors.text, fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19 },
  hint: { color: colors.textDim, fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18 },

  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: 2 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.bgElev, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.blueDim, paddingHorizontal: 11, paddingVertical: 7, maxWidth: "100%" },
  chipFollow: { borderColor: colors.greenDim },
  chipDone: { borderColor: colors.greenDim, opacity: 0.7 },
  chipText: { color: colors.text, fontFamily: fonts.display, fontSize: 12.5, fontWeight: "700", flexShrink: 1 },

  permRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, backgroundColor: colors.bgElev, borderRadius: radius.md, padding: spacing.sm },
  permText: { color: colors.textDim, fontFamily: fonts.body, fontSize: 12, flex: 1 },
  settingsBtn: { backgroundColor: colors.blue, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7 },
  settingsText: { color: colors.white, fontFamily: fonts.display, fontSize: 12, fontWeight: "800" },

  controls: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: 2 },
  micBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.green, borderRadius: radius.pill, paddingVertical: 12 },
  micActive: { backgroundColor: colors.red },
  micBusy: { backgroundColor: colors.borderStrong },
  micText: { color: colors.white, fontFamily: fonts.display, fontSize: 14, fontWeight: "800", letterSpacing: 1 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceHi, alignItems: "center", justifyContent: "center" },

  typeRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: 2 },
  input: { flex: 1, backgroundColor: colors.bgElev, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: 10, color: colors.text, fontFamily: fonts.body, fontSize: 14 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.green, alignItems: "center", justifyContent: "center" },

  toast: { color: colors.green, fontFamily: fonts.display, fontSize: 12, fontWeight: "700", textAlign: "center", marginTop: 2 },
});
