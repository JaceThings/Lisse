import { rounded } from "../utils.js";
import type { CurveBuilder } from "./types.js";
import { transformXY } from "./orient.js";

/**
 * Plain quarter-circle corner. Native SVG `a` command.
 *
 * G1 with the adjacent edges: tangent matches but curvature steps from
 * 0 (edge) to 1/R (arc) at the seam. This is the CSS `border-radius`
 * curve — included for completeness and as a smoothing → 0 fallback.
 *
 * Ignores `smoothing` and `exponent`. Under a tight `roundingAndSmoothing
 * Budget` the arc is clamped: `p` cannot exceed the budget, since the
 * straight `L` segments on either side of the corner would overlap.
 */
export const buildArc: CurveBuilder = ({
  cornerRadius,
  roundingAndSmoothingBudget,
}) => {
  const p = Math.min(cornerRadius, roundingAndSmoothingBudget);
  if (p <= 0) {
    return { p: 0, pathSegment: () => "" };
  }
  return {
    p,
    pathSegment: (orient) => {
      const [dx, dy] = transformXY(p, p, orient);
      return rounded`a ${p} ${p} 0 0 1 ${dx} ${dy}`;
    },
  };
};
