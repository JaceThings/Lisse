import { fixed4 } from "../utils.js";
import type { CurveBuilder } from "./types.js";
import { EMPTY_BUILDER_OUTPUT } from "./types.js";
import { equalArc, negated, type EqualArcText } from "./orient.js";

/**
 * Plain quarter-circle corner via native SVG `a` — the CSS `border-radius`
 * curve and the smoothing → 0 fallback. G1 with the adjacent edges.
 */
export const buildArc: CurveBuilder = ({
  cornerRadius,
  roundingAndSmoothingBudget,
}) => {
  // Clamp to the budget so the adjacent straight `L` segments can't overlap.
  const p = Math.min(cornerRadius, roundingAndSmoothingBudget);
  if (p <= 0) return EMPTY_BUILDER_OUTPUT;
  // Both radii and both sweep deltas are the same magnitude for a quarter
  // circle, so one format call covers the whole command in all four orients
  // — the old per-orient rounding ran sixteen.
  const radius = fixed4(p);
  const arc: EqualArcText = { radius, d: radius, dn: negated(p, radius) };
  return {
    p,
    pathSegment: (orient) => equalArc(arc, orient),
  };
};
