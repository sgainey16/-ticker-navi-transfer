"""
SEC-001 — Server-side budget controls for paid AI surfaces.

Best Ticker Now has NO user accounts, so we deliberately avoid any hardcoded
client/app secret (it would be extractable from the shipped frontend). Instead
we protect the paid provider endpoints purely at the backend:

  1. Per-IP rate limiting (separate limits per expensive endpoint).
  2. Hard request-size caps (text length + audio byte size).
  3. Bounded concurrency + timeouts around Claude / ElevenLabs / Whisper.

Everything here is in-process and dependency-free. Ordinary public hockey
browsing/data endpoints are intentionally NOT touched.
"""
import asyncio
import time
from collections import defaultdict, deque

from fastapi import Request, HTTPException

# ---------------------------------------------------------------------------
# Size caps (reject BEFORE any provider call / full in-memory read)
# ---------------------------------------------------------------------------
MAX_TALK_TEXT = 2000        # chars — a fan message to the booth
MAX_TTS_TEXT = 1200         # chars — one spoken line
MAX_CONVERSE_TEXT = 2000    # chars — typed input to the live desk
MAX_AUDIO_BYTES = 10 * 1024 * 1024   # 10 MB — short voice clips only

# ---------------------------------------------------------------------------
# Provider timeouts (seconds) — a hung upstream must not pin a slot forever
# ---------------------------------------------------------------------------
LLM_TIMEOUT = 45      # Claude text
TTS_TIMEOUT = 45      # ElevenLabs synth
DESIGN_TIMEOUT = 60   # ElevenLabs voice design (heavier)
STT_TIMEOUT = 45      # Whisper transcription

# ---------------------------------------------------------------------------
# Bounded concurrency — a traffic spike cannot create unlimited simultaneous
# paid requests. If no slot frees up quickly we shed load with a clean 503
# rather than queueing (and paying) forever. Slots always release via `async with`.
# ---------------------------------------------------------------------------
LLM_SEM = asyncio.Semaphore(4)
TTS_SEM = asyncio.Semaphore(4)
DESIGN_SEM = asyncio.Semaphore(1)
STT_SEM = asyncio.Semaphore(3)

_SLOT_WAIT = 8.0  # seconds to wait for a free concurrency slot before 503


class _Slot:
    """Acquire a semaphore with a bounded wait; 503 if the desk is saturated."""

    def __init__(self, sem: asyncio.Semaphore):
        self._sem = sem
        self._held = False

    async def __aenter__(self):
        try:
            await asyncio.wait_for(self._sem.acquire(), timeout=_SLOT_WAIT)
            self._held = True
        except asyncio.TimeoutError:
            raise HTTPException(
                status_code=503,
                detail="The booth is busy right now. Please try again in a moment.",
            )
        return self

    async def __aexit__(self, exc_type, exc, tb):
        if self._held:
            self._sem.release()
            self._held = False
        return False


def slot(sem: asyncio.Semaphore) -> _Slot:
    return _Slot(sem)


async def run_provider(coro_or_thread, timeout: float, label: str):
    """Await a provider call with a hard timeout. Raises 504 on timeout so the
    caller's concurrency slot (held via `async with slot(...)`) is released
    cleanly on the way out."""
    try:
        return await asyncio.wait_for(coro_or_thread, timeout=timeout)
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail=f"{label} timed out. Please try again.")


# ---------------------------------------------------------------------------
# Per-IP rate limiting (sliding window). In-process; resets on restart, which
# is fine for a single-pod Friends & Family deployment.
# ---------------------------------------------------------------------------
def client_ip(request: Request) -> str:
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


class _SlidingWindow:
    def __init__(self):
        self._hits: dict = defaultdict(deque)

    def allow(self, key: str, max_calls: int, window: float) -> bool:
        now = time.monotonic()
        dq = self._hits[key]
        cutoff = now - window
        while dq and dq[0] < cutoff:
            dq.popleft()
        if len(dq) >= max_calls:
            return False
        dq.append(now)
        return True


_window = _SlidingWindow()


def rate_limit(bucket: str, max_calls: int, window: float = 60.0):
    """FastAPI dependency: per-IP limit for one paid endpoint bucket."""
    async def _dep(request: Request):
        key = f"{bucket}:{client_ip(request)}"
        if not _window.allow(key, max_calls, window):
            raise HTTPException(
                status_code=429,
                detail="Too many requests. Please slow down and try again shortly.",
            )
    return _dep
