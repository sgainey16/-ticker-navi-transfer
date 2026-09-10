import { Platform } from "react-native";
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";

let current: AudioPlayer | null = null;
let counter = 0;
let modeSet = false;

async function ensureMode() {
  if (modeSet) return;
  try {
    await setAudioModeAsync({ playsInSilentMode: true } as any);
  } catch {}
  modeSet = true;
}

export function stopAudio() {
  try {
    current?.remove();
  } catch {}
  current = null;
}

// --- Global play session: only ONE Reggie+Marc segment can play anywhere. ---
let session = 0;
const subs = new Set<() => void>();
export function beginSession(): number { session += 1; stopAudio(); const tok = session; subs.forEach((f) => f()); return tok; }
export function endSession(): void { session += 1; stopAudio(); subs.forEach((f) => f()); }
export function currentSession(): number { return session; }
export function subscribeSession(cb: () => void): () => void { subs.add(cb); return () => { subs.delete(cb); }; }

// Plays an mp3 data URI and resolves when playback finishes (or times out).
export async function playDataUri(dataUri: string): Promise<void> {
  await ensureMode();
  stopAudio();

  let source: any;
  if (Platform.OS === "web") {
    source = { uri: dataUri };
  } else {
    const base64 = dataUri.split(",")[1] || "";
    const path = `${FileSystem.cacheDirectory}masl-tts-${counter++}.mp3`;
    await FileSystem.writeAsStringAsync(path, base64, { encoding: "base64" as any });
    source = { uri: path };
  }

  return new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    try {
      const player = createAudioPlayer(source);
      current = player;
      const sub = player.addListener("playbackStatusUpdate", (s: any) => {
        if (s?.didJustFinish) {
          try {
            sub?.remove?.();
          } catch {}
          finish();
        }
      });
      player.play();
      setTimeout(finish, 25000); // safety
    } catch {
      finish();
    }
  });
}
