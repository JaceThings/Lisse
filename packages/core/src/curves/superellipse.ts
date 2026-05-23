import { rounded } from "../utils.js";
import type { CurveBuilder } from "./types.js";
import { transformXY } from "./orient.js";

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
 * (4 constraints) plus the parameter midpoint (2). Hausdorff error well
 * sub-pixel for n ∈ [2, 8] at Lisse-realistic radii.
 */
export const buildSuperellipse: CurveBuilder = ({
  cornerRadius,
  exponent,
  roundingAndSmoothingBudget,
}) => {
  const p = Math.min(cornerRadius, roundingAndSmoothingBudget);
  if (p <= 0) {
    return { p: 0, pathSegment: () => "" };
  }
  const n = exponent;
  const e = 2 / n;

  const thetas = [0, Math.PI / 6, Math.PI / 3, Math.PI / 2];
  // Pin endpoints to (0, 0) and (p, p): Math.cos(π/2) returns 6.123e-17,
  // not exact zero, so the curve would exit at (p, p − ε·p). The
  // skeleton's `L width br.p` then draws a sub-pixel stub — visible as a
  // tiny mismatch under thick borders.
  const points: Array<[number, number]> = thetas.map((th, i) => {
    if (i === 0) return [0, 0];
    if (i === thetas.length - 1) return [p, p];
    const sinTh = Math.sin(th);
    const cosTh = Math.cos(th);
    return [p * Math.pow(sinTh, e), p * (1 - Math.pow(cosTh, e))];
  });
  // Endpoint tangents use the geometric limit (edge direction) — the
  // parametric form is numerically unstable at θ = 0 / π/2 for n > 2.
  const tangents: Array<[number, number]> = thetas.map((th, i) => {
    if (i === 0) return [1, 0];
    if (i === thetas.length - 1) return [0, 1];
    const sinTh = Math.sin(th);
    const cosTh = Math.cos(th);
    const dX = e * Math.pow(sinTh, e - 1) * cosTh * p;
    const dY = e * Math.pow(cosTh, e - 1) * sinTh * p;
    const m = Math.hypot(dX, dY) || 1;
    return [dX / m, dY / m];
  });

  return {
    p,
    pathSegment: (orient) => {
      const parts: string[] = [];
      for (let i = 0; i < thetas.length - 1; i++) {
        const [X0, Y0] = points[i];
        const [X1, Y1] = points[i + 1];
        const [T0x, T0y] = tangents[i];
        const [T1x, T1y] = tangents[i + 1];

        // Parameter midpoint — the third constraint that pins h0, h1.
        const thMid = (thetas[i] + thetas[i + 1]) / 2;
        const sinM = Math.sin(thMid);
        const cosM = Math.cos(thMid);
        const Mx = p * Math.pow(sinM, e);
        const My = p * (1 - Math.pow(cosM, e));

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

        const [dx1, dy1] = transformXY(B1x - X0, B1y - Y0, orient);
        const [dx2, dy2] = transformXY(B2x - X0, B2y - Y0, orient);
        const [dx3, dy3] = transformXY(X1 - X0, Y1 - Y0, orient);
        parts.push(rounded`c ${dx1} ${dy1} ${dx2} ${dy2} ${dx3} ${dy3}`);
      }
      return parts.join(" ");
    },
  };
};
