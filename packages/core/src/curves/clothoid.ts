import { rounded } from "../utils.js";
import type { CurveBuilder } from "./types.js";
import { transformX, transformY } from "./orient.js";
import { integrateClothoid } from "./integrate.js";

const ANGLE_EPSILON = 1e-6;

/**
 * Clothoid blend: line → clothoid → arc → clothoid → line. Curvature
 * ramps linearly along arc length from 0 (edge) to 1/R (central arc)
 * and mirrors on the way out. G2 at every seam.
 *
 * Smoothing s ∈ [0, 1] splits the 90° rotation: each clothoid half
 * rotates (π/4)·s, the arc rotates (π/2)(1 − s). s = 0 is a quarter
 * circle; s = 1 is the pure Cornu corner.
 *
 * One cubic Bézier per half-fillet + one native SVG `a` for the arc.
 * The cubic uses the midpoint-match scheme (see the comment above the
 * `h0` / `h1` solve below) — Hausdorff error stays sub-pixel across
 * R ∈ [10, 200] and smoothing ∈ [0, 1].
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
  const dTheta = (Math.PI / 4) * s;
  const L = (Math.PI / 2) * R * s;
  // κ(s) = A·s with A = 1/(R·L), so κ(L) = 1/R.
  const A = L > 0 ? 1 / (R * L) : 0;

  // Integrate clothoid 1 in its local frame (origin, tangent along +X).
  // The endpoint drives the natural `p` and the cubic handle lengths;
  // the midpoint is the third constraint that pins the cubic fit so it
  // can't bow away from the spiral.
  const { x: xC, y: yC } = L > 0
    ? integrateClothoid(0, 0, A, L)
    : { x: 0, y: 0 };
  const { x: xMid, y: yMid } = L > 0
    ? integrateClothoid(0, 0, A, L / 2)
    : { x: 0, y: 0 };

  // Arc centre sits R to the left of the end tangent; by symmetry it
  // lies on the diagonal X + Y = p.
  const arcCx = xC - R * Math.sin(dTheta);
  const arcCy = yC + R * Math.cos(dTheta);
  const naturalP = arcCx + arcCy;

  // Scale R proportionally when the natural footprint overshoots the
  // budget — preserves the shape of the clothoid/arc blend.
  let p = naturalP;
  let effR = R;
  let effX = xC;
  let effY = yC;
  let effMx = xMid;
  let effMy = yMid;
  if (naturalP > roundingAndSmoothingBudget && naturalP > 0) {
    const scale = roundingAndSmoothingBudget / naturalP;
    p = roundingAndSmoothingBudget;
    effR = R * scale;
    effX = xC * scale;
    effY = yC * scale;
    effMx = xMid * scale;
    effMy = yMid * scale;
  }
  if (p <= 0) {
    return { p: 0, pathSegment: () => "" };
  }

  // Midpoint-match cubic for the half-fillet. Endpoint position +
  // tangent (4 constraints) and the clothoid midpoint (2) pin h0, h1:
  //
  //   P(0.5) = ½(B0 + B3) + (3/8)(h0·T_a − h1·T_b) = midpoint
  //
  // T_a = (1, 0), T_b = (cos dTheta, sin dTheta); the Y equation gives
  // h1, back-substitution gives h0. Stays under 1 px from the true
  // clothoid for R ∈ [10, 200], smoothing ∈ [0, 1]. Walton–Meek's
  // closed-form (cos α_a / cos α_b weights) placed B2 below the entry
  // tangent — the cubic dipped ~0.45 px outside the rectangle at
  // R = 40 / smoothing = 0.6.
  let h0 = 0;
  let h1 = 0;
  if (L > 0) {
    const cosDt = Math.cos(dTheta);
    const sinDt = Math.sin(dTheta);
    if (sinDt > 1e-12) {
      h1 = ((8 / 3) * (effY / 2 - effMy)) / sinDt;
    }
    h0 = (8 / 3) * (effMx - effX / 2) + h1 * cosDt;
  }

  const arcSweep = Math.PI / 2 - 2 * dTheta;
  const hasArc = Math.abs(arcSweep) > ANGLE_EPSILON;

  return {
    p,
    pathSegment: (orient) => {
      const parts: string[] = [];

      if (L > 0) {
        // Cloth1: B0 = (0, 0), B1 = (h0, 0), B3 = (effX, effY),
        // B2 = B3 − h1·(cos dTheta, sin dTheta).
        const B1dx = h0;
        const B1dy = 0;
        const B2dx = effX - h1 * Math.cos(dTheta);
        const B2dy = effY - h1 * Math.sin(dTheta);
        const B3dx = effX;
        const B3dy = effY;
        const a = transformX(B1dx, B1dy, orient);
        const b = transformY(B1dx, B1dy, orient);
        const c = transformX(B2dx, B2dy, orient);
        const d = transformY(B2dx, B2dy, orient);
        const e = transformX(B3dx, B3dy, orient);
        const f = transformY(B3dx, B3dy, orient);
        parts.push(rounded`c ${a} ${b} ${c} ${d} ${e} ${f}`);
      }

      if (hasArc) {
        // Arc (effX, effY) → (p − effY, p − effX); relative delta is
        // (p − effX − effY, p − effX − effY) on both axes by symmetry.
        const arcDx = p - effX - effY;
        const arcDy = p - effX - effY;
        const ax = transformX(arcDx, arcDy, orient);
        const ay = transformY(arcDx, arcDy, orient);
        parts.push(rounded`a ${effR} ${effR} 0 0 1 ${ax} ${ay}`);
      }

      if (L > 0) {
        // Cloth2: mirror of cloth1 across X + Y = p, from
        // (p − effY, p − effX) → (p, p). Relative to B0:
        //   B1 = (h1·sin dTheta, h1·cos dTheta)
        //   B2 = (effY, effX − h0)
        //   B3 = (effY, effX)
        const B1dx = h1 * Math.sin(dTheta);
        const B1dy = h1 * Math.cos(dTheta);
        const B2dx = effY;
        const B2dy = effX - h0;
        const B3dx = effY;
        const B3dy = effX;
        const a = transformX(B1dx, B1dy, orient);
        const b = transformY(B1dx, B1dy, orient);
        const c = transformX(B2dx, B2dy, orient);
        const d = transformY(B2dx, B2dy, orient);
        const e = transformX(B3dx, B3dy, orient);
        const f = transformY(B3dx, B3dy, orient);
        parts.push(rounded`c ${a} ${b} ${c} ${d} ${e} ${f}`);
      }

      return parts.join(" ");
    },
  };
};
