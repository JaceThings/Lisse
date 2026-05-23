import type { SmoothCornerOptions, CornerConfig, CurveType } from "./types.js";
import { distributeAndNormalize } from "./distribute.js";
import { getCurveBuilder, DEFAULT_EXPONENT } from "./curves/index.js";

export const DEFAULT_SMOOTHING = 0.6;
export const DEFAULT_PRESERVE_SMOOTHING = true;
export const DEFAULT_CURVE: CurveType = "squircle";

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
    curve: c.curve ?? DEFAULT_CURVE,
    smoothing: c.smoothing ?? DEFAULT_SMOOTHING,
    exponent: c.exponent ?? DEFAULT_EXPONENT,
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

  const builderOutFor = (name: keyof ResolvedCorners) => {
    const corner = corners[name];
    const builder = getCurveBuilder(corner.curve);
    return builder({
      cornerRadius: normalized[name].radius,
      smoothing: corner.smoothing,
      exponent: corner.exponent,
      preserveSmoothing: corner.preserveSmoothing,
      roundingAndSmoothingBudget: normalized[name].roundingAndSmoothingBudget,
    });
  };

  const tl = builderOutFor("topLeft");
  const tr = builderOutFor("topRight");
  const br = builderOutFor("bottomRight");
  const bl = builderOutFor("bottomLeft");

  // The "next corner's p" pattern in the redundant L commands matches
  // the original draw.ts byte-for-byte. Each pair of L commands ends at
  // the next corner's entry tangency; the first L is geometrically a
  // no-op when adjacent radii match, and a harmless back-and-forth
  // otherwise — same shape, identical string in the snapshot tests.
  return `
    M ${tl.p} 0
    L ${width - tr.p} 0
    ${tr.pathSegment("TR")}
    L ${width} ${br.p}
    L ${width} ${height - br.p}
    ${br.pathSegment("BR")}
    L ${width - bl.p} ${height}
    L ${bl.p} ${height}
    ${bl.pathSegment("BL")}
    L 0 ${height - tl.p}
    L 0 ${tl.p}
    ${tl.pathSegment("TL")}
    Z
  `
    .replace(/[\t\s\n]+/g, " ")
    .trim();
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
