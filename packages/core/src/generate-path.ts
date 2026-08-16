import type {
  SmoothCornerOptions,
  CornerConfig,
  CurveType,
  NormalizedCorner,
} from "./types.js";
import { distributeAndNormalize } from "./distribute.js";
import { getCurveBuilder, DEFAULT_EXPONENT } from "./curves/index.js";
import { getCachedBuilderOutput } from "./curves/cache.js";
import type { CurveBuilderOutput } from "./curves/types.js";
import {
  capsuleEndParams,
  drawRightCap,
  drawLeftCap,
  drawTopCap,
  drawBottomCap,
} from "./curves/capsule.js";
import { drawBlendPath } from "./curves/blend.js";
import { fixed4 } from "./utils.js";

/** Closest Figma-curve match to Apple continuous corners (≈0.5 px residual at R=100). */
export const APPLE_SMOOTHING = 0.65;

/** Figma's labeled "iOS" preset — use for design-handoff parity. */
export const FIGMA_SMOOTHING = 0.6;

/** Default smoothing — same value as `APPLE_SMOOTHING`. Use `FIGMA_SMOOTHING` for Figma's 60% preset. */
export const DEFAULT_SMOOTHING = 0.65;
export const DEFAULT_PRESERVE_SMOOTHING = true;
export const DEFAULT_CURVE: CurveType = "squircle";

/** Coordinate formatter for the path templates below, which call it ~26 times
 *  per build; module scope so no closure is allocated per `generatePath` call. */
const r = fixed4;

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

/** Prefix a corner's path segment with a space, or emit nothing for an empty
 *  segment (radius 0) so the `d` string never contains a double space. */
function seg(s: string): string {
  return s.length > 0 ? " " + s : "";
}

/** Cached builder output for one corner, keyed on its *normalized* radius and
 *  budget rather than the raw config. */
function cornerOutput(
  corner: Resolved,
  normalized: NormalizedCorner
): CurveBuilderOutput {
  const builder = getCurveBuilder(corner.curve);
  return getCachedBuilderOutput(corner.curve, builder, {
    cornerRadius: normalized.radius,
    smoothing: corner.smoothing,
    exponent: corner.exponent,
    preserveSmoothing: corner.preserveSmoothing,
    roundingAndSmoothingBudget: normalized.roundingAndSmoothingBudget,
  });
}

/** Slack allowed when deciding a corner's radius has reached the cap radius. */
const CAP_EPS = 1e-9;

/** True when the two corners of one end form a single continuous cap. */
function isCapEnd(
  cx: Resolved,
  cy: Resolved,
  nx: NormalizedCorner,
  ny: NormalizedCorner,
  capR: number
): boolean {
  return (
    cx.curve === "squircle" &&
    cy.curve === "squircle" &&
    Math.abs(nx.radius - capR) < CAP_EPS &&
    Math.abs(ny.radius - capR) < CAP_EPS &&
    cx.smoothing === cy.smoothing &&
    cx.preserveSmoothing === cy.preserveSmoothing
  );
}

/**
 * True when two corners feed the builder identical input, so a single cached
 * output can serve both orients.
 *
 * `resolveOptions` hands back one shared config object for the `{radius}` form
 * and `distributeAndNormalize` one shared normalized corner when all four radii
 * match, so reference identity answers the common case without reading a field.
 *
 * The raw `radius` is deliberately not compared: the builder only ever sees the
 * *normalized* radius, so two raw radii clamped to the same normalized value are
 * genuinely interchangeable. The normalized values must be compared, though —
 * `distributeAndNormalize` can give corners with identical configs different
 * budgets, and a different budget is a different corner shape.
 */
