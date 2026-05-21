// Matches the preview-square's state-change tween so a preset click reads
// as a single beat: preview, fill bar, and readout settle together.
export const PROP_CHANGE_DURATION = 0.35;
export const PROP_CHANGE_EASE: [number, number, number, number] = [0.32, 0.72, 0, 1];

// Duration mirrors the prop-change tween so digits finish morphing as
// the fill bar settles.
export const READOUT_TRANSITION = { duration: 300 };

export const CLICK_THRESHOLD = 3;

// Snap-between-steps ease. circOut accelerates from rest then settles — the
// fill bar reads as a magnetic snap to the next integer, and the audio tick
// lands inside the deceleration so any output-buffer latency hides under
// motion rather than against a frozen bar.
export const STEP_SNAP_DURATION = 0.08;
export const STEP_SNAP_EASE: [number, number, number, number] = [0.0, 0.55, 0.45, 1.0];

export const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));

export const snap = (n: number, step: number) =>
  step > 0 ? Math.round(n / step) * step : n;

// Widest legal display in characters, so the readout column can reserve
// a stable width. Without this, a 2→3-digit transition (e.g. 99→100) or
// a NumericText mid-morph width fluctuation reflows the row's flex layout
// and tugs the label sideways — visible on narrow grid cells, not on
// full-width single sliders.
export const reservedChars = (
  min: number,
  max: number,
  step: number,
  format?: (n: number) => string,
  sampleValues?: readonly number[],
): number => {
  const sample = (n: number): string => {
    if (format) return format(n);
    const stepStr = String(step);
    const decimals = stepStr.includes(".") ? stepStr.split(".")[1].length : 0;
    return decimals > 0 ? n.toFixed(decimals) : String(n);
  };
  // Extra samples cover formatted strings (e.g. "iOS – 0.60") whose width
  // can exceed both endpoints.
  const lengths = [sample(min).length, sample(max).length];
  if (sampleValues) for (const v of sampleValues) lengths.push(sample(v).length);
  return Math.max(...lengths);
};

export const prefersReducedMotion = (): boolean =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
