import type {
  SmoothCornerOptions,
  CornerConfig,
  UniformCornerOptions,
  PerCornerConfig,
} from "./types.js";
import { distributeAndNormalize } from "./distribute.js";
import { getPathParamsForCorner } from "./corner-params.js";
import { getSVGPathFromPathParams } from "./draw.js";

const DEFAULT_SMOOTHING = 0.6;
const DEFAULT_PRESERVE_SMOOTHING = true;

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

function resolveOptions(options: SmoothCornerOptions): ResolvedCorners {
  if (isUniform(options)) {
    const corner: Required<CornerConfig> = {
      radius: options.radius,
      smoothing: options.smoothing ?? DEFAULT_SMOOTHING,
      preserveSmoothing: options.preserveSmoothing ?? DEFAULT_PRESERVE_SMOOTHING,
    };
    return {
      topLeft: corner,
      topRight: corner,
      bottomRight: corner,
      bottomLeft: corner,
    };
  }

  const defaults: CornerConfig = { radius: 0 };
  const tl = resolveCorner(options.topLeft, defaults);
  const tr = resolveCorner(options.topRight, defaults);
  const br = resolveCorner(options.bottomRight, defaults);
  const bl = resolveCorner(options.bottomLeft, defaults);

  return {
    topLeft: {
      radius: tl.radius,
      smoothing: tl.smoothing ?? DEFAULT_SMOOTHING,
      preserveSmoothing: tl.preserveSmoothing ?? DEFAULT_PRESERVE_SMOOTHING,
    },
    topRight: {
      radius: tr.radius,
      smoothing: tr.smoothing ?? DEFAULT_SMOOTHING,
      preserveSmoothing: tr.preserveSmoothing ?? DEFAULT_PRESERVE_SMOOTHING,
    },
    bottomRight: {
      radius: br.radius,
      smoothing: br.smoothing ?? DEFAULT_SMOOTHING,
      preserveSmoothing: br.preserveSmoothing ?? DEFAULT_PRESERVE_SMOOTHING,
    },
    bottomLeft: {
      radius: bl.radius,
      smoothing: bl.smoothing ?? DEFAULT_SMOOTHING,
      preserveSmoothing: bl.preserveSmoothing ?? DEFAULT_PRESERVE_SMOOTHING,
    },
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

  const topLeftParams = getPathParamsForCorner({
    cornerRadius: normalized.topLeft.radius,
    cornerSmoothing: corners.topLeft.smoothing,
    preserveSmoothing: corners.topLeft.preserveSmoothing,
    roundingAndSmoothingBudget: normalized.topLeft.roundingAndSmoothingBudget,
  });

  const topRightParams = getPathParamsForCorner({
    cornerRadius: normalized.topRight.radius,
    cornerSmoothing: corners.topRight.smoothing,
    preserveSmoothing: corners.topRight.preserveSmoothing,
    roundingAndSmoothingBudget: normalized.topRight.roundingAndSmoothingBudget,
  });

  const bottomRightParams = getPathParamsForCorner({
    cornerRadius: normalized.bottomRight.radius,
    cornerSmoothing: corners.bottomRight.smoothing,
    preserveSmoothing: corners.bottomRight.preserveSmoothing,
    roundingAndSmoothingBudget:
      normalized.bottomRight.roundingAndSmoothingBudget,
  });

  const bottomLeftParams = getPathParamsForCorner({
    cornerRadius: normalized.bottomLeft.radius,
    cornerSmoothing: corners.bottomLeft.smoothing,
    preserveSmoothing: corners.bottomLeft.preserveSmoothing,
    roundingAndSmoothingBudget:
      normalized.bottomLeft.roundingAndSmoothingBudget,
  });

  return getSVGPathFromPathParams({
    width,
    height,
    topLeftPathParams: topLeftParams,
    topRightPathParams: topRightParams,
    bottomRightPathParams: bottomRightParams,
    bottomLeftPathParams: bottomLeftParams,
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
