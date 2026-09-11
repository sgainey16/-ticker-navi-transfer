import { useCallback, useRef, useState } from "react";
import type { VoiceClip } from "@/src/lib/api";

export type PermState = "granted" | "denied" | "undetermined";

/**
 * Web voice recorder — uses the browser MediaRecorder directly (NOT expo-audio's
 * web recording path, which queries mic permission on load and crashed Safari).
 * getUserMedia is called ONLY when the fan deliberately taps to talk.
 */
export function useVoiceRecorder() {
  const [recording, setRecording] = useState(false);
  const [permission, setPermission] = useState<PermState>("undetermined");
  const [canAskAgain] = useState(true);
  const mrRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const teardown = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    mrRef.current = null;
  }, []);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setPermission("granted");
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data && e.data.size) chunksRef.current.push(e.data); };
      mr.start();
      mrRef.current = mr;
      setRecording(true);
      return true;
    } catch {
      setPermission("denied");
      teardown();
      setRecording(false);
      return false;
    }
  }, [teardown]);

  const stop = useCallback((): Promise<VoiceClip | null> => {
    return new Promise((resolve) => {
      const mr = mrRef.current;
      if (!mr) { setRecording(false); resolve(null); return; }
      mr.onstop = () => {
        const type = mr.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        teardown();
        setRecording(false);
        const ext = type.includes("mp4") ? "mp4" : type.includes("ogg") ? "ogg" : "webm";
        resolve({ uri: "", name: `clip.${ext}`, type, blob });
      };
      try { mr.stop(); } catch { setRecording(false); resolve(null); }
    });
  }, [teardown]);

  const cancel = useCallback(() => {
    const mr = mrRef.current;
    if (mr) { mr.onstop = null; try { mr.stop(); } catch { /* ignore */ } }
    teardown();
    setRecording(false);
  }, [teardown]);

  return { recording, permission, canAskAgain, start, stop, cancel };
}
