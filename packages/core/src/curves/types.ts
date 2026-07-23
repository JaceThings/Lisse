import type { CurveType } from "../types.js";

export type { CurveType };

/**
 * Corner orientation in clockwise traversal. Builders write one canonical
 * (entry → exit) curve, rotated to each corner via `orient`.
 */
export type Orient = "TR" | "BR" | "BL" | "TL";

/**
 * Both `cornerRadius` and `roundingAndSmoothingBudget` are post-distribute:
 * the radius is already clamped to the rectangle, the budget is how much of
 * the adjacent edge this corner may consume.
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
 * starts along each adjacent edge; the stitcher uses it to place the
 * straight `L` between corners. `pathSegment(orient)` returns relative SVG
 * commands, entering at the pen and exiting at the opposite tangency point.
 */
export interface CurveBuilderOutput {
  p: number;
  pathSegment: (orient: Orient) => string;
}

export type CurveBuilder = (input: CurveBuilderInput) => CurveBuilderOutput;

/** Shared zero-radius output for a non-positive corner footprint. The
 *  `pathSegment` is a static reference, so reuse stays allocation-free. */
export const EMPTY_BUILDER_OUTPUT: CurveBuilderOutput = {
  p: 0,
  pathSegment: () => "",
};
