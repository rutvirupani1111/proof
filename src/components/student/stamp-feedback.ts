"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Verification feedback for the seal stamp: a short haptic pattern where the device supports
 * it, plus an optional WebAudio "thud" (off by default, toggled in student settings and kept
 * in localStorage, per device).
 */
export const STAMP_SOUND_KEY = "proof:stamp-sound";
export const STAMP_VIBRATION: number[] = [12, 40, 18];
const EVENT = "proof:stamp-sound-change";

function readSound(): boolean {
  try {
    return window.localStorage.getItem(STAMP_SOUND_KEY) === "on";
  } catch {
    return false;
  }
}

export function setStampSound(on: boolean) {
  try {
    if (on) window.localStorage.setItem(STAMP_SOUND_KEY, "on");
    else window.localStorage.removeItem(STAMP_SOUND_KEY);
  } catch {
    /* private mode: the toggle just won't persist */
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** [enabled, setEnabled]. `false` on the server and during hydration. */
export function useStampSound(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(subscribe, readSound, () => false);
  return [on, useCallback((v: boolean) => setStampSound(v), [])];
}

let ctx: AudioContext | null = null;

/** A soft rubber-stamp thud: a falling sine body plus a short filtered-noise "paper" tick. */
export function playStampThud(volume = 0.5) {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx ??= new AC();
    if (ctx.state === "suspended") void ctx.resume();
    const t = ctx.currentTime;

    const body = ctx.createOscillator();
    const bodyGain = ctx.createGain();
    body.type = "sine";
    body.frequency.setValueAtTime(150, t);
    body.frequency.exponentialRampToValueAtTime(48, t + 0.16);
    bodyGain.gain.setValueAtTime(0.0001, t);
    bodyGain.gain.exponentialRampToValueAtTime(volume, t + 0.006);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    body.connect(bodyGain).connect(ctx.destination);
    body.start(t);
    body.stop(t + 0.24);

    const len = Math.floor(ctx.sampleRate * 0.05);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
    const noise = ctx.createBufferSource();
    const lp = ctx.createBiquadFilter();
    const noiseGain = ctx.createGain();
    noise.buffer = buf;
    lp.type = "lowpass";
    lp.frequency.value = 1400;
    noiseGain.gain.value = volume * 0.35;
    noise.connect(lp).connect(noiseGain).connect(ctx.destination);
    noise.start(t);
  } catch {
    /* audio is a nicety; never let it break the moment */
  }
}

/** Fire on the frame the seal lands: vibrate where supported, thud if the student opted in. */
export function stampFeedback() {
  if (typeof window === "undefined") return;
  try {
    if (typeof navigator.vibrate === "function") navigator.vibrate(STAMP_VIBRATION);
  } catch {
    /* some browsers throw without a user gesture */
  }
  if (readSound()) playStampThud();
}
