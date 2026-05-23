import { rounded } from "../utils.js";
import { getPathParamsForCorner } from "../corner-params.js";
import type { CornerPathParams } from "../types.js";
import type { CurveBuilder } from "./types.js";

/**
 * Figma squircle — cubic shoulder + central arc + cubic shoulder.
 *
 * G1 with the adjacent edges (curvature steps at the cubic↔arc seams).
 * This wraps the canonical four orientation-specific drawers
 * (`drawTopRightPath` / `drawBottomRightPath` / …) verbatim so the
 * squircle output is byte-identical to what Lisse has shipped since
 * 0.1.0.
 *
 * The per-orient drawers carry hand-placed literal `0` characters in
 * the template strings (e.g. `c ${a} 0 …`) — these are template text,
 * not interpolated values, so they print as `0` not `0.0000`.
 * Funneling the squircle through `transformXY` would round them, which
 * would diff in downstream snapshot tests even though the visual output
 * is identical. We keep the verbatim drawers for that reason.
 */
export const buildSquircle: CurveBuilder = ({
  cornerRadius,
  smoothing,
  preserveSmoothing,
  roundingAndSmoothingBudget,
}) => {
  const params = getPathParamsForCorner({
    cornerRadius,
    cornerSmoothing: smoothing,
    preserveSmoothing,
    roundingAndSmoothingBudget,
  });
  if (params.cornerRadius <= 0) {
    return { p: 0, pathSegment: () => "" };
  }
  return {
    p: params.p,
    pathSegment: (orient) => {
      switch (orient) {
        case "TR":
          return drawTopRightPath(params);
        case "BR":
          return drawBottomRightPath(params);
        case "BL":
          return drawBottomLeftPath(params);
        case "TL":
          return drawTopLeftPath(params);
      }
    },
  };
};

function drawTopRightPath({
  cornerRadius,
  a,
  b,
  c,
  d,
  arcSectionLength,
}: CornerPathParams): string {
  return rounded`c ${a} 0 ${a + b} 0 ${a + b + c} ${d} a ${cornerRadius} ${cornerRadius} 0 0 1 ${arcSectionLength} ${arcSectionLength} c ${d} ${c} ${d} ${b + c} ${d} ${a + b + c}`;
}

function drawBottomRightPath({
  cornerRadius,
  a,
  b,
  c,
  d,
  arcSectionLength,
}: CornerPathParams): string {
  return rounded`c 0 ${a} 0 ${a + b} ${-d} ${a + b + c} a ${cornerRadius} ${cornerRadius} 0 0 1 -${arcSectionLength} ${arcSectionLength} c ${-c} ${d} ${-(b + c)} ${d} ${-(a + b + c)} ${d}`;
}

function drawBottomLeftPath({
  cornerRadius,
  a,
  b,
  c,
  d,
  arcSectionLength,
}: CornerPathParams): string {
  return rounded`c ${-a} 0 ${-(a + b)} 0 ${-(a + b + c)} ${-d} a ${cornerRadius} ${cornerRadius} 0 0 1 -${arcSectionLength} -${arcSectionLength} c ${-d} ${-c} ${-d} ${-(b + c)} ${-d} ${-(a + b + c)}`;
}

function drawTopLeftPath({
  cornerRadius,
  a,
  b,
  c,
  d,
  arcSectionLength,
}: CornerPathParams): string {
  return rounded`c 0 ${-a} 0 ${-(a + b)} ${d} ${-(a + b + c)} a ${cornerRadius} ${cornerRadius} 0 0 1 ${arcSectionLength} -${arcSectionLength} c ${c} ${-d} ${b + c} ${-d} ${a + b + c} ${-d}`;
}
