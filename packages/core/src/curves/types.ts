import type { CurveType } from "../types.js";

export type { CurveType };

/**
 * Corner orientation in clockwise traversal. Each builder writes a
 * canonical (entry → exit) curve and is rotated to a corner via `orient`,
 * so the math is derived once.
 */
export type Orient = "TR" | "BR" | "BL" | "TL";

/**
 * `cornerRadius` and `roundingAndSmoothingBudget` are both post-distribute:
 * the radius is already clamped to the rectangle, and the budget is how
 * much of the adjacent edge this corner may consume.
 */
export interface CurveBuilderInput {
  cornerRadius: number;
  smoothing: number;
  exponent: number;
  preserveSmoothing: boolean;
  roundingAndSmoothingBudget: number;
}

/**
 * `p` is the tangency distance from the sharp vertex — where the curve
 * starts along each adjacent edge. The stitcher uses it to place the
 * straight `L` between corners. `pathSegment(orient)` returns SVG
 * commands in relative form, entering at the current pen position and
 * exiting at the opposite tangency point.
 */
export interface CurveBuilderOutput {
  p: number;
  pathSegment: (orient: Orient) => string;
}

export type CurveBuilder = (input: CurveBuilderInput) => CurveBuilderOutput;
