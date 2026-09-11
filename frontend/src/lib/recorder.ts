import { useCallback, useRef, useState } from "react";
import {
  useAudioRecorder,
  RecordingPresets,
  setAudioModeAsync,
  requestRecordingPermissionsAsync,
  getRecordingPermissionsAsync,
} from "expo-audio";
import type { VoiceClip } from "@/src/lib/api";

export type PermState = "granted" | "denied" | "undetermined";

// Metering is in dBFS (~-160 silent .. 0 loud).
const SPEECH_DB = -35;
const SILENCE_DB = -45;
const SILENCE_MS = 1100;
const NO_SPEECH_MS = 7000;
const MAX_MS = 15000;
const POLL_MS = 120;

/**
 * Native voice recorder (expo-audio) with hands-free end-of-speech detection via
 * live metering. Microphone is requested ONLY when the desk deliberately opens it.
 */
export function useVoiceRecorder() {
  const rec = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const [permission, setPermission] = useState<PermState>("undetermined");
  const [canAskAgain, setCanAskAgain] = useState(true);
  const [listening, setListening] = useState(false);
  const [level, setLevel] = useState(0);
  const abortRef = useRef(false);
  const activeRef = useRef(false);

  const ensurePerm = useCallback(async () => {
    const cur = await getRecordingPermissionsAsync();
    if (cur.granted) { setPermission("granted"); return true; }
    if (cur.canAskAgain) {
      const res = await requestRecordingPermissionsAsync();
      setPermission(res.granted ? "granted" : "denied");
      setCanAskAgain(res.canAskAgain);
      return res.granted;
    }
    setPermission("denied"); setCanAskAgain(false); return false;
  }, []);

  const openMic = useCallback(async () => {
    const ok = await ensurePerm();
    if (!ok) return false;
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    return true;
  }, [ensurePerm]);

  const closeMic = useCallback(() => {
    abortRef.current = true;
    if (activeRef.current) { try { rec.stop(); } catch { /* ignore */ } activeRef.current = false; }
    setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
    setListening(false);
    setLevel(0);
  }, [rec]);

  const abort = useCallback(() => {
    abortRef.current = true;
    if (activeRef.current) { try { rec.stop(); } catch { /* ignore */ } }
  }, [rec]);

  const captureUtterance = useCallback(async (): Promise<VoiceClip | null> => {
    const ok = await openMic();
    if (!ok) return null;
    abortRef.current = false;
    try {
      await rec.prepareToRecordAsync();
      rec.record();
    } catch {
      return null;
    }
    activeRef.current = true;
    setListening(true);

    let spoke = false;
    let lastVoice = Date.now();
    const startTs = Date.now();

    await new Promise<void>((resolve) => {
      const poll = () => {
        if (abortRef.current) { resolve(); return; }
        let m = -160;
        try { m = (rec.getStatus()?.metering ?? -160) as number; } catch { /* ignore */ }
        setLevel(Math.max(0, Math.min(1, (m + 60) / 60)));
        const now = Date.now();
        if (m > SPEECH_DB) { spoke = true; lastVoice = now; }
        const end =
          (spoke && m < SILENCE_DB && now - lastVoice > SILENCE_MS) ||
          (!spoke && now - startTs > NO_SPEECH_MS) ||
          (now - startTs > MAX_MS);
        if (end) { resolve(); return; }
        setTimeout(poll, POLL_MS);
      };
      setTimeout(poll, POLL_MS);
    });

    activeRef.current = false;
    setListening(false);
    setLevel(0);
    try {
      await rec.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    } catch { /* ignore */ }
    if (abortRef.current || !spoke) return null;
    const uri = rec.uri;
    if (!uri) return null;
    return { uri, name: "clip.m4a", type: "audio/mp4" };
  }, [rec, openMic]);

  return { permission, canAskAgain, listening, level, openMic, closeMic, captureUtterance, abort };
}
