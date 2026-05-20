// UI sound playback. Three sounds (click, copy, pill) play short Opus
// files; the fourth (tick) is synthesised at runtime via Web Audio so
// it can be sub-millisecond-tight and stays consistent across rapid
// triggers (slider drags fire dozens per second).

// === File-based sounds =====================================================
// Spawns a new Audio per play so rapid triggers can overlap instead of
// cutting each other off. The first call to each source primes the HTTP
// cache; subsequent plays reuse it. play() rejects under autoplay policy
// until first user interaction — swallowed.

const primed = new Set<string>();

function playFile(src: string, volume: number) {
  if (!primed.has(src)) {
    const warm = new Audio(src);
    warm.preload = "auto";
    primed.add(src);
  }
  const inst = new Audio(src);
  inst.volume = volume;
  inst.play().catch(() => {});
}

export const playClick = () => playFile("/click.webm", 0.6);
export const playCopySuccess = () => playFile("/copy-success.webm", 0.5);
export const playPillSelect = () => playFile("/pill-select.webm", 0.6);

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
  const c = audio();
  c.resume().catch(() => {});
  const now = c.currentTime;

  const master = c.createGain();
  master.gain.value = TICK_VOLUME;
  master.connect(c.destination);

  // Sine partial — 5.5 kHz, exp decay over 12 ms.
  const osc = c.createOscillator();
  osc.type = "sine";
  osc.frequency.value = TICK_FREQ;
  const oscEnv = c.createGain();
  oscEnv.gain.setValueAtTime(1, now);
  oscEnv.gain.exponentialRampToValueAtTime(0.0005, now + TICK_DECAY_SEC);
  osc.connect(oscEnv).connect(master);
  osc.start(now);
  osc.stop(now + TICK_DECAY_SEC + 0.02);

  // Noise burst — 3 ms, exp-faded, rung through a high-Q bandpass at
  // the same 5.5 kHz so it tracks the sine partial's pitch.
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
}
