import { rounded } from "../utils.js";
import type { CurveBuilder } from "./types.js";
import { EMPTY_BUILDER_OUTPUT } from "./types.js";
import { transformX, transformY } from "./orient.js";

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
  return {
    p,
    pathSegment: (orient) => {
      const dx = transformX(p, p, orient);
      const dy = transformY(p, p, orient);
      return rounded`a ${p} ${p} 0 0 1 ${dx} ${dy}`;
    },
  };
};
