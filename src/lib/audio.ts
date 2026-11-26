"use client";

export interface AudioToneStep {
  freq: number;
  delaySec: number;
  durationSec: number;
}

let sharedAudioContext: AudioContext | null = null;
const unlockListeners = new Set<(unlocked: boolean) => void>();

function notifyAudioUnlockState() {
  const unlocked = isAudioContextUnlocked();
  for (const listener of unlockListeners) {
    listener(unlocked);
  }
}

function getOrCreateAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;

  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtx) return null;

  if (!sharedAudioContext || sharedAudioContext.state === "closed") {
    sharedAudioContext = new AudioCtx();
    sharedAudioContext.addEventListener?.("statechange", notifyAudioUnlockState);
  }

  return sharedAudioContext;
}

export function isAudioContextUnlocked(): boolean {
  return sharedAudioContext?.state === "running";
}

export function subscribeAudioUnlockState(
  listener: (unlocked: boolean) => void
): () => void {
  unlockListeners.add(listener);
  listener(isAudioContextUnlocked());
  return () => {
    unlockListeners.delete(listener);
  };
}

/**
 * Mengaktifkan AudioContext secara eksplisit pada interaksi pengguna
 * agar bunyi beep order masuk tidak terblokir kebijakan autoplay browser.
 */
export async function unlockAudioContext(): Promise<boolean> {
  try {
    const ctx = getOrCreateAudioContext();
    if (!ctx) return false;
    if (ctx.state === "suspended") {
      await ctx.resume();
    }
    notifyAudioUnlockState();
    return ctx.state === "running";
  } catch {
    return false;
  }
}

function scheduleTones(
  ctx: AudioContext,
  steps: ReadonlyArray<AudioToneStep>,
  oscType: OscillatorType,
  peakGain: number
) {
  const baseTime = ctx.currentTime + 0.01;
  for (const step of steps) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const startAt = baseTime + step.delaySec;
    const stopAt = startAt + step.durationSec;

    osc.type = oscType;
    osc.frequency.setValueAtTime(step.freq, startAt);

    gain.gain.setValueAtTime(peakGain, startAt);
    gain.gain.exponentialRampToValueAtTime(0.001, stopAt);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startAt);
    osc.stop(stopAt);
  }
}

/**
 * Memainkan urutan nada notifikasi menggunakan satu instance AudioContext
 * agar tidak terjadi kebocoran konteks audio pada tab browser yang aktif lama.
 */
export function playToneSequence(
  steps: ReadonlyArray<AudioToneStep>,
  options?: {
    type?: OscillatorType;
    gain?: number;
    vibratePattern?: number[];
  }
): void {
  try {
    if (
      options?.vibratePattern &&
      typeof navigator !== "undefined" &&
      "vibrate" in navigator
    ) {
      navigator.vibrate(options.vibratePattern);
    }

    const ctx = getOrCreateAudioContext();
    if (!ctx) return;

    const oscType = options?.type ?? "sine";
    const peakGain = options?.gain ?? 0.22;

    if (ctx.state === "suspended") {
      void ctx
        .resume()
        .then(() => {
          notifyAudioUnlockState();
          if (ctx.state === "running") {
            scheduleTones(ctx, steps, oscType, peakGain);
          }
        })
        .catch(() => {
          // Menunggu interaksi pengguna untuk membuka kunci audio browser
        });
      return;
    }

    scheduleTones(ctx, steps, oscType, peakGain);
  } catch {
    // Abaikan jika browser belum mengizinkan audio otomatis
  }
}
