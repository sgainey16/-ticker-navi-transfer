import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { colors, fonts, spacing, radius, hostStyle } from "@/src/theme";
import { api } from "@/src/lib/api";
import { storage } from "@/src/utils/storage";

const RAYO = require("../assets/images/rayo.jpg");
const CASEY = require("../assets/images/casey.jpg");
const SESSION_KEY = "masl_talk_session";

type Msg = { role: "user" | "rayo" | "casey"; text: string };

const SUGGESTIONS = [
  "How did Milwaukee beat Utica 17-2?",
  "Is Rian Marques the MVP?",
  "Explain a power play in arena soccer",
  "What's a three-line violation?",
];

export default function Talk() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [session, setSession] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    (async () => {
      const sid = await storage.getItem<string>(SESSION_KEY, "");
      if (sid) {
        setSession(sid);
        try {
          const hist = await api.talkHistory(sid);
          const msgs: Msg[] = [];
          hist.turns.forEach((t: any) => {
            if (t.role === "user") msgs.push({ role: "user", text: t.text });
            else {
              if (t.rayo) msgs.push({ role: "rayo", text: t.rayo });
              if (t.casey) msgs.push({ role: "casey", text: t.casey });
            }
          });
          setMessages(msgs);
        } catch {}
      }
    })();
  }, []);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || sending) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setInput("");
    setMessages((m) => [...m, { role: "user", text: q }]);
    setSending(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    try {
      const res = await api.talk(q, session);
      if (!session) {
        setSession(res.session_id);
        await storage.setItem(SESSION_KEY, res.session_id);
      }
      setMessages((m) => [
        ...m,
        ...(res.rayo ? [{ role: "rayo" as const, text: res.rayo }] : []),
        ...(res.casey ? [{ role: "casey" as const, text: res.casey }] : []),
      ]);
    } catch {
      setMessages((m) => [...m, { role: "rayo", text: "Booth's audio dropped for a second — hit me with that again, ¿sí?" }]);
    } finally {
      setSending(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    }
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="close-talk" onPress={() => router.back()} hitSlop={12} style={styles.close}>
          <Ionicons name="chevron-down" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>THE BOOTH</Text>
          <Text style={styles.headerSub}>Rayo & Casey · live</Text>
        </View>
        <View style={styles.headerAvatars}>
          <Image source={RAYO} style={[styles.hAvatar, { borderColor: colors.green, marginRight: -10, zIndex: 2 }]} contentFit="cover" />
          <Image source={CASEY} style={[styles.hAvatar, { borderColor: colors.blue }]} contentFit="cover" />
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="translate-with-padding" keyboardVerticalOffset={0}>
        <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {messages.length === 0 ? <Welcome onPick={send} /> : messages.map((m, i) => <Bubble key={i} msg={m} />)}
          {sending ? <Typing /> : null}
        </ScrollView>

        <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <TextInput
            testID="talk-input"
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Ask the booth about the MASL…"
            placeholderTextColor={colors.textFaint}
            multiline
          />
          <Pressable testID="talk-send" style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnOff]} onPress={() => send(input)} disabled={!input.trim() || sending}>
            <Ionicons name="arrow-up" size={20} color={colors.bg} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function Welcome({ onPick }: { onPick: (t: string) => void }) {
  return (
    <View style={styles.welcome}>
      <View style={styles.avatars}>
        <Image source={RAYO} style={[styles.wAvatar, { borderColor: colors.green, marginRight: -14, zIndex: 2 }]} contentFit="cover" />
        <Image source={CASEY} style={[styles.wAvatar, { borderColor: colors.blue }]} contentFit="cover" />
      </View>
      <Text style={styles.welcomeTitle}>WELCOME TO THE BOOTH</Text>
      <Text style={styles.welcomeText}>
        <Text style={{ color: colors.green }}>Rayo</Text> brings the passion, <Text style={{ color: colors.blue }}>Casey</Text> brings the numbers. Ask them anything about arena soccer and the 2025-26 MASL season.
      </Text>
      <View style={styles.chips}>
        {SUGGESTIONS.map((s) => (
          <Pressable key={s} style={styles.chip} onPress={() => onPick(s)} testID="suggestion-chip">
            <Text style={styles.chipText}>{s}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function Bubble({ msg }: { msg: Msg }) {
  if (msg.role === "user") {
    return (
      <View style={styles.userWrap}>
        <View style={styles.userBubble}><Text style={styles.userText}>{msg.text}</Text></View>
      </View>
    );
  }
  const isRayo = msg.role === "rayo";
  const s = hostStyle[msg.role];
  return (
    <View style={styles.hostWrap}>
      <Image source={isRayo ? RAYO : CASEY} style={[styles.avatar, { borderColor: s.accent }]} contentFit="cover" />
      <View style={{ flex: 1 }}>
        <View style={styles.hostHead}>
          <Text style={[styles.hostName, { color: s.accent }]}>{isRayo ? "RAYO" : "CASEY"}</Text>
          <Text style={styles.hostRole}>{s.label}</Text>
        </View>
        <View style={[styles.hostBubble, { borderLeftColor: s.accent }]}><Text style={styles.hostText}>{msg.text}</Text></View>
      </View>
    </View>
  );
}

function Typing() {
  return (
    <View style={styles.hostWrap}>
      <View style={[styles.avatar, { borderColor: colors.borderStrong, backgroundColor: colors.surfaceAlt }]} />
      <View style={[styles.hostBubble, { borderLeftColor: colors.borderStrong, flexDirection: "row", alignItems: "center", gap: 8 }]}>
        <ActivityIndicator color={colors.green} size="small" />
        <Text style={styles.typing}>The booth is breaking it down…</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  close: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surfaceAlt, alignItems: "center", justifyContent: "center" },
  headerCenter: { flex: 1 },
  headerTitle: { color: colors.text, fontFamily: fonts.display, fontSize: 18, fontWeight: "800", letterSpacing: 1 },
  headerSub: { color: colors.green, fontFamily: fonts.body, fontSize: 11 },
  headerAvatars: { flexDirection: "row", alignItems: "center" },
  hAvatar: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, backgroundColor: colors.surfaceAlt },

  list: { padding: spacing.lg, gap: spacing.lg, flexGrow: 1 },
  welcome: { alignItems: "center", paddingTop: spacing.xl, gap: spacing.md },
  avatars: { flexDirection: "row", alignItems: "center" },
  wAvatar: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, backgroundColor: colors.surfaceAlt },
  welcomeTitle: { color: colors.text, fontFamily: fonts.display, fontSize: 20, fontWeight: "800", letterSpacing: 1, marginTop: spacing.sm },
  welcomeText: { color: colors.textDim, fontFamily: fonts.body, fontSize: 14, lineHeight: 22, textAlign: "center", paddingHorizontal: spacing.md },
  chips: { gap: spacing.sm, marginTop: spacing.md, width: "100%" },
  chip: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  chipText: { color: colors.text, fontFamily: fonts.body, fontSize: 14 },

  userWrap: { alignItems: "flex-end" },
  userBubble: { backgroundColor: colors.surfaceHi, borderRadius: radius.lg, borderBottomRightRadius: 4, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, maxWidth: "82%" },
  userText: { color: colors.text, fontFamily: fonts.body, fontSize: 15, lineHeight: 21 },

  hostWrap: { flexDirection: "row", gap: spacing.sm },
  avatar: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, backgroundColor: colors.surfaceAlt },
  hostHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  hostName: { fontFamily: fonts.display, fontSize: 14, fontWeight: "800", letterSpacing: 0.8 },
  hostRole: { color: colors.textFaint, fontFamily: fonts.accent, fontSize: 9, fontWeight: "600", letterSpacing: 1 },
  hostBubble: { backgroundColor: colors.surface, borderRadius: radius.md, borderBottomLeftRadius: 4, borderLeftWidth: 3, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  hostText: { color: colors.text, fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
  typing: { color: colors.textDim, fontFamily: fonts.body, fontSize: 13, fontStyle: "italic" },

  inputBar: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bgElev },
  input: { flex: 1, color: colors.text, fontFamily: fonts.body, fontSize: 15, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.md, maxHeight: 120 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.green, alignItems: "center", justifyContent: "center" },
  sendBtnOff: { backgroundColor: colors.surfaceHi },
});
