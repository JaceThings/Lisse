import { fixed4 } from "../utils.js";
import type { CurveBuilder } from "./types.js";
import { cubic, cubicText, equalArc, negated, type EqualArcText } from "./orient.js";
import { EMPTY_BUILDER_OUTPUT } from "./types.js";
import { integrateClothoid } from "./integrate.js";

const ANGLE_EPSILON = 1e-6;

/**
 * Clothoid blend: line → clothoid → arc → clothoid → line. Curvature
 * ramps linearly along arc length from 0 (edge) to 1/R (central arc)
 * and mirrors on the way out. G2 at every seam.
 *
 * Smoothing s ∈ [0, 1] splits the 90° rotation: each clothoid half
 * rotates (π/4)·s, the arc rotates (π/2)(1 − s). s = 0 is a quarter
 * circle; s = 1 is the pure Cornu corner. One cubic Bézier per
 * half-fillet + one native SVG `a` for the arc.
 */
export const buildClothoid: CurveBuilder = ({
  cornerRadius,
  smoothing,
  roundingAndSmoothingBudget,
}) => {
  if (cornerRadius <= 0) return EMPTY_BUILDER_OUTPUT;
  const s = Math.max(0, Math.min(1, smoothing));
  const R = cornerRadius;
  const dTheta = (Math.PI / 4) * s;
  const L = (Math.PI / 2) * R * s;
  // κ(s) = A·s with A = 1/(R·L), so κ(L) = 1/R.
  const A = L > 0 ? 1 / (R * L) : 0;

  // Integrate clothoid 1 in its local frame (origin, tangent along +X).
  // The endpoint drives the natural `p` and cubic handle lengths; the
  // midpoint is the third constraint pinning the fit to the spiral.
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
  if (p <= 0) return EMPTY_BUILDER_OUTPUT;

  // Midpoint-match cubic for the half-fillet. Endpoint position +
  // tangent (4 constraints) and the clothoid midpoint (2) pin h0, h1:
  //
  //   P(0.5) = ½(B0 + B3) + (3/8)(h0·T_a − h1·T_b) = midpoint
  //
  // T_a = (1, 0), T_b = (cos dTheta, sin dTheta); the Y equation gives
  // h1, back-substitution gives h0. Walton–Meek's closed-form
  // (cos α_a / cos α_b weights) instead dipped B2 ~0.45 px outside the
  // rectangle at R = 40 / smoothing = 0.6.
  const cosDt = Math.cos(dTheta);
  const sinDt = Math.sin(dTheta);
  let h0 = 0;
  let h1 = 0;
  if (L > 0) {
    if (sinDt > 1e-12) {
      h1 = ((8 / 3) * (effY / 2 - effMy)) / sinDt;
    }
    h0 = (8 / 3) * (effMx - effX / 2) + h1 * cosDt;
  }

  const arcSweep = Math.PI / 2 - 2 * dTheta;
  const hasArc = Math.abs(arcSweep) > ANGLE_EPSILON;

  // Both half-fillets and the arc are orient-independent, so solve and format
  // them once here. pathSegment used to redo the trig, the deltas and 16
  // `fixed4` calls on every orient — 64 per corner for these 14 magnitudes.
  //
  // Cloth1: B0 = (0, 0), B1 = (h0, 0), B3 = (effX, effY),
  //         B2 = B3 − h1·(cos dTheta, sin dTheta).
  // Cloth2: the mirror of cloth1 across X + Y = p, running
  //         (p − effY, p − effX) → (p, p); relative to its own B0,
  //         B1 = (h1·sin dTheta, h1·cos dTheta), B2 = (effY, effX − h0),
  //         B3 = (effY, effX).
  const fillets =
    L > 0
      ? {
          head: cubicText(h0, 0, effX - h1 * cosDt, effY - h1 * sinDt, effX, effY),
          tail: cubicText(h1 * sinDt, h1 * cosDt, effY, effX - h0, effY, effX),
        }
      : null;

  // Arc (effX, effY) → (p − effY, p − effX); relative delta is
  // (p − effX − effY) on both axes by symmetry.
  let arc: EqualArcText | null = null;
  if (hasArc) {
    const delta = p - effX - effY;
    const d = fixed4(delta);
    arc = { radius: fixed4(effR), d, dn: negated(delta, d) };
  }

  return {
    p,
    pathSegment: (orient) => {
      // At smoothing = 0 there are no fillets, at smoothing = 1 no arc.
      if (fillets === null) return arc === null ? "" : equalArc(arc, orient);
      const head = cubic(fillets.head, orient);
      const tail = cubic(fillets.tail, orient);
      if (arc === null) return head + " " + tail;
      return head + " " + equalArc(arc, orient) + " " + tail;
    },
  };
};
