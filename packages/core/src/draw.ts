import type { CornerPathParams } from "./types.js";
import { rounded } from "./utils.js";

export interface SVGPathInput {
  width: number;
  height: number;
  topRightPathParams: CornerPathParams;
  bottomRightPathParams: CornerPathParams;
  bottomLeftPathParams: CornerPathParams;
  topLeftPathParams: CornerPathParams;
}

/**
 * Build an SVG path string for a smooth-cornered rectangle from the four
 * per-corner parameter sets produced by `generatePathParamsForCorner`.
 * The path starts at the top-left corner and traverses clockwise,
 * inserting a piecewise Bézier + arc segment at each corner and straight
 * lines along the sides.
 */
export function getSVGPathFromPathParams({
  width,
  height,
  topLeftPathParams,
  topRightPathParams,
  bottomLeftPathParams,
  bottomRightPathParams,
}: SVGPathInput): string {
  return `
    M ${topLeftPathParams.p} 0
    L ${width - topRightPathParams.p} 0
    ${drawTopRightPath(topRightPathParams)}
    L ${width} ${bottomRightPathParams.p}
    L ${width} ${height - bottomRightPathParams.p}
    ${drawBottomRightPath(bottomRightPathParams)}
    L ${width - bottomLeftPathParams.p} ${height}
    L ${bottomLeftPathParams.p} ${height}
    ${drawBottomLeftPath(bottomLeftPathParams)}
    L 0 ${height - topLeftPathParams.p}
    L 0 ${topLeftPathParams.p}
    ${drawTopLeftPath(topLeftPathParams)}
    Z
  `
    .replace(/[\t\s\n]+/g, " ")
    .trim();
}

function drawTopRightPath({
  cornerRadius,
  a,
  b,
  c,
  d,
  arcSectionLength,
}: CornerPathParams): string {
  if (cornerRadius) {
    return rounded`
    c ${a} 0 ${a + b} 0 ${a + b + c} ${d}
    a ${cornerRadius} ${cornerRadius} 0 0 1 ${arcSectionLength} ${arcSectionLength}
    c ${d} ${c}
        ${d} ${b + c}
        ${d} ${a + b + c}`;
  }
  return "";
}

function drawBottomRightPath({
  cornerRadius,
  a,
  b,
  c,
  d,
  arcSectionLength,
}: CornerPathParams): string {
  if (cornerRadius) {
    return rounded`
    c 0 ${a}
      0 ${a + b}
      ${-d} ${a + b + c}
    a ${cornerRadius} ${cornerRadius} 0 0 1 -${arcSectionLength} ${arcSectionLength}
    c ${-c} ${d}
      ${-(b + c)} ${d}
      ${-(a + b + c)} ${d}`;
  }
  return "";
}

function drawBottomLeftPath({
  cornerRadius,
  a,
  b,
  c,
  d,
  arcSectionLength,
}: CornerPathParams): string {
  if (cornerRadius) {
    return rounded`
    c ${-a} 0
      ${-(a + b)} 0
      ${-(a + b + c)} ${-d}
    a ${cornerRadius} ${cornerRadius} 0 0 1 -${arcSectionLength} -${arcSectionLength}
    c ${-d} ${-c}
      ${-d} ${-(b + c)}
      ${-d} ${-(a + b + c)}`;
  }
  return "";
}

function drawTopLeftPath({
  cornerRadius,
  a,
  b,
  c,
  d,
  arcSectionLength,
}: CornerPathParams): string {
  if (cornerRadius) {
    return rounded`
    c 0 ${-a}
      0 ${-(a + b)}
      ${d} ${-(a + b + c)}
    a ${cornerRadius} ${cornerRadius} 0 0 1 ${arcSectionLength} -${arcSectionLength}
    c ${c} ${-d}
      ${b + c} ${-d}
      ${a + b + c} ${-d}`;
  }
  return "";
}
