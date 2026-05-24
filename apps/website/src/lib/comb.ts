// Curvature comb generation for the math demo page. Renders a fan of
// whiskers along a sampled curve, each whisker length proportional to
// the unsigned curvature at that sample. The envelope (the curve along
// the whisker tips) is rendered as a smooth cubic Bézier independent of
// whisker count, so dialling whiskers down to 0 still leaves a clean
// κ-profile curve.

import type { CurveSamples, Pt } from "./curves.ts";

export interface CombWhisker {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Tip position + base anchor at one sample. */
interface CombTip {
  tip: Pt;
  base: Pt;
}

/**
 * Compute the whisker tip at `pos` (a float sample index, allowing
 * sub-sample positioning for the smooth density slider).
 *
 * `tangentStencil` controls how many samples wide the centred-difference
 * tangent reaches. The default ±1 is sharp at the source (sample-spaced
 * detail) — fine for individual whiskers — but it picks up the
 * linear-interpolation noise that `resampleByArcLength` leaves between
 * adjacent dense-segment boundaries. The envelope path therefore uses a
 * much wider stencil (~±5) so its tangent estimates average the noise
 * out across ~10 sample units; the cubic Bézier path through the
 * resulting tips then reads as one smooth curve.
 */
function computeTip(
  samples: CurveSamples,
  pos: number,
  combScale: number,
  tangentStencil: number,
): CombTip {
  const { xs, ys, ks } = samples;
  const N = xs.length;
  const i0 = Math.floor(pos);
  const i1 = Math.min(N - 1, i0 + 1);
  const f = pos - i0;
  const x = xs[i0] + (xs[i1] - xs[i0]) * f;
  const y = ys[i0] + (ys[i1] - ys[i0]) * f;
  const k = ks[i0] + (ks[i1] - ks[i0]) * f;
  const ic = Math.round(pos);
  const iA = Math.max(0, ic - tangentStencil);
  const iB = Math.min(N - 1, ic + tangentStencil);
  const tx = xs[iB] - xs[iA];
  const ty = ys[iB] - ys[iA];
  const m = Math.hypot(tx, ty) || 1;
  // Inward normal: rotate the unit tangent by 90° in screen coords.
  const ix = -ty / m;
  const iy = tx / m;
  const len = k * combScale;
  return {
    base: [x, y],
    tip: [x - ix * len, y - iy * len],
  };
}

/** Catmull-Rom-to-cubic Bézier conversion (tension 0.5 / centripetal).
 *  C1-continuous; relies on the input being smooth — feed it widely-
 *  spaced points to avoid amplifying high-frequency input noise. */
function smoothPath(points: ReadonlyArray<Pt>): string {
  if (points.length === 0) return "";
  if (points.length === 1) {
    return `M ${points[0][0]} ${points[0][1]}`;
  }
  let d = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${p2[0]} ${p2[1]}`;
  }
  return d;
}

// Envelope is sampled at this many widely-spaced tips, then cubic-Bézier
// interpolated through them. Fewer-but-wider tips averages out the
// linear-interp noise in the sampled-curve representation; the cubic
// fills in between cleanly.
const ENVELOPE_TIP_COUNT = 60;
const ENVELOPE_TANGENT_STENCIL = 5;

/**
 * Build the curvature comb from a unified samples array.
 *
 * - `whiskerCount` controls how many whiskers are drawn (`0` = none).
 * - The envelope is always built from a fixed `ENVELOPE_TIP_COUNT`
 *   widely-spaced tips with a noise-suppressing tangent stencil, so
 *   dialling whiskers down (or off) still leaves a clean curve.
 */
export function buildCombFromSamples(
  samples: CurveSamples,
  combScale: number,
  whiskerCount: number,
): { whiskers: CombWhisker[]; envelope: string } {
  const N = samples.xs.length;
  if (N === 0) return { whiskers: [], envelope: "" };

  const envelopeTips: Pt[] = new Array(ENVELOPE_TIP_COUNT);
  for (let j = 0; j < ENVELOPE_TIP_COUNT; j++) {
    const pos = (j * (N - 1)) / (ENVELOPE_TIP_COUNT - 1);
    envelopeTips[j] = computeTip(samples, pos, combScale, ENVELOPE_TANGENT_STENCIL).tip;
  }
  const envelope = smoothPath(envelopeTips);

  const count = Math.max(0, Math.round(whiskerCount));
  if (count === 0) return { whiskers: [], envelope };

  // Whiskers stay at the sharp ±1 stencil — each whisker is a discrete
  // glyph at its own sample, not a smoothing pass.
  const whiskers: CombWhisker[] = new Array(count);
  const denom = count === 1 ? 1 : count - 1;
  for (let j = 0; j < count; j++) {
    const pos = (j * (N - 1)) / denom;
    const { base, tip } = computeTip(samples, pos, combScale, 1);
    whiskers[j] = { x1: base[0], y1: base[1], x2: tip[0], y2: tip[1] };
  }
  return { whiskers, envelope };
}
