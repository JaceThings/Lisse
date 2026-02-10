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

export interface CornerPathParams {
  a: number;
  b: number;
  c: number;
  d: number;
  p: number;
  cornerRadius: number;
  arcSectionLength: number;
}

export interface CornerParams {
  cornerRadius: number;
  cornerSmoothing: number;
  preserveSmoothing: boolean;
  roundingAndSmoothingBudget: number;
}

export interface NormalizedCorner {
  radius: number;
  roundingAndSmoothingBudget: number;
}

export interface NormalizedCorners {
  topLeft: NormalizedCorner;
  topRight: NormalizedCorner;
  bottomLeft: NormalizedCorner;
  bottomRight: NormalizedCorner;
}

export type Corner = keyof NormalizedCorners;

export type Side = "top" | "left" | "right" | "bottom";

export interface Adjacent {
  side: Side;
  corner: Corner;
}

export interface RoundedRectangle {
  topLeftCornerRadius: number;
  topRightCornerRadius: number;
  bottomRightCornerRadius: number;
  bottomLeftCornerRadius: number;
  width: number;
  height: number;
}
