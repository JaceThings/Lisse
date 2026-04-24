import type { SmoothCornerOptions, CornerConfig } from "./types.js";
import { distributeAndNormalize } from "./distribute.js";
import { getPathParamsForCorner } from "./corner-params.js";
import { getSVGPathFromPathParams } from "./draw.js";

export const DEFAULT_SMOOTHING = 0.6;
export const DEFAULT_PRESERVE_SMOOTHING = true;

type Resolved = Required<CornerConfig>;

interface ResolvedCorners {
  topLeft: Resolved;
  topRight: Resolved;
  bottomRight: Resolved;
  bottomLeft: Resolved;
}

function withDefaults(c: CornerConfig): Resolved {
  return {
    radius: c.radius,
    smoothing: c.smoothing ?? DEFAULT_SMOOTHING,
    preserveSmoothing: c.preserveSmoothing ?? DEFAULT_PRESERVE_SMOOTHING,
  };
}

function resolve(v: CornerConfig | number | undefined): Resolved {
  const c = typeof v === "number" ? { radius: v } : v ?? { radius: 0 };
  return withDefaults(c);
}

function resolveOptions(options: SmoothCornerOptions): ResolvedCorners {
  if ("radius" in options) {
    const c = withDefaults(options);
    return { topLeft: c, topRight: c, bottomRight: c, bottomLeft: c };
  }
  return {
    topLeft: resolve(options.topLeft),
    topRight: resolve(options.topRight),
    bottomRight: resolve(options.bottomRight),
    bottomLeft: resolve(options.bottomLeft),
  };
}

/**
 * Generate an SVG path `d` string for a smooth-cornered rectangle.
 *
 * @param width - Rectangle width in pixels
 * @param height - Rectangle height in pixels
 * @param options - Corner configuration (uniform or per-corner)
 * @returns SVG path `d` attribute string
 */
export function generatePath(
  width: number,
  height: number,
  options: SmoothCornerOptions
): string {
  if (width <= 0 || height <= 0) {
    return "M 0 0 H 0 V 0 H 0 Z";
  }

  const corners = resolveOptions(options);

  // Fast path: all corners zero
  if (
    corners.topLeft.radius <= 0 &&
    corners.topRight.radius <= 0 &&
    corners.bottomRight.radius <= 0 &&
    corners.bottomLeft.radius <= 0
  ) {
    return `M 0 0 H ${width} V ${height} H 0 Z`;
  }

  const normalized = distributeAndNormalize({
    topLeftCornerRadius: corners.topLeft.radius,
    topRightCornerRadius: corners.topRight.radius,
    bottomRightCornerRadius: corners.bottomRight.radius,
    bottomLeftCornerRadius: corners.bottomLeft.radius,
    width,
    height,
  });

  const paramsFor = (name: keyof ResolvedCorners) =>
    getPathParamsForCorner({
      cornerRadius: normalized[name].radius,
      cornerSmoothing: corners[name].smoothing,
      preserveSmoothing: corners[name].preserveSmoothing,
      roundingAndSmoothingBudget: normalized[name].roundingAndSmoothingBudget,
    });

  return getSVGPathFromPathParams({
    width,
    height,
    topLeftPathParams: paramsFor("topLeft"),
    topRightPathParams: paramsFor("topRight"),
    bottomRightPathParams: paramsFor("bottomRight"),
    bottomLeftPathParams: paramsFor("bottomLeft"),
  });
}

/**
 * Generate a CSS `clip-path: path(...)` value for a smooth-cornered rectangle.
 *
 * @param width - Rectangle width in pixels
 * @param height - Rectangle height in pixels
 * @param options - Corner configuration (uniform or per-corner)
 * @returns CSS clip-path string, e.g. `path("M 32 0 L 168 0 ...")`
 */
export function generateClipPath(
  width: number,
  height: number,
  options: SmoothCornerOptions
): string {
  return `path("${generatePath(width, height, options)}")`;
}
