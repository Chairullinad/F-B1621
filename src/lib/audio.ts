"use client";

export interface AudioToneStep {
  freq: number;
  delaySec: number;
  durationSec: number;
}

let sharedAudioContext: AudioContext | null = null;

function getSharedAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;

  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtx) return null;

  if (!sharedAudioContext || sharedAudioContext.state === "closed") {
    sharedAudioContext = new AudioCtx();
  }

  if (sharedAudioContext.state === "suspended") {
    sharedAudioContext.resume().catch(() => {
      // Abaikan bila browser memblokir audio sebelum ada interaksi pengguna
    });
  }

  return sharedAudioContext;
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

    const ctx = getSharedAudioContext();
    if (!ctx) return;

    const baseTime = ctx.currentTime + 0.01;
    const oscType = options?.type ?? "sine";
    const peakGain = options?.gain ?? 0.22;

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
  } catch {
    // Abaikan jika browser belum mengizinkan audio otomatis
  }
}
