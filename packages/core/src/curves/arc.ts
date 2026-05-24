import { rounded } from "../utils.js";
import type { CurveBuilder } from "./types.js";
import { EMPTY_BUILDER_OUTPUT } from "./types.js";
import { transformX, transformY } from "./orient.js";

/**
 * Plain quarter-circle corner via native SVG `a`. G1 with the adjacent
 * edges: tangent matches but curvature jumps from 0 to 1/R at the seam.
 * This is the CSS `border-radius` curve and the smoothing → 0 fallback.
 *
 * Ignores `smoothing` and `exponent`. `p` is clamped to the budget so
 * the adjacent straight `L` segments can't overlap.
 */
export const buildArc: CurveBuilder = ({
  cornerRadius,
  roundingAndSmoothingBudget,
}) => {
  const p = Math.min(cornerRadius, roundingAndSmoothingBudget);
  if (p <= 0) return EMPTY_BUILDER_OUTPUT;
  return {
    p,
    pathSegment: (orient) => {
      const dx = transformX(p, p, orient);
      const dy = transformY(p, p, orient);
      return rounded`a ${p} ${p} 0 0 1 ${dx} ${dy}`;
    },
  };
};
