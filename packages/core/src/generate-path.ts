import type { SmoothCornerOptions, CornerConfig, CurveType } from "./types.js";
import { distributeAndNormalize } from "./distribute.js";
import { getCurveBuilder, DEFAULT_EXPONENT } from "./curves/index.js";
import { getCachedBuilderOutput } from "./curves/cache.js";
import {
  capsuleEndParams,
  drawRightCap,
  drawLeftCap,
  drawTopCap,
  drawBottomCap,
} from "./curves/capsule.js";
import { drawBlendPath } from "./curves/blend.js";

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
    return getCachedBuilderOutput(corner.curve, builder, {
      cornerRadius: normalized[name].radius,
      smoothing: corner.smoothing,
      exponent: corner.exponent,
      preserveSmoothing: corner.preserveSmoothing,
      roundingAndSmoothingBudget: normalized[name].roundingAndSmoothingBudget,
    });
  };

  // Lazy: the blend and cap branches below return without touching some (or
  // any) corners — ~18% of a blend/capsule call was spent building outputs
  // that were then discarded. Memoised so the template still computes each
  // corner once.
  const lazyOut = (name: keyof ResolvedCorners) => {
    let v: ReturnType<typeof builderOutFor> | undefined;
    return () => (v ??= builderOutFor(name));
  };
  const tl = lazyOut("topLeft");
  const tr = lazyOut("topRight");
  const br = lazyOut("bottomRight");
  const bl = lazyOut("bottomLeft");

  const r = (n: number): string => n.toFixed(4);
  const seg = (s: string): string => (s.length > 0 ? " " + s : "");

  // Blend regime: a uniform squircle (all four corners identical) whose short
  // side falls strictly between 2R and 2(1+s)R. The classic template below
  // would compress smoothing symmetrically here — a visible pop while resizing
  // toward the capsule — so instead give each corner per-edge smoothing (see
  // curves/blend.ts). Outside this band the pure regimes are untouched: the
  // unclamped squircle (short side ≥ 2(1+s)R) falls through to the byte-
  // identical template, the full capsule (short side = 2R) to the capsule path.
  const u = corners.topLeft;
  if (isUniformSquircle(corners)) {
    const blendR = Math.min(u.radius, width / 2, height / 2);
    const shortHalf = Math.min(width, height) / 2;
    // Strict bounds keep the pure regimes' exact byte output at both edges.
    const BAND_EPS = 1e-9;
    if (
      blendR > 0 &&
      shortHalf > blendR + BAND_EPS &&
      shortHalf < (1 + u.smoothing) * blendR - BAND_EPS
    ) {
      return drawBlendPath(width, height, blendR, u.smoothing, u.preserveSmoothing);
    }
  }

  // Sketch-style capsule smoothing: an end whose two short-axis corners are
  // both fully rounded (radius = short-axis/2), squircle, and share smoothing
  // becomes one continuous cap segment. The opposite end is independent, so a
  // half-pill (one cap, one plain corner pair) works too. Non-capsule ends
  // fall through to the byte-identical template below.
  const EPS = 1e-9;
  const horizontal = width >= height;
  const capR = horizontal ? height / 2 : width / 2;
  const isCap = (
    x: keyof ResolvedCorners,
    y: keyof ResolvedCorners
  ): boolean => {
    const cx = corners[x];
    const cy = corners[y];
    return (
      cx.curve === "squircle" &&
      cy.curve === "squircle" &&
      Math.abs(normalized[x].radius - capR) < EPS &&
      Math.abs(normalized[y].radius - capR) < EPS &&
      cx.smoothing === cy.smoothing &&
      cx.preserveSmoothing === cy.preserveSmoothing
    );
  };

  if (horizontal) {
    const rightCap = isCap("topRight", "bottomRight");
    const leftCap = isCap("topLeft", "bottomLeft");
    if (rightCap || leftCap) {
      const longHalf = width / 2;
      const cR = rightCap
        ? capsuleEndParams(capR, corners.topRight.smoothing, corners.topRight.preserveSmoothing, longHalf)
        : null;
      const cL = leftCap
        ? capsuleEndParams(capR, corners.topLeft.smoothing, corners.topLeft.preserveSmoothing, longHalf)
        : null;

      let d = "M " + r(cL ? cL.p : tl().p) + " 0";
      d += " L " + r(width - (cR ? cR.p : tr().p)) + " 0";
      if (cR) {
        d += " " + drawRightCap(cR);
      } else {
        d += seg(tr().pathSegment("TR"));
        d += " L " + r(width) + " " + r(br().p);
        d += " L " + r(width) + " " + r(height - br().p);
        d += seg(br().pathSegment("BR"));
      }
      if (cL) {
        d += " L " + r(cL.p) + " " + r(height);
        d += " " + drawLeftCap(cL);
      } else {
        d += " L " + r(width - bl().p) + " " + r(height);
        d += " L " + r(bl().p) + " " + r(height);
        d += seg(bl().pathSegment("BL"));
        d += " L 0 " + r(height - tl().p);
        d += " L 0 " + r(tl().p);
        d += seg(tl().pathSegment("TL"));
      }
      return d + " Z";
    }
  } else {
    const topCap = isCap("topLeft", "topRight");
    const bottomCap = isCap("bottomLeft", "bottomRight");
    if (topCap || bottomCap) {
      const longHalf = height / 2;
      const cT = topCap
        ? capsuleEndParams(capR, corners.topLeft.smoothing, corners.topLeft.preserveSmoothing, longHalf)
        : null;
      const cB = bottomCap
        ? capsuleEndParams(capR, corners.bottomLeft.smoothing, corners.bottomLeft.preserveSmoothing, longHalf)
        : null;

      let d: string;
      if (cT) {
        d = "M 0 " + r(cT.p) + " " + drawTopCap(cT);
      } else {
        d = "M " + r(tl().p) + " 0";
        d += " L " + r(width - tr().p) + " 0";
        d += seg(tr().pathSegment("TR"));
      }
      d += " L " + r(width) + " " + r(height - (cB ? cB.p : br().p));
      if (cB) {
        d += " " + drawBottomCap(cB);
      } else {
        d += seg(br().pathSegment("BR"));
        d += " L " + r(bl().p) + " " + r(height);
        d += seg(bl().pathSegment("BL"));
      }
      if (cT) {
        d += " L 0 " + r(cT.p);
      } else {
        d += " L 0 " + r(height - tl().p);
        d += " L 0 " + r(tl().p);
        d += seg(tl().pathSegment("TL"));
      }
      return d + " Z";
    }
  }

  // Each side ends with a paired L to the next corner's `p` — geometrically
  // a no-op when adjacent radii match, harmless otherwise. Direct concat
  // avoids a per-call template + whitespace regex pass; `r()` rounds each
  // coordinate to 4 decimals so output is bit-stable across Node / browser
  // engines (Math.sin/cos vary by 1 ULP between V8 builds, and the inner
  // pathSegments are already rounded to the same precision). `seg()` skips
  // the leading space for empty corner segments (radius=0) so we never
  // emit double-spaces.
  return (
    "M " + r(tl().p) + " 0" +
    " L " + r(width - tr().p) + " 0" +
    seg(tr().pathSegment("TR")) +
    " L " + r(width) + " " + r(br().p) +
    " L " + r(width) + " " + r(height - br().p) +
    seg(br().pathSegment("BR")) +
    " L " + r(width - bl().p) + " " + r(height) +
    " L " + r(bl().p) + " " + r(height) +
    seg(bl().pathSegment("BL")) +
    " L 0 " + r(height - tl().p) +
    " L 0 " + r(tl().p) +
    seg(tl().pathSegment("TL")) +
    " Z"
  );
}

function isUniformSquircle(c: ResolvedCorners): boolean {
  const u = c.topLeft;
  return (
    u.curve === "squircle" &&
    [c.topRight, c.bottomRight, c.bottomLeft].every(
      (o) =>
        o.curve === "squircle" &&
        o.radius === u.radius &&
        o.smoothing === u.smoothing &&
        o.preserveSmoothing === u.preserveSmoothing
    )
  );
}

/** CSS `clip-path: path(...)` value for a smooth-cornered rectangle. */
export function generateClipPath(
  width: number,
  height: number,
  options: SmoothCornerOptions
): string {
  return `path("${generatePath(width, height, options)}")`;
}
