import { rounded } from "../utils.js";
import type { CurveBuilder } from "./types.js";
import { transformXY } from "./orient.js";
import { integrateClothoid } from "./integrate.js";

const ANGLE_EPSILON = 1e-6;

/**
 * Clothoid blend: line → clothoid → arc → clothoid → line. Curvature
 * ramps linearly along arc length from 0 (matching the straight edge)
 * up to 1/R (matching the central circular arc), then mirrored on the
 * way out. G2 at every seam.
 *
 * Smoothing s ∈ [0, 1] splits the corner's 90° tangent rotation between
 * the two clothoid halves (each rotating π/4 · s) and the central arc
 * (rotating (π/2)(1 − s)). s = 0 collapses to a plain quarter circle;
 * s = 1 is the pure-clothoid Cornu corner.
 *
 * Path representation per corner: one Walton–Meek cubic Bézier per
 * half-fillet + one native SVG `a` for the central arc. Walton & Meek
 * (2005) bound the cubic Hausdorff error by (Δθ)⁵·L / 1920, which is
 * sub-pixel for any Lisse-realistic R / smoothing.
 */
export const buildClothoid: CurveBuilder = ({
  cornerRadius,
  smoothing,
  roundingAndSmoothingBudget,
}) => {
  if (cornerRadius <= 0) {
    return { p: 0, pathSegment: () => "" };
  }
  const s = Math.max(0, Math.min(1, smoothing));
  const R = cornerRadius;
  // Each clothoid handles (π/4)·s of the 90° corner rotation; the
  // central arc handles the rest.
  const dTheta = (Math.PI / 4) * s;
  const L = (Math.PI / 2) * R * s;
  // κ(s) = A · s, A = 1/(R·L) so κ(L) = 1/R.
  const A = L > 0 ? 1 / (R * L) : 0;

  // Integrate clothoid 1 in its local frame (start at origin, tangent
  // along +X). The endpoint position drives both the natural `p` and
  // the Walton–Meek control point lengths below.
  const { x: xC, y: yC } = L > 0
    ? integrateClothoid(0, 0, A, L)
    : { x: 0, y: 0 };

  // Arc center sits to the left of the end-tangent at distance R; by
  // symmetry of the construction it lies on the diagonal X + Y = p.
  const arcCx = xC - R * Math.sin(dTheta);
  const arcCy = yC + R * Math.cos(dTheta);
  const naturalP = arcCx + arcCy;

  // Clamp by scaling R proportionally if the natural footprint exceeds
  // the budget. This preserves the corner's geometric character (shape
  // of the clothoid/arc blend) under tight side budgets.
  let p = naturalP;
  let effR = R;
  let effX = xC;
  let effY = yC;
  if (naturalP > roundingAndSmoothingBudget && naturalP > 0) {
    const scale = roundingAndSmoothingBudget / naturalP;
    p = roundingAndSmoothingBudget;
    effR = R * scale;
    effX = xC * scale;
    effY = yC * scale;
  }
  if (p <= 0) {
    return { p: 0, pathSegment: () => "" };
  }

  // Walton–Meek closed-form cubic for the clothoid half-fillet from
  // (0, 0) with tangent (1, 0) to (effX, effY) with tangent
  // (cos dTheta, sin dTheta). The chord-based formula gives h0, h1
  // (control-point distances along each endpoint tangent).
  const chord = Math.hypot(effX, effY);
  let h0 = 0;
  let h1 = 0;
  if (chord > 0) {
    const alphaA = Math.atan2(effY, effX);
    // Total turn T0 → T3 = dTheta; α_a + α_b = dTheta.
    const alphaB = dTheta - alphaA;
    const denom = 2 * (2 + Math.cos(alphaA + alphaB));
    h0 = (3 * chord * Math.cos(alphaB)) / denom;
    h1 = (3 * chord * Math.cos(alphaA)) / denom;
  }

  const arcSweep = Math.PI / 2 - 2 * dTheta;
  const hasArc = Math.abs(arcSweep) > ANGLE_EPSILON;

  return {
    p,
    pathSegment: (orient) => {
      const parts: string[] = [];

      if (L > 0) {
        // Cloth1: B0 = (0, 0), B1 = (h0, 0),
        //         B2 = (effX − h1·cos dTheta, effY − h1·sin dTheta),
        //         B3 = (effX, effY).
        const B1dx = h0;
        const B1dy = 0;
        const B2dx = effX - h1 * Math.cos(dTheta);
        const B2dy = effY - h1 * Math.sin(dTheta);
        const B3dx = effX;
        const B3dy = effY;
        const [a, b] = transformXY(B1dx, B1dy, orient);
        const [c, d] = transformXY(B2dx, B2dy, orient);
        const [e, f] = transformXY(B3dx, B3dy, orient);
        parts.push(rounded`c ${a} ${b} ${c} ${d} ${e} ${f}`);
      }

      if (hasArc) {
        // Arc from (effX, effY) to (p − effY, p − effX); relative move
        // collapses to (p − effX − effY, p − effX − effY).
        const arcDx = p - effX - effY;
        const arcDy = p - effX - effY;
        const [ax, ay] = transformXY(arcDx, arcDy, orient);
        parts.push(rounded`a ${effR} ${effR} 0 0 1 ${ax} ${ay}`);
      }

      if (L > 0) {
        // Cloth2: mirror of cloth1 across the diagonal X + Y = p.
        // From (p − effY, p − effX) to (p, p). Relative deltas:
        //   B1 − B0 = (h1·sin dTheta, h1·cos dTheta)
        //   B2 − B0 = (effY, effX − h0)
        //   B3 − B0 = (effY, effX)
        const B1dx = h1 * Math.sin(dTheta);
        const B1dy = h1 * Math.cos(dTheta);
        const B2dx = effY;
        const B2dy = effX - h0;
        const B3dx = effY;
        const B3dy = effX;
        const [a, b] = transformXY(B1dx, B1dy, orient);
        const [c, d] = transformXY(B2dx, B2dy, orient);
        const [e, f] = transformXY(B3dx, B3dy, orient);
        parts.push(rounded`c ${a} ${b} ${c} ${d} ${e} ${f}`);
      }

      return parts.join(" ");
    },
  };
};
