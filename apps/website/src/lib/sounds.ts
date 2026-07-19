// UI sounds. Short Opus files for discrete events (click, copy, pill,
// toggle), a Web Audio synth for the slider tick (sub-millisecond timing,
// fires dozens per second during drags), and a silent looper that keeps
// iOS Safari on the media audio session so the synth ignores the silent
// switch.

// === File-based sounds =====================================================
// Fresh `Audio` per play so rapid triggers overlap instead of cutting each
// other off. play() rejects under autoplay policy until first interaction;
// the rejection is swallowed.

const SOUND_FILES = [
  "/click.webm",
  "/copy-success.webm",
  "/pill-select.webm",
  "/compare-enter.webm",
  "/compare-exit.webm",
  "/smoothing-enter.webm",
  "/smoothing-exit.webm",
  "/silent.webm",
] as const;

// Eager prefetch at module load. SSR guard: Audio is undefined on Node.
if (typeof Audio !== "undefined") {
  for (const src of SOUND_FILES) {
    const a = new Audio(src);
    a.preload = "auto";
  }
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
// 5.5 kHz sine partial (12 ms exp decay) + 3 ms white-noise burst through
// a Q=18 bandpass at 5.5 kHz. The resonant filter rings like a small rigid
// object — ratchet-pawl / comb-tooth click.

const TICK_VOLUME = 0.075;
const TICK_FREQ = 5500;
const TICK_DECAY_SEC = 0.006;
const NOISE_DURATION_SEC = 0.002;
const NOISE_LEVEL = 0.85;
const NOISE_Q = 18;

let ctx: AudioContext | null = null;
function audio() {
  if (!ctx) ctx = new AudioContext({ latencyHint: "interactive" });
  return ctx;
}

// iOS Safari quirks the synth has to navigate, both fixed on first user
// gesture:
//   1. AudioContext starts suspended; the slider tick fires inside a
//      motion listener, well past the gesture's call stack — too
//      late for an in-handler resume() to take effect. Resume + schedule
//      a 1-sample silent buffer here to fully unlock.
//   2. WebAudio defaults to the "ringer" audio session, which the hardware
//      silent switch mutes. `navigator.audioSession.type = "playback"`
//      requests the media session; iOS only honours it while an HTML5
//      audio source is live, so a silent looping `<audio>` keeps the
//      page glued to the media session and the synth rides on it.
if (typeof window !== "undefined") {
  const unlock = () => {
    try {
      const c = audio();
      c.resume().catch(() => {});
      const src = c.createBufferSource();
      src.buffer = c.createBuffer(1, 1, 22050);
      src.connect(c.destination);
      src.start(0);

      const nav = navigator as Navigator & { audioSession?: { type: string } };
      if (nav.audioSession) {
        try { nav.audioSession.type = "playback"; } catch {}
      }

      const silent = new Audio("/silent.webm");
      silent.loop = true;
      silent.setAttribute("playsinline", "");
      silent.volume = 0.0001;
      silent.play().catch(() => {});
    } catch {
      // Let the next gesture retry — don't strip the listeners.
      return;
    }
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);
}

// 0.5 s of pre-generated white noise, reused across every fire.
let noiseBuffer: AudioBuffer | null = null;
function getNoise(c: AudioContext) {
  if (noiseBuffer) return noiseBuffer;
  const samples = c.sampleRate * 0.5;
  noiseBuffer = c.createBuffer(1, samples, c.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < samples; i++) data[i] = Math.random() * 2 - 1;
  return noiseBuffer;
}

// Audio cap at ~25 Hz. Faster than that, the ear stops resolving individual
// clicks and they smear into a buzz. 40 ms gap keeps every tick its own
// event; the matching queue-ahead means at most ~1 tick is ever pending,
// so a release feels sharp even before cancelPendingTicks() runs.
const TICK_MIN_GAP_SEC = 0.04;
const MAX_QUEUE_AHEAD_SEC = 0.04;
let nextTickTime = 0;

interface PendingTick {
  when: number;
  osc: OscillatorNode;
  noise: AudioBufferSourceNode;
}
let pending: PendingTick[] = [];

function scheduleOneTick(c: AudioContext, when: number) {
  const master = c.createGain();
  master.gain.value = TICK_VOLUME;
  master.connect(c.destination);

  const osc = c.createOscillator();
  osc.type = "sine";
  osc.frequency.value = TICK_FREQ;
  const oscEnv = c.createGain();
  oscEnv.gain.setValueAtTime(1, when);
  oscEnv.gain.exponentialRampToValueAtTime(0.0005, when + TICK_DECAY_SEC);
  osc.connect(oscEnv).connect(master);
  osc.start(when);
  osc.stop(when + TICK_DECAY_SEC + 0.02);

  const noise = c.createBufferSource();
  noise.buffer = getNoise(c);
  const nGain = c.createGain();
  nGain.gain.setValueAtTime(NOISE_LEVEL, when);
  nGain.gain.exponentialRampToValueAtTime(0.0005, when + NOISE_DURATION_SEC);
  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = TICK_FREQ;
  filter.Q.value = NOISE_Q;
  noise.connect(nGain).connect(filter).connect(master);
  noise.start(when);
  noise.stop(when + NOISE_DURATION_SEC + 0.01);

  pending.push({ when, osc, noise });
}

// Cancel any tick still in the future. The currently-firing tick (if any)
// keeps its decay — cutting an in-flight click sounds like a glitch. Past
// entries already have a scheduled `.stop()` and will GC themselves once
// the sources finish; we drop their refs here so `pending` doesn't grow
// across drags.
export function cancelPendingTicks() {
  if (!ctx) return;
  const now = ctx.currentTime;
  for (const p of pending) {
    if (p.when > now) {
      try { p.osc.stop(); } catch {}
      try { p.noise.stop(); } catch {}
    }
  }
  pending = [];
  nextTickTime = now;
}

export function playTick() {
  try {
    const c = audio();
    const now = c.currentTime;
    // Schedule into the earliest free slot. If the queue already runs
    // past our look-ahead, drop this tick rather than trailing the cursor.
    const when = Math.max(now, nextTickTime);
    if (when - now > MAX_QUEUE_AHEAD_SEC) return;
    scheduleOneTick(c, when);
    nextTickTime = when + TICK_MIN_GAP_SEC;
  } catch {}
}
