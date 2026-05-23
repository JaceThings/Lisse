import { rounded } from "../utils.js";
import { getPathParamsForCorner } from "../corner-params.js";
import type { CornerPathParams } from "../types.js";
import type { CurveBuilder } from "./types.js";

/**
 * Figma squircle — cubic shoulder + central arc + cubic shoulder. G1
 * with the adjacent edges (curvature steps at the cubic↔arc seams).
 *
 * The four per-orient drawers are kept verbatim — byte-identical to
 * what Lisse has shipped since 0.1.0. They contain hand-placed literal
 * `0` characters in the template (e.g. `c ${a} 0 …`) that print as `0`,
 * not `0.0000`. Routing through `transformXY` would round those literals
 * and diff every downstream snapshot, despite identical visuals.
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
