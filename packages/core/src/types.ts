/** Configuration for a single corner. */
export interface CornerConfig {
  radius: number;
  /** Smoothing amount from 0 (sharp) to 1 (maximum). Default: 0.6 */
  smoothing?: number;
  /** When true, preserves smoothing even when space is limited. Default: true */
  preserveSmoothing?: boolean;
}

/** Per-corner configuration. Each corner can be a CornerConfig or a number (radius shorthand). */
export interface PerCornerConfig {
  topLeft?: CornerConfig | number;
  topRight?: CornerConfig | number;
  bottomRight?: CornerConfig | number;
  bottomLeft?: CornerConfig | number;
}

/** Uniform corner options — all corners share the same values. */
export interface UniformCornerOptions {
  radius: number;
  /** Smoothing amount from 0 (sharp) to 1 (maximum). Default: 0.6 */
  smoothing?: number;
  /** When true, preserves smoothing even when space is limited. Default: true */
  preserveSmoothing?: boolean;
}

/** Options for generating a smooth-corners path. */
export type SmoothCornerOptions = UniformCornerOptions | PerCornerConfig;

// --- Internal types ---

/** Resolved arc parameters for drawing a single corner of the smooth path. */
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

/** Configuration for an inner or outer border stroke. */
export interface BorderConfig {
  width: number;
  color: string;
  opacity: number;
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
  innerShadow?: ShadowConfig;
  shadow?: ShadowConfig;
}
