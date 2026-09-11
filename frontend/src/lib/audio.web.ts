// Web-only audio: playback via the Web Audio API so it survives iOS Safari's
// autoplay policy. The desk's reply plays SECONDS after the tap (mic -> STT ->
// LLM -> TTS), by which point a fresh `new Audio().play()` is blocked as
// "not a user gesture". Instead we resume ONE AudioContext inside the tap
// (unlockAudio) and then play decoded buffers on it anytime — that stays allowed.
// Deliberately no expo-audio import (its web module queries mic permission and
// crashed the preview); output only, zero recording dependency here.

let outCtx: AudioContext | null = null;
let curSource: AudioBufferSourceNode | null = null;
let playGen = 0;

// Call from within a user gesture (PLAY / TALK tap) to unlock iOS audio.
export function unlockAudio(): void {
  try {
    if (!outCtx) {
      const C: typeof AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!C) return;
      outCtx = new C();
    }
    if (outCtx.state === "suspended") outCtx.resume().catch(() => {});
    const b = outCtx.createBuffer(1, 1, 22050);
    const s = outCtx.createBufferSource();
    s.buffer = b;
    s.connect(outCtx.destination);
    s.start(0);
  } catch { /* ignore */ }
}

function stopSource() {
  if (curSource) {
    try { curSource.stop(); } catch { /* ignore */ }
    curSource = null;
  }
}

export function stopAudio() {
  playGen += 1;
  stopSource();
}

// --- Global play session: only ONE Reggie+Marc segment can play anywhere. ---
let session = 0;
const subs = new Set<() => void>();
export function beginSession(): number { session += 1; stopAudio(); const tok = session; subs.forEach((f) => f()); return tok; }
export function endSession(): void { session += 1; stopAudio(); subs.forEach((f) => f()); }
export function currentSession(): number { return session; }
export function subscribeSession(cb: () => void): () => void { subs.add(cb); return () => { subs.delete(cb); }; }

async function dataUriToBuffer(dataUri: string): Promise<AudioBuffer> {
  const res = await fetch(dataUri);
  const arr = await res.arrayBuffer();
  return await outCtx!.decodeAudioData(arr);
}

// Plays an mp3 data URI and resolves when playback finishes (or is superseded).
export async function playDataUri(dataUri: string): Promise<void> {
  if (!outCtx) unlockAudio();
  const mine = ++playGen; // claim the play slot

  // Web Audio path (unlockable on iOS). Fall back to <audio> if it fails.
  if (outCtx) {
    try {
      const buf = await dataUriToBuffer(dataUri);
      if (mine !== playGen) return;        // superseded during decode
      return await new Promise<void>((resolve) => {
        let done = false;
        const finish = () => { if (done) return; done = true; resolve(); };
        stopSource();
        const src = outCtx!.createBufferSource();
        src.buffer = buf;
        src.connect(outCtx!.destination);
        src.onended = finish;
        curSource = src;
        try { src.start(0); } catch { finish(); }
        setTimeout(finish, 25000);
      });
    } catch { /* fall through to <audio> */ }
  }

  return new Promise<void>((resolve) => {
    let done = false;
    const finish = () => { if (done) return; done = true; resolve(); };
    try {
      const audio = new Audio(dataUri);
      audio.addEventListener("ended", finish, { once: true });
      audio.addEventListener("error", finish, { once: true });
      const p = audio.play();
      if (p && typeof p.catch === "function") p.catch(() => finish());
      setTimeout(finish, 25000);
    } catch { finish(); }
  });
}
