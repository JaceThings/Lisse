// Spawns a new Audio per play so rapid triggers can overlap instead of
// cutting each other off. The first call to each source primes the HTTP
// cache; subsequent plays reuse it. play() rejects under autoplay policy
// until first user interaction — swallowed.

export interface SoundSettings {
  volume: number;
  /** Playback rate; >1 raises pitch + shortens, <1 lowers + lengthens. */
  pitch: number;
}

export type SoundKey = "click" | "copy" | "pill" | "tick";

// Mutable runtime config. The playground dial writes here; defaults
// below are what ships. play() reads on every trigger.
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
