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

/** SVG path `d` string for a smooth-cornered rectangle. */
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

  // Each side ends with a paired L to the next corner's `p` — geometrically
  // a no-op when adjacent radii match, harmless otherwise. Round every
  // coordinate to 4 decimals so output is bit-stable across Node /
  // browser engines (Math.sin/cos can vary by 1 ULP between V8 builds,
  // and the inner pathSegments are already rounded to the same precision).
  const r = (n: number): string => n.toFixed(4);
  return `
    M ${r(tl.p)} 0
    L ${r(width - tr.p)} 0
    ${tr.pathSegment("TR")}
    L ${r(width)} ${r(br.p)}
    L ${r(width)} ${r(height - br.p)}
    ${br.pathSegment("BR")}
    L ${r(width - bl.p)} ${r(height)}
    L ${r(bl.p)} ${r(height)}
    ${bl.pathSegment("BL")}
    L 0 ${r(height - tl.p)}
    L 0 ${r(tl.p)}
    ${tl.pathSegment("TL")}
    Z
  `
    .replace(/[\t\s\n]+/g, " ")
    .trim();
}

/** CSS `clip-path: path(...)` value for a smooth-cornered rectangle. */
export function generateClipPath(
  width: number,
  height: number,
  options: SmoothCornerOptions
): string {
  return `path("${generatePath(width, height, options)}")`;
}