function sameBuilderInput(
  a: Resolved,
  an: NormalizedCorner,
  b: Resolved,
  bn: NormalizedCorner
): boolean {
  return (
    (a === b ||
      (a.curve === b.curve &&
        a.smoothing === b.smoothing &&
        a.exponent === b.exponent &&
        a.preserveSmoothing === b.preserveSmoothing)) &&
    (an === bn ||
      (an.radius === bn.radius &&
        an.roundingAndSmoothingBudget === bn.roundingAndSmoothingBudget))
  );
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

  // Corner outputs are resolved by the branch that needs them, not up front:
  // the blend branch below returns without touching any corner, and a capped
  // end discards both of its corners. ~18% of a blend/capsule call used to go
  // into building outputs that were then thrown away.

  // In the band 2R < short side < 2(1+s)R the classic template would pop while
  // resizing toward a capsule; curves/blend.ts smooths per-edge instead. Both
  // band edges fall through to the byte-identical pure regimes.
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

  // Sketch-style capsule smoothing: a fully-rounded end becomes one continuous
  // cap segment. Each end is independent (half-pills work); non-capsule ends
  // fall through to the byte-identical template below.
  const horizontal = width >= height;
  const capR = horizontal ? height / 2 : width / 2;

  if (horizontal) {
    const rightCap = isCapEnd(
      corners.topRight, corners.bottomRight,
      normalized.topRight, normalized.bottomRight, capR
    );
    const leftCap = isCapEnd(
      corners.topLeft, corners.bottomLeft,
      normalized.topLeft, normalized.bottomLeft, capR
    );
    if (rightCap || leftCap) {
      const longHalf = width / 2;
      const cR = rightCap
        ? capsuleEndParams(capR, corners.topRight.smoothing, corners.topRight.preserveSmoothing, longHalf)
        : null;
      const cL = leftCap
        ? capsuleEndParams(capR, corners.topLeft.smoothing, corners.topLeft.preserveSmoothing, longHalf)
        : null;

      // A capped end emits one cap segment, so only the uncapped end's corners
      // are built. Each `!` below sits inside the matching `cR`/`cL` guard.
      const oTL = cL ? null : cornerOutput(corners.topLeft, normalized.topLeft);
      const oTR = cR ? null : cornerOutput(corners.topRight, normalized.topRight);
      const oBR = cR ? null : cornerOutput(corners.bottomRight, normalized.bottomRight);
      const oBL = cL ? null : cornerOutput(corners.bottomLeft, normalized.bottomLeft);

      let d = "M " + r(cL ? cL.p : oTL!.p) + " 0";
      d += " L " + r(width - (cR ? cR.p : oTR!.p)) + " 0";
      if (cR) {
        d += " " + drawRightCap(cR);
      } else {
        d += seg(oTR!.pathSegment("TR"));
        d += " L " + r(width) + " " + r(oBR!.p);
        d += " L " + r(width) + " " + r(height - oBR!.p);
        d += seg(oBR!.pathSegment("BR"));
      }
      if (cL) {
        d += " L " + r(cL.p) + " " + r(height);
        d += " " + drawLeftCap(cL);
      } else {
        d += " L " + r(width - oBL!.p) + " " + r(height);
        d += " L " + r(oBL!.p) + " " + r(height);
        d += seg(oBL!.pathSegment("BL"));
        d += " L 0 " + r(height - oTL!.p);
        d += " L 0 " + r(oTL!.p);
        d += seg(oTL!.pathSegment("TL"));
      }
      return d + " Z";
    }
  } else {
    const topCap = isCapEnd(
      corners.topLeft, corners.topRight,
      normalized.topLeft, normalized.topRight, capR
    );
    const bottomCap = isCapEnd(
      corners.bottomLeft, corners.bottomRight,
      normalized.bottomLeft, normalized.bottomRight, capR
    );
    if (topCap || bottomCap) {
      const longHalf = height / 2;
      const cT = topCap
        ? capsuleEndParams(capR, corners.topLeft.smoothing, corners.topLeft.preserveSmoothing, longHalf)
        : null;
      const cB = bottomCap
        ? capsuleEndParams(capR, corners.bottomLeft.smoothing, corners.bottomLeft.preserveSmoothing, longHalf)
        : null;

      const oTL = cT ? null : cornerOutput(corners.topLeft, normalized.topLeft);
      const oTR = cT ? null : cornerOutput(corners.topRight, normalized.topRight);
      const oBR = cB ? null : cornerOutput(corners.bottomRight, normalized.bottomRight);
      const oBL = cB ? null : cornerOutput(corners.bottomLeft, normalized.bottomLeft);

      let d: string;
      if (cT) {
        d = "M 0 " + r(cT.p) + " " + drawTopCap(cT);
      } else {
        d = "M " + r(oTL!.p) + " 0";
        d += " L " + r(width - oTR!.p) + " 0";
        d += seg(oTR!.pathSegment("TR"));
      }
      d += " L " + r(width) + " " + r(height - (cB ? cB.p : oBR!.p));
      if (cB) {
        d += " " + drawBottomCap(cB);
      } else {
        d += seg(oBR!.pathSegment("BR"));
        d += " L " + r(oBL!.p) + " " + r(height);
        d += seg(oBL!.pathSegment("BL"));
      }
      if (cT) {
        d += " L 0 " + r(cT.p);
      } else {
        d += " L 0 " + r(height - oTL!.p);
        d += " L 0 " + r(oTL!.p);
        d += seg(oTL!.pathSegment("TL"));
      }
      return d + " Z";
    }
  }

  // Every corner contributes here, so all four resolve now. When they feed the
  // builder identical input, one lookup serves all four orients: four lookups
  // cost 0.383 µs building four cache keys and touching the LRU four times
  // against 0.094 µs for one — and they already returned this very object,
  // since an identical key is the same cache entry. The per-orient string memo
  // lives on the output, so each orient's segment stays independent.
  const oTL = cornerOutput(corners.topLeft, normalized.topLeft);
  const uniform =
    sameBuilderInput(corners.topLeft, normalized.topLeft, corners.topRight, normalized.topRight) &&
    sameBuilderInput(corners.topLeft, normalized.topLeft, corners.bottomRight, normalized.bottomRight) &&
    sameBuilderInput(corners.topLeft, normalized.topLeft, corners.bottomLeft, normalized.bottomLeft);
  const oTR = uniform ? oTL : cornerOutput(corners.topRight, normalized.topRight);
  const oBR = uniform ? oTL : cornerOutput(corners.bottomRight, normalized.bottomRight);
  const oBL = uniform ? oTL : cornerOutput(corners.bottomLeft, normalized.bottomLeft);

  // Each side ends with a paired L to the next corner's `p` — geometrically
  // a no-op when adjacent radii match, harmless otherwise. Direct concat
  // avoids a per-call template + whitespace regex pass; `r()` rounds each
  // coordinate to 4 decimals so output is bit-stable across Node / browser
  // engines (Math.sin/cos vary by 1 ULP between V8 builds, and the inner
  // pathSegments are already rounded to the same precision). `seg()` skips
  // the leading space for empty corner segments (radius=0) so we never
  // emit double-spaces.
  return (
    "M " + r(oTL.p) + " 0" +
    " L " + r(width - oTR.p) + " 0" +
    seg(oTR.pathSegment("TR")) +
    " L " + r(width) + " " + r(oBR.p) +
    " L " + r(width) + " " + r(height - oBR.p) +
    seg(oBR.pathSegment("BR")) +
    " L " + r(width - oBL.p) + " " + r(height) +
    " L " + r(oBL.p) + " " + r(height) +
    seg(oBL.pathSegment("BL")) +
    " L 0 " + r(height - oTL.p) +
    " L 0 " + r(oTL.p) +
    seg(oTL.pathSegment("TL")) +
    " Z"
  );
}

function isUniformSquircle(c: ResolvedCorners): boolean {
  const u = c.topLeft;
  const tr = c.topRight;
  const br = c.bottomRight;
  const bl = c.bottomLeft;
  return (
    u.curve === "squircle" &&
    tr.curve === "squircle" &&
    tr.radius === u.radius &&
    tr.smoothing === u.smoothing &&
    tr.preserveSmoothing === u.preserveSmoothing &&
    br.curve === "squircle" &&
    br.radius === u.radius &&
    br.smoothing === u.smoothing &&
    br.preserveSmoothing === u.preserveSmoothing &&
    bl.curve === "squircle" &&
    bl.radius === u.radius &&
    bl.smoothing === u.smoothing &&
    bl.preserveSmoothing === u.preserveSmoothing
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
