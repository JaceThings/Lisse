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

// Eager prefetch at module load (~62 KB total). `preload = "auto"` issues
// an HTTP fetch and populates the browser cache so the first user
// interaction plays without a cold-cache wait.
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
// 5.5 kHz sine partial (12 ms exp decay) + 3 ms white-noise burst through
// a Q=18 bandpass at 5.5 kHz. The resonant filter rings like a small rigid
// object — ratchet-pawl / comb-tooth click.

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

// iOS Safari quirks the synth has to navigate, both fixed on first user
// gesture:
//   1. AudioContext starts suspended; the slider tick fires inside a
//      framer-motion listener, well past the gesture's call stack — too
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
    } catch {}
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

// Wrapped in try/catch: fine-step slider drags call this 100+/sec; a
// throw on a broken AudioContext would spam the console for the whole
// drag. Audio is non-essential — drop the tick.
export function playTick() {
  try {
    const c = audio();
    c.resume().catch(() => {});
    const now = c.currentTime;

    const master = c.createGain();
    master.gain.value = TICK_VOLUME;
    master.connect(c.destination);

    const osc = c.createOscillator();
    osc.type = "sine";
    osc.frequency.value = TICK_FREQ;
    const oscEnv = c.createGain();
    oscEnv.gain.setValueAtTime(1, now);
    oscEnv.gain.exponentialRampToValueAtTime(0.0005, now + TICK_DECAY_SEC);
    osc.connect(oscEnv).connect(master);
    osc.start(now);
    osc.stop(now + TICK_DECAY_SEC + 0.02);

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
  } catch {}
}
