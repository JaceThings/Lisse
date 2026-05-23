// Curvature comb generation for the math demo page. Renders a fan of
// whiskers along a sampled curve, each whisker length proportional to
// the unsigned curvature at that sample. The envelope (the curve along
// the whisker tips) is generated independently from all SAMPLE_COUNT
// samples so it stays smooth even when the whisker slider is dialled
// down — or off entirely.

import type { CurveSamples, Pt } from "./curves.ts";

export interface CombWhisker {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Tip position + tangent direction at one sample. */
interface CombTip {
  tip: Pt;
  base: Pt;
}

function computeTip(samples: CurveSamples, pos: number, combScale: number): CombTip {
  const { xs, ys, ks } = samples;
  const N = xs.length;
  const i0 = Math.floor(pos);
  const i1 = Math.min(N - 1, i0 + 1);
  const f = pos - i0;
  const x = xs[i0] + (xs[i1] - xs[i0]) * f;
  const y = ys[i0] + (ys[i1] - ys[i0]) * f;
  const k = ks[i0] + (ks[i1] - ks[i0]) * f;
  // Tangent via centred difference around the nearest integer index.
  const ic = Math.round(pos);
  const iA = Math.max(0, ic - 1);
  const iB = Math.min(N - 1, ic + 1);
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

/**
 * Catmull-Rom-to-cubic Bezier conversion. Takes a polyline of N points
 * and emits an SVG `d` string with N-1 cubic segments that interpolate
 * the points smoothly (C1-continuous, tangent matches between segments).
 */
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
    // Catmull-Rom → cubic Bezier control points (tension = 0.5):
    //   c1 = p1 + (p2 − p0) / 6
    //   c2 = p2 − (p3 − p1) / 6
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${p2[0]} ${p2[1]}`;
  }
  return d;
}

/**
 * Build the curvature comb from a unified samples array.
 *
 * - `whiskerCount` controls how many whiskers are drawn (`0` = none).
 * - The envelope curve is always derived from ALL samples, regardless
 *   of `whiskerCount`, so dialling whiskers down (or off) still leaves
 *   a smooth κ-envelope curve.
 */
export function buildCombFromSamples(
  samples: CurveSamples,
  combScale: number,
  whiskerCount: number,
): { whiskers: CombWhisker[]; envelope: string } {
  const N = samples.xs.length;
  if (N === 0) return { whiskers: [], envelope: "" };

  // Envelope uses every sample — independent of whisker density.
  const envelopeTips: Pt[] = new Array(N);
  for (let i = 0; i < N; i++) {
    envelopeTips[i] = computeTip(samples, i, combScale).tip;
  }
  const envelope = smoothPath(envelopeTips);

  const count = Math.max(0, Math.round(whiskerCount));
  if (count === 0) return { whiskers: [], envelope };

  // Whiskers at evenly-spaced float positions so dragging the density
  // slider adds whiskers one-by-one instead of jumping in chunks.
  const whiskers: CombWhisker[] = new Array(count);
  const denom = count === 1 ? 1 : count - 1;
  for (let j = 0; j < count; j++) {
    const pos = (j * (N - 1)) / denom;
    const { base, tip } = computeTip(samples, pos, combScale);
    whiskers[j] = { x1: base[0], y1: base[1], x2: tip[0], y2: tip[1] };
  }
  return { whiskers, envelope };
}
