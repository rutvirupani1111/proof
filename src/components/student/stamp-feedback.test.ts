import { afterEach, describe, expect, it, vi } from "vitest";
import { STAMP_SOUND_KEY, setStampSound, stampFeedback } from "./stamp-feedback";

function fakeWindow() {
  const store = new Map<string, string>();
  const created: string[] = [];
  const node = () => ({ connect: (n: unknown) => n, start: () => {}, stop: () => {} });
  class FakeAudio {
    state = "running";
    currentTime = 0;
    sampleRate = 8000;
    destination = {};
    createOscillator() {
      created.push("osc");
      return { ...node(), type: "", frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} } };
    }
    createGain() {
      return { ...node(), gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} } };
    }
    createBuffer(_c: number, len: number) {
      return { getChannelData: () => new Float32Array(len) };
    }
    createBufferSource() {
      created.push("noise");
      return { ...node(), buffer: null };
    }
    createBiquadFilter() {
      return { ...node(), type: "", frequency: { value: 0 } };
    }
    resume() {}
  }
  const win = {
    localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) },
    dispatchEvent: () => true,
    AudioContext: FakeAudio,
  };
  return { win, store, created };
}

afterEach(() => vi.unstubAllGlobals());

describe("stampFeedback", () => {
  it("vibrates [12, 40, 18] and stays silent by default", () => {
    const { win, created } = fakeWindow();
    const vibrate = vi.fn();
    vi.stubGlobal("window", win);
    vi.stubGlobal("navigator", { vibrate });
    stampFeedback();
    expect(vibrate).toHaveBeenCalledWith([12, 40, 18]);
    expect(created).toEqual([]);
  });

  it("plays the thud once the student turns the sound on", () => {
    const { win, store, created } = fakeWindow();
    vi.stubGlobal("window", win);
    vi.stubGlobal("navigator", {});
    setStampSound(true);
    expect(store.get(STAMP_SOUND_KEY)).toBe("on");
    stampFeedback();
    expect(created).toEqual(["osc", "noise"]);
    setStampSound(false);
    expect(store.has(STAMP_SOUND_KEY)).toBe(false);
  });
});
