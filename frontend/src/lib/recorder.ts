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

/**
 * Native voice recorder (expo-audio). Microphone is requested ONLY when the fan
 * deliberately taps to talk — never on mount — and permission state is surfaced
 * so the UI can offer an Open-Settings path when blocked.
 */
export function useVoiceRecorder() {
  const rec = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recording, setRecording] = useState(false);
  const [permission, setPermission] = useState<PermState>("undetermined");
  const [canAskAgain, setCanAskAgain] = useState(true);
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

  const start = useCallback(async () => {
    const ok = await ensurePerm();
    if (!ok) return false;
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await rec.prepareToRecordAsync();
      rec.record();
      activeRef.current = true;
      setRecording(true);
      return true;
    } catch {
      setRecording(false);
      return false;
    }
  }, [rec, ensurePerm]);

  const stop = useCallback(async (): Promise<VoiceClip | null> => {
    if (!activeRef.current) return null;
    activeRef.current = false;
    setRecording(false);
    try {
      await rec.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      const uri = rec.uri;
      if (!uri) return null;
      return { uri, name: "clip.m4a", type: "audio/mp4" };
    } catch {
      return null;
    }
  }, [rec]);

  const cancel = useCallback(() => {
    if (!activeRef.current) return;
    activeRef.current = false;
    setRecording(false);
    try { rec.stop(); } catch { /* ignore */ }
  }, [rec]);

  return { recording, permission, canAskAgain, start, stop, cancel };
}
