/** Corner curve family. Default: `'squircle'` (the Figma curve). */
export type CurveType = "arc" | "squircle" | "superellipse" | "clothoid";

/** Configuration for a single corner. */
export interface CornerConfig {
  radius: number;
  /** Curve family. Default: `'squircle'`. */
  curve?: CurveType;
  /** 0 (sharp) to 1 (max). Used by `'squircle'` and `'clothoid'`;
   *  ignored by `'arc'` and `'superellipse'`. Default: `0.6`. */
  smoothing?: number;
  /** Superellipse exponent, only when `curve === 'superellipse'`.
   *  Default: `4` (matches CSS `corner-shape: squircle`). */
  exponent?: number;
  /** Preserve smoothing when space is limited. Default: `true`. */
  preserveSmoothing?: boolean;
}

/** Per-corner configuration. Each corner can be a CornerConfig or a number (radius shorthand). */
export interface PerCornerConfig {
  topLeft?: CornerConfig | number;
  topRight?: CornerConfig | number;
  bottomRight?: CornerConfig | number;
  bottomLeft?: CornerConfig | number;
}

/** Options for generating a smooth-cornered path. */
export type SmoothCornerOptions = CornerConfig | PerCornerConfig;

// --- Internal types ---

/** Squircle-only resolved parameters (`a, b, c, d, p, arcSectionLength`).
 *  Implementation detail of the Figma squircle curve — not meaningful
 *  for arc / superellipse / clothoid. New code should treat this as
 *  the return shape of `getPathParamsForCorner` rather than
 *  constructing it directly. */
export interface CornerPathParams {
  a: number;
  b: number;
  c: number;
  d: number;
  p: number;
  cornerRadius: number;
  arcSectionLength: number;
}

/** Input parameters for computing a corner's path arcs. */
export interface CornerParams {
  cornerRadius: number;
  cornerSmoothing: number;
  preserveSmoothing: boolean;
  roundingAndSmoothingBudget: number;
}

/** A corner after radius distribution with its available budget. */
export interface NormalizedCorner {
  radius: number;
  roundingAndSmoothingBudget: number;
}

/** All four corners after radius distribution. */
export interface NormalizedCorners {
  topLeft: NormalizedCorner;
  topRight: NormalizedCorner;
  bottomLeft: NormalizedCorner;
  bottomRight: NormalizedCorner;
}

/** Union of the four corner names. */
export type Corner = keyof NormalizedCorners;

/** One of the four rectangle sides. */
export type Side = "top" | "left" | "right" | "bottom";

/** A side–corner pair describing an adjacent relationship. */
export interface Adjacent {
  side: Side;
  corner: Corner;
}

/** A rectangle with per-corner radii, used as input for radius distribution. */
export interface RoundedRectangle {
  topLeftCornerRadius: number;
  topRightCornerRadius: number;
  bottomRightCornerRadius: number;
  bottomLeftCornerRadius: number;
  width: number;
  height: number;
}

// --- Effects types ---

/** Supported border style values for SVG rendering. */
export type BorderStyle = "solid" | "dashed" | "dotted";

/** Configuration for an inner or outer border stroke. */
export interface BorderConfig {
  width: number;
  color: string;
  opacity: number;
  style?: BorderStyle;
  /** Custom dash length for dashed/dotted styles. */
  dash?: number;
  /** Custom gap length for dashed/dotted styles. */
  gap?: number;
  /** Line cap for dashed/dotted strokes. Default: "butt" for dashed, "round" for dotted. */
  lineCap?: "butt" | "round" | "square";
}

/** Configuration for an inner or drop shadow effect. */
export interface ShadowConfig {
  offsetX: number;
  offsetY: number;
  blur: number;
  spread: number;
  color: string;
  opacity: number;
}

/** Combined configuration for all visual effects applied to a smooth-cornered element. */
export interface EffectsConfig {
  innerBorder?: BorderConfig;
  outerBorder?: BorderConfig;
  middleBorder?: BorderConfig;
  innerShadow?: ShadowConfig | ShadowConfig[];
  shadow?: ShadowConfig | ShadowConfig[];
}
