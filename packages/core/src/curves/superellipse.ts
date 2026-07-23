import { rounded } from "../utils.js";
import type { CurveBuilder } from "./types.js";
import { EMPTY_BUILDER_OUTPUT } from "./types.js";
import { transformX, transformY } from "./orient.js";

// Fixed sample angles θ ∈ {0, π/6, π/3, π/2} and their trig are shape-
// independent, so precompute once at module load. Endpoints (i = 0, 3)
// are pinned to (0, 0) / (p, p) so their trig is never consulted.
const THETAS = [0, Math.PI / 6, Math.PI / 3, Math.PI / 2] as const;
const SIN_THETA = THETAS.map((th) => Math.sin(th));
const COS_THETA = THETAS.map((th) => Math.cos(th));
// Per-segment parameter midpoints and their trig — likewise constant.
// Evaluated as `(THETAS[i] + THETAS[i + 1]) / 2` exactly, so floating-
// point rounding stays bit-for-bit identical across engines.
const THETA_MID = [
  (THETAS[0] + THETAS[1]) / 2,
  (THETAS[1] + THETAS[2]) / 2,
  (THETAS[2] + THETAS[3]) / 2,
];
const SIN_MID = THETA_MID.map((th) => Math.sin(th));
const COS_MID = THETA_MID.map((th) => Math.cos(th));

/**
 * Superellipse corner. `|X/p|^n + |Y'/p|^n = 1` reflected into the
 * corner, running (0, 0) → (p, p). For n > 2 curvature is exactly 0 at
 * the axis crossings, so the curve is G2-flat with the adjacent edges.
 * n = 2 is a quarter circle; n = 4 is what CSS `corner-shape: squircle`
 * resolves to.
 *
 * Parametric form (X along entry edge toward the sharp vertex, Y into
 * the interior):
 *     X(θ) = p · sin^(2/n)(θ),  Y(θ) = p · (1 − cos^(2/n)(θ))
 * Endpoint tangents: (1, 0) at θ = 0, (0, 1) at θ = π/2; interior
 * tangents are the analytic parametric derivative, normalised.
 *
 * Three cubic Béziers per quadrant, sampled at θ ∈ {0, π/6, π/3, π/2}.
 * Each cubic uses the midpoint-match scheme: endpoint position + tangent
 * (4 constraints) plus the parameter midpoint (2). Hausdorff error is
 * well sub-pixel for n ∈ [2, 4] at Lisse-realistic radii; degrades to
 * ~5% of corner footprint for n ∈ (4, 8] as the Lamé shape sharpens.
 * Reference-shape tests pin the actual tolerances per exponent.
 */
export const buildSuperellipse: CurveBuilder = ({
  cornerRadius,
  exponent,
  roundingAndSmoothingBudget,
}) => {
  const p = Math.min(cornerRadius, roundingAndSmoothingBudget);
  if (p <= 0) return EMPTY_BUILDER_OUTPUT;
  // n < 2 bulges concave, non-finite n → NaN through Math.pow. Clamp
  // before computing e = 2/n; n = 2 is a quarter-circle.
  const n = Number.isFinite(exponent) ? Math.max(2, exponent) : 4;
  const e = 2 / n;

  // Specialise `pow(x, e)` for integer reciprocals: Math.sqrt is a single
  // hardware instruction vs Math.pow's ~30-50ns C++ call, across the 8-12
  // pow evaluations per builder.
  const powE: (x: number) => number =
    n === 2 ? (x) => x
    : n === 4 ? Math.sqrt
    : n === 8 ? (x) => Math.sqrt(Math.sqrt(x))
    : (x) => Math.pow(x, e);
  // `pow(x, e - 1)` for the tangent derivative: n=2 ⇒ 1; n=4 ⇒ 1/sqrt(x).
  const e1 = e - 1;
  const powE1: (x: number) => number =
    n === 2 ? () => 1
    : n === 4 ? (x) => 1 / Math.sqrt(x)
    : (x) => Math.pow(x, e1);

  // Pin endpoints to (0, 0) and (p, p): Math.cos(π/2) returns 6.123e-17,
  // not exact zero, so the curve would exit at (p, p − ε·p) and the
  // skeleton's `L width br.p` would draw a sub-pixel stub, visible under
  // thick borders.
  const points: Array<[number, number]> = THETAS.map((_th, i) => {
    if (i === 0) return [0, 0];
    if (i === THETAS.length - 1) return [p, p];
    return [p * powE(SIN_THETA[i]), p * (1 - powE(COS_THETA[i]))];
  });
  // Endpoint tangents use the geometric limit (edge direction) — the
  // parametric form is numerically unstable at θ = 0 / π/2 for n > 2.
  const tangents: Array<[number, number]> = THETAS.map((_th, i) => {
    if (i === 0) return [1, 0];
    if (i === THETAS.length - 1) return [0, 1];
    const dX = e * powE1(SIN_THETA[i]) * COS_THETA[i] * p;
    const dY = e * powE1(COS_THETA[i]) * SIN_THETA[i] * p;
    const m = Math.sqrt(dX * dX + dY * dY) || 1;
    return [dX / m, dY / m];
  });

  // The cubic fit is orient-independent, so solve it once here (not 4×
  // inside pathSegment). Each segment reduces to six control-point deltas
  // that pathSegment only has to transform + round.
  const segments: Array<[number, number, number, number, number, number]> = [];
  for (let i = 0; i < THETAS.length - 1; i++) {
    const [X0, Y0] = points[i];
    const [X1, Y1] = points[i + 1];
    const [T0x, T0y] = tangents[i];
    const [T1x, T1y] = tangents[i + 1];

    // Parameter midpoint — the third constraint that pins h0, h1.
    const Mx = p * powE(SIN_MID[i]);
    const My = p * (1 - powE(COS_MID[i]));

    // P(0.5) = ½(B0 + B3) + (3/8)(h0 T0 − h1 T1); solve for h0, h1.
    const RHSx = (8 / 3) * (Mx - (X0 + X1) / 2);
    const RHSy = (8 / 3) * (My - (Y0 + Y1) / 2);
    const det = T1x * T0y - T1y * T0x;
    const h0 = det !== 0 ? (-T1y * RHSx + T1x * RHSy) / det : 0;
    const h1 = det !== 0 ? (T0x * RHSy - T0y * RHSx) / det : 0;

    const B1x = X0 + h0 * T0x;
    const B1y = Y0 + h0 * T0y;
    const B2x = X1 - h1 * T1x;
    const B2y = Y1 - h1 * T1y;

    const dB1x = B1x - X0;
    const dB1y = B1y - Y0;
    const dB2x = B2x - X0;
    const dB2y = B2y - Y0;
    const dB3x = X1 - X0;
    const dB3y = Y1 - Y0;
    segments.push([dB1x, dB1y, dB2x, dB2y, dB3x, dB3y]);
  }

  return {
    p,
    pathSegment: (orient) => {
      const parts: string[] = [];
      for (let i = 0; i < segments.length; i++) {
        const [dB1x, dB1y, dB2x, dB2y, dB3x, dB3y] = segments[i];
        const dx1 = transformX(dB1x, dB1y, orient);
        const dy1 = transformY(dB1x, dB1y, orient);
        const dx2 = transformX(dB2x, dB2y, orient);
        const dy2 = transformY(dB2x, dB2y, orient);
        const dx3 = transformX(dB3x, dB3y, orient);
        const dy3 = transformY(dB3x, dB3y, orient);
        parts.push(rounded`c ${dx1} ${dy1} ${dx2} ${dy2} ${dx3} ${dy3}`);
      }
      return parts.join(" ");
    },
  };
};
