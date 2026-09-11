import { useCallback, useRef, useState } from "react";
import type { VoiceClip } from "@/src/lib/api";

export type PermState = "granted" | "denied" | "undetermined";

// Voice-activity thresholds (normalized RMS 0..1 from the analyser).
const SPEECH_ON = 0.045;   // above this = the fan is talking
const SILENCE_MS = 1100;   // trailing silence that ends an utterance
const NO_SPEECH_MS = 7000; // give up if they never start
const MAX_MS = 15000;      // hard cap on one utterance

/**
 * Web voice recorder with hands-free end-of-speech detection.
 * Uses the browser MediaRecorder + a Web-Audio AnalyserNode for VAD (NOT
 * expo-audio, which queries mic permission on load and crashed Safari).
 * getUserMedia is called ONLY when the desk deliberately opens the mic.
 */
export function useVoiceRecorder() {
  const [permission, setPermission] = useState<PermState>("undetermined");
  const [canAskAgain] = useState(true);
  const [listening, setListening] = useState(false);
  const [level, setLevel] = useState(0);

  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mrRef = useRef<MediaRecorder | null>(null);
  const abortRef = useRef(false);

  const openMic = useCallback(async () => {
    if (streamRef.current && analyserRef.current) return true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;
      const Ctx: typeof AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
      const ctx = new Ctx();
      const src = ctx.createMediaStreamSource(stream);
      const an = ctx.createAnalyser();
      an.fftSize = 1024;
      src.connect(an);
      ctxRef.current = ctx;
      analyserRef.current = an;
      setPermission("granted");
      return true;
    } catch {
      setPermission("denied");
      return false;
    }
  }, []);

  const closeMic = useCallback(() => {
    abortRef.current = true;
    try { mrRef.current?.stop(); } catch { /* ignore */ }
    mrRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    try { ctxRef.current?.close(); } catch { /* ignore */ }
    ctxRef.current = null;
    analyserRef.current = null;
    setListening(false);
    setLevel(0);
  }, []);

  const abort = useCallback(() => {
    abortRef.current = true;
    try { mrRef.current?.stop(); } catch { /* ignore */ }
  }, []);

  const readRms = useCallback(() => {
    const an = analyserRef.current;
    if (!an) return 0;
    const buf = new Uint8Array(an.fftSize);
    an.getByteTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) {
      const v = (buf[i] - 128) / 128;
      sum += v * v;
    }
    return Math.sqrt(sum / buf.length);
  }, []);

  const captureUtterance = useCallback(async (): Promise<VoiceClip | null> => {
    if (!streamRef.current || !analyserRef.current) {
      const ok = await openMic();
      if (!ok) return null;
    }
    abortRef.current = false;

    return new Promise<VoiceClip | null>((resolve) => {
      const stream = streamRef.current!;
      // Pick a container Whisper accepts AND the browser supports (iOS Safari -> mp4).
      const prefer = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg"];
      let picked = "";
      const MR: any = (window as any).MediaRecorder;
      for (const t of prefer) { if (MR?.isTypeSupported?.(t)) { picked = t; break; } }
      const mr = picked ? new MediaRecorder(stream, { mimeType: picked }) : new MediaRecorder(stream);
      mrRef.current = mr;
      const chunks: Blob[] = [];
      let spoke = false;
      let finished = false;
      let lastVoice = Date.now();
      const startTs = Date.now();

      const done = (clip: VoiceClip | null) => {
        if (finished) return;
        finished = true;
        setListening(false);
        setLevel(0);
        resolve(clip);
      };

      mr.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      mr.onstop = () => {
        if (abortRef.current || !spoke) { done(null); return; }
        const type = mr.mimeType || picked || "audio/webm";
        const blob = new Blob(chunks, { type });
        const ext = type.includes("mp4") ? "mp4" : type.includes("ogg") ? "ogg" : "webm";
        done({ uri: "", name: `clip.${ext}`, type, blob });
      };

      try { mr.start(100); } catch { done(null); return; }
      setListening(true);

      const tick = () => {
        if (finished) return;
        if (abortRef.current) { try { mr.stop(); } catch { /* ignore */ } return; }
        const r = readRms();
        setLevel(Math.min(1, r * 6));
        const now = Date.now();
        if (r > SPEECH_ON) { spoke = true; lastVoice = now; }
        const end =
          (spoke && now - lastVoice > SILENCE_MS) ||
          (!spoke && now - startTs > NO_SPEECH_MS) ||
          (now - startTs > MAX_MS);
        if (end) { try { mr.stop(); } catch { /* ignore */ } return; }
        setTimeout(tick, 80);
      };
      setTimeout(tick, 80);
    });
  }, [openMic, readRms]);

  return { permission, canAskAgain, listening, level, openMic, closeMic, captureUtterance, abort };
}
