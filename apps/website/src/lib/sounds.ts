// Tiny UI-sound helper. A new Audio instance is created per play so rapid
// triggers (e.g. dragging a slider through several integer steps) can
// overlap instead of cutting each other off. The first call to each
// source primes the browser's HTTP cache; subsequent `new Audio(src)`
// calls reuse that cached payload with no extra fetch.
// play() rejects when the user hasn't interacted yet (autoplay policy)
// — swallow that, the sound just doesn't play on the first interaction,
// which is fine.

export interface SoundSettings {
  volume: number;
  /** Playback rate; >1 raises pitch + shortens, <1 lowers + lengthens. */
  pitch: number;
}

export type SoundKey = "click" | "copy" | "pill" | "tick";

// Mutable runtime config. The playground dial writes into this so the
// values change live without re-rendering anywhere. Defaults below are
// what ships; the dial lets you tweak them in dev.
export const soundConfig: Record<SoundKey, SoundSettings> = {
  click: { volume: 0.6, pitch: 1.0 },
  copy: { volume: 0.5, pitch: 1.0 },
  pill: { volume: 0.6, pitch: 1.0 },
  tick: { volume: 0.3, pitch: 2.0 },
};

const sources: Record<SoundKey, string> = {
  click: "/click.webm",
  copy: "/copy-success.webm",
  pill: "/pill-select.webm",
  tick: "/tick.webm",
};

const primed = new Set<string>();

function play(key: SoundKey) {
  if (typeof window === "undefined") return;
  const src = sources[key];
  const { volume, pitch } = soundConfig[key];
  if (!primed.has(src)) {
    const warm = new Audio(src);
    warm.preload = "auto";
    primed.add(src);
  }
  const inst = new Audio(src);
  inst.volume = volume;
  inst.playbackRate = pitch;
  inst.play().catch(() => {});
}

export const playClick = () => play("click");
export const playCopySuccess = () => play("copy");
export const playPillSelect = () => play("pill");
export const playTick = () => play("tick");
