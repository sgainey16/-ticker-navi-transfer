// Web-only audio: pure HTMLAudioElement playback (output only).
// Deliberately does NOT import expo-audio — its web module touches
// navigator.permissions.query({ name: "microphone" }), which throws on
// iOS Safari and crashed the preview. The Ticker only needs TTS playback
// on web, so there is zero recording/microphone dependency here.

// Every element we create is tracked here. Primary tabs stay mounted, so more
// than one TickerDesk can hold a live <audio>; a single pointer is not enough.
// stopAudio() must silence EVERY element to guarantee one audio session.
const live = new Set<HTMLAudioElement>();

function kill(el: HTMLAudioElement) {
  try { el.pause(); el.src = ""; el.load(); } catch {}
  live.delete(el);
}

export function stopAudio() {
  live.forEach(kill);
  live.clear();
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
  stopAudio();
  return new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    try {
      const audio = new Audio(dataUri);
      live.add(audio);
      const cleanup = () => { live.delete(audio); finish(); };
      audio.addEventListener("ended", cleanup, { once: true });
      audio.addEventListener("error", cleanup, { once: true });
      // play() may reject if autoplay is blocked / not user-gesture — fail gracefully.
      const p = audio.play();
      if (p && typeof p.catch === "function") p.catch(() => cleanup());
      setTimeout(cleanup, 25000); // safety
    } catch {
      finish();
    }
  });
}
