// UI sound playback. Three sounds (click, copy, pill) play short Opus
// files; the fourth (tick) is synthesised at runtime via Web Audio so
// it can be sub-millisecond-tight and matches the exact spec the user
// dialled in via the dev sound demo.

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
// Modal-synthesis tick: a single 5.5 kHz sine partial rung by a 3 ms
// noise burst through a high-Q bandpass at 5.5 kHz. Same recipe as a
// ratchet pawl / comb-tooth — short, sharp, metallic. Parameters were
// picked from the /sounds-demo dial; baking them at runtime avoids the
// Opus encoding drift that the offline .webm approach kept introducing.

interface TickSpec {
  fundamental: number;
  partials: number;
  inharmonicity: number;
  partialTaper: number;
  attackMs: number;
  decayMs: number;
  noiseLevel: number;
  noiseDurationMs: number;
  noiseFilter: "off" | "lowpass" | "highpass" | "bandpass";
  noiseCutoff: number;
  noiseQ: number;
  drive: number;
  volume: number;
}

const TICK: TickSpec = {
  fundamental: 5500,
  partials: 1,
  inharmonicity: 0,
  partialTaper: 0.9,
  attackMs: 0,
  decayMs: 12,
  noiseLevel: 0.85,
  noiseDurationMs: 3,
  noiseFilter: "bandpass",
  noiseCutoff: 5500,
  noiseQ: 18,
  drive: 0,
  volume: 0.075,
};

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

function makeDriveCurve(amount: number) {
  const k = 1 + amount * 30;
  const norm = Math.tanh(k);
  const curve = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) {
    const x = (i / 1023) * 2 - 1;
    curve[i] = Math.tanh(k * x) / norm;
  }
  return curve;
}

export function playTick() {
  const p = TICK;
  const c = audio();
  c.resume().catch(() => {});
  const now = c.currentTime;

  const master = c.createGain();
  master.gain.value = p.volume;
  let busIn: AudioNode = master;
  if (p.drive > 0) {
    const shaper = c.createWaveShaper();
    shaper.curve = makeDriveCurve(p.drive);
    shaper.connect(master);
    busIn = shaper;
  }
  master.connect(c.destination);

  // Modal partials. Each at fundamental × idx × (1 + inharmonicity × (idx-1));
  // higher partials decay faster per partialTaper.
  for (let i = 0; i < p.partials; i++) {
    const idx = i + 1;
    const ratio = idx * (1 + p.inharmonicity * i);
    const freq = p.fundamental * ratio;
    const decaySec =
      (p.decayMs / 1000) * Math.max(0.05, 1 - p.partialTaper * i * 0.35);
    const attackSec = p.attackMs / 1000;
    const totalSec = attackSec + decaySec;
    const level = 1 / Math.sqrt(idx);

    const osc = c.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    const env = c.createGain();
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(level, now + attackSec);
    env.gain.exponentialRampToValueAtTime(0.0005, now + totalSec);
    osc.connect(env).connect(busIn);
    osc.start(now);
    osc.stop(now + totalSec + 0.02);
  }

  // Noise excitation — short burst through the resonant filter.
  if (p.noiseLevel > 0 && p.noiseDurationMs > 0) {
    const noise = c.createBufferSource();
    noise.buffer = getNoise(c);
    const noiseSec = p.noiseDurationMs / 1000;
    const nGain = c.createGain();
    nGain.gain.setValueAtTime(p.noiseLevel, now);
    nGain.gain.exponentialRampToValueAtTime(0.0005, now + noiseSec);
    let tail: AudioNode = nGain;
    if (p.noiseFilter !== "off") {
      const filter = c.createBiquadFilter();
      filter.type = p.noiseFilter;
      filter.frequency.value = p.noiseCutoff;
      filter.Q.value = p.noiseQ;
      nGain.connect(filter);
      tail = filter;
    }
    tail.connect(busIn);
    noise.connect(nGain);
    noise.start(now);
    noise.stop(now + noiseSec + 0.01);
  }
}
