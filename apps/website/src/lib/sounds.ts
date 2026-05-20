// UI sound playback. Three sounds (click, copy, pill) play short Opus
// files; the fourth (tick) is synthesised at runtime via Web Audio so
// it can be sub-millisecond-tight and stays consistent across rapid
// triggers (slider drags fire dozens per second).

// === File-based sounds =====================================================
// Fresh Audio per play so rapid triggers overlap instead of cutting each
// other off. play() rejects under autoplay policy until first interaction
// — swallowed.

const SOUND_FILES = [
  "/click.webm",
  "/copy-success.webm",
  "/pill-select.webm",
  "/compare-enter.webm",
  "/compare-exit.webm",
  "/smoothing-enter.webm",
  "/smoothing-exit.webm",
] as const;

// Eager prefetch at module load. Total ~61 KB across the 7 files;
// small enough to fetch up front without competing with critical path.
// Each `new Audio()` with `preload = "auto"` issues an HTTP fetch and
// populates the browser cache, so the first user interaction plays
// without a cold-cache wait.
for (const src of SOUND_FILES) {
  const a = new Audio(src);
  a.preload = "auto";
}

function playFile(src: string, volume: number) {
  const inst = new Audio(src);
  inst.volume = volume;
  inst.play().catch(() => {});
}

export const playClick = () => playFile("/click.webm", 0.6);
export const playCopySuccess = () => playFile("/copy-success.webm", 0.5);
export const playPillSelect = () => playFile("/pill-select.webm", 0.6);
export const playCompareEnter = () => playFile("/compare-enter.webm", 0.06);
export const playCompareExit = () => playFile("/compare-exit.webm", 0.06);
export const playSmoothingEnter = () => playFile("/smoothing-enter.webm", 0.35);
export const playSmoothingExit = () => playFile("/smoothing-exit.webm", 0.35);

// === Tick (synthesised) ====================================================
// A 5.5 kHz sine partial (exp decay over 12 ms) plus a 3 ms white-noise
// burst rung through a Q=18 bandpass at 5.5 kHz. The resonant filter
// rings like a small rigid object — recipe for a ratchet-pawl / comb-
// tooth click.

const TICK_VOLUME = 0.075;
const TICK_FREQ = 5500;
const TICK_DECAY_SEC = 0.012;
const NOISE_DURATION_SEC = 0.003;
const NOISE_LEVEL = 0.85;
const NOISE_Q = 18;

let ctx: AudioContext | null = null;
function audio() {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

// 0.5 s of pre-generated white noise reused across every fire.
let noiseBuffer: AudioBuffer | null = null;
function getNoise(c: AudioContext) {
  if (noiseBuffer) return noiseBuffer;
  const samples = c.sampleRate * 0.5;
  noiseBuffer = c.createBuffer(1, samples, c.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < samples; i++) data[i] = Math.random() * 2 - 1;
  return noiseBuffer;
}

export function playTick() {
  // Wrapped in try/catch because slider drags call this 100+ times per
  // second on fine-step sliders; if the AudioContext enters a broken
  // state (resource pressure, exotic browser), an unhandled throw on
  // every step crossing would spam the console for the whole drag.
  try {
    const c = audio();
    c.resume().catch(() => {});
    const now = c.currentTime;

    const master = c.createGain();
    master.gain.value = TICK_VOLUME;
    master.connect(c.destination);

    // Sine partial.
    const osc = c.createOscillator();
    osc.type = "sine";
    osc.frequency.value = TICK_FREQ;
    const oscEnv = c.createGain();
    oscEnv.gain.setValueAtTime(1, now);
    oscEnv.gain.exponentialRampToValueAtTime(0.0005, now + TICK_DECAY_SEC);
    osc.connect(oscEnv).connect(master);
    osc.start(now);
    osc.stop(now + TICK_DECAY_SEC + 0.02);

    // Noise burst — rung through a bandpass at the partial's pitch.
    const noise = c.createBufferSource();
    noise.buffer = getNoise(c);
    const nGain = c.createGain();
    nGain.gain.setValueAtTime(NOISE_LEVEL, now);
    nGain.gain.exponentialRampToValueAtTime(0.0005, now + NOISE_DURATION_SEC);
    const filter = c.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = TICK_FREQ;
    filter.Q.value = NOISE_Q;
    noise.connect(nGain).connect(filter).connect(master);
    noise.start(now);
    noise.stop(now + NOISE_DURATION_SEC + 0.01);
  } catch {
    // Audio is non-essential; if the context is broken, drop the tick.
  }
}
