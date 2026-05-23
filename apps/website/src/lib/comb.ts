// Curvature comb generation for the math demo page. Renders a fan of
// whiskers along a sampled curve, each whisker length proportional to
// the unsigned curvature at that sample.

import type { CurveSamples, Pt } from "./curves.ts";

export interface CombWhisker {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Build the curvature comb from a unified samples array. `density` is
 * the exact number of whiskers; each whisker lives at a float sample
 * position `j · (N−1) / (density−1)` lerped between integer samples,
 * so dragging the slider adds whiskers one-by-one instead of jumping.
 */
export function buildCombFromSamples(
  samples: CurveSamples,
  combScale: number,
  density: number,
): { whiskers: CombWhisker[]; envelope: string } {
  const { xs, ys, ks } = samples;
  const N = xs.length;
  const count = Math.max(2, Math.round(density));
  const whiskers: CombWhisker[] = [];
  const tips: Pt[] = [];
  for (let j = 0; j < count; j++) {
    const pos = (j * (N - 1)) / (count - 1);
    const i0 = Math.floor(pos);
    const i1 = Math.min(N - 1, i0 + 1);
    const f = pos - i0;
    const x = xs[i0] + (xs[i1] - xs[i0]) * f;
    const y = ys[i0] + (ys[i1] - ys[i0]) * f;
    const k = ks[i0] + (ks[i1] - ks[i0]) * f;
    // Tangent via centred difference around the nearest integer
    // index — lerping the tangent is unnecessary at this density.
    const ic = Math.round(pos);
    const iA = Math.max(0, ic - 1);
    const iB = Math.min(N - 1, ic + 1);
    const tx = xs[iB] - xs[iA];
    const ty = ys[iB] - ys[iA];
    const m = Math.hypot(tx, ty) || 1;
    // Inward normal: rotation (−ty, tx) / |T| in screen coords.
    const ix = -ty / m;
    const iy = tx / m;
    const len = k * combScale;
    const tipX = x - ix * len;
    const tipY = y - iy * len;
    whiskers.push({ x1: x, y1: y, x2: tipX, y2: tipY });
    tips.push([tipX, tipY]);
  }
  const envelope = tips
    .map((t, i) => (i === 0 ? `M ${t[0]} ${t[1]}` : `L ${t[0]} ${t[1]}`))
    .join(" ");
  return { whiskers, envelope };
}
