import type {
  SmoothCornerOptions,
  CornerConfig,
  UniformCornerOptions,
  PerCornerConfig,
} from "./types.js";
import { distributeAndNormalize } from "./distribute.js";
import { getPathParamsForCorner } from "./corner-params.js";
import { getSVGPathFromPathParams } from "./draw.js";

export const DEFAULT_SMOOTHING = 0.6;
export const DEFAULT_PRESERVE_SMOOTHING = true;

function isUniform(options: SmoothCornerOptions): options is UniformCornerOptions {
  return "radius" in options;
}

function resolveCorner(
  value: CornerConfig | number | undefined,
  fallback: CornerConfig
): CornerConfig {
  if (value === undefined) return fallback;
  if (typeof value === "number") return { radius: value };
  return value;
}

interface ResolvedCorners {
  topLeft: Required<CornerConfig>;
  topRight: Required<CornerConfig>;
  bottomRight: Required<CornerConfig>;
  bottomLeft: Required<CornerConfig>;
}

function fillDefaults(c: CornerConfig): Required<CornerConfig> {
  return {
    radius: c.radius,
    smoothing: c.smoothing ?? DEFAULT_SMOOTHING,
    preserveSmoothing: c.preserveSmoothing ?? DEFAULT_PRESERVE_SMOOTHING,
  };
}

function resolveOptions(options: SmoothCornerOptions): ResolvedCorners {
  if (isUniform(options)) {
    const corner = fillDefaults(options);
    return {
      topLeft: corner,
      topRight: corner,
      bottomRight: corner,
      bottomLeft: corner,
    };
  }

  const defaults: CornerConfig = { radius: 0 };
  return {
    topLeft: fillDefaults(resolveCorner(options.topLeft, defaults)),
    topRight: fillDefaults(resolveCorner(options.topRight, defaults)),
    bottomRight: fillDefaults(resolveCorner(options.bottomRight, defaults)),
    bottomLeft: fillDefaults(resolveCorner(options.bottomLeft, defaults)),
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
