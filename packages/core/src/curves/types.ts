import type { CurveType } from "../types.js";

export type { CurveType };

/**
 * One of four corner orientations as the path traverses the rectangle
 * clockwise. Each builder's path segment is parameterised by the
 * orientation so the same canonical (entry → exit) curve can be drawn
 * at any corner without re-deriving the math.
 */
export type Orient = "TR" | "BR" | "BL" | "TL";

/**
 * Input to a curve builder. `cornerRadius` is the post-distribute radius
 * (already clamped to the rectangle). `roundingAndSmoothingBudget` is the
 * post-distribute side budget — how much of the adjacent edge this corner
 * is allowed to consume.
 */
export interface CurveBuilderInput {
  cornerRadius: number;
  smoothing: number;
  exponent: number;
  preserveSmoothing: boolean;
  roundingAndSmoothingBudget: number;
}

/**
 * Output of a curve builder. `p` is the tangency distance from the sharp
 * corner vertex — i.e. how far back along each adjacent edge the curve
 * starts. The straight-edge stitcher uses `p` to know where one curve
 * ends and the next straight `L` begins.
 *
 * `pathSegment(orient)` returns the SVG path commands for the curve in
 * relative form (lowercase `c`, `a`, `l`), starting at the entry tangency
 * point (the caller's current pen position) and ending at the exit
 * tangency point.
 */
export interface CurveBuilderOutput {
  p: number;
  pathSegment: (orient: Orient) => string;
}

export type CurveBuilder = (input: CurveBuilderInput) => CurveBuilderOutput;
