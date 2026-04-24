import type { CornerParams, CornerPathParams } from "./types.js";
import { toRadians } from "./utils.js";

/**
 * Compute bezier curve parameters for a single corner.
 *
 * Based on Figma's squircle blog post and MartinRGB's approximation:
 * https://www.figma.com/blog/desperately-seeking-squircles/
 * https://github.com/MartinRGB/Figma_Squircles_Approximation
 */
export function getPathParamsForCorner({
  cornerRadius,
  cornerSmoothing,
  preserveSmoothing,
  roundingAndSmoothingBudget,
}: CornerParams): CornerPathParams {
  // Short-circuit at zero radius: otherwise the `!preserveSmoothing` branch divides by `cornerRadius` and returns NaN fields.
  if (cornerRadius <= 0) {
    return { a: 0, b: 0, c: 0, d: 0, p: 0, arcSectionLength: 0, cornerRadius: 0 };
  }

  // From figure 12.2: p = (1 + cornerSmoothing) * q, where q = R (theta = 90deg)
  let p = (1 + cornerSmoothing) * cornerRadius;

  if (!preserveSmoothing) {
    const maxCornerSmoothing =
      roundingAndSmoothingBudget / cornerRadius - 1;
    cornerSmoothing = Math.min(cornerSmoothing, maxCornerSmoothing);
    p = Math.min(p, roundingAndSmoothingBudget);
  }

  // Arc measure shrinks as smoothing increases
  const arcMeasure = 90 * (1 - cornerSmoothing);
  const arcSectionLength =
    Math.sin(toRadians(arcMeasure / 2)) * cornerRadius * Math.sqrt(2);

  // Distance between control points P3 and P4
  const angleAlpha = (90 - arcMeasure) / 2;
  const p3ToP4Distance = cornerRadius * Math.tan(toRadians(angleAlpha / 2));

  // a, b, c, d from figure 11.1
  const angleBeta = 45 * cornerSmoothing;
  const c = p3ToP4Distance * Math.cos(toRadians(angleBeta));
  const d = c * Math.tan(toRadians(angleBeta));

  let b = (p - arcSectionLength - c - d) / 3;
  let a = 2 * b;

  // Adjust P1/P2 control points when space is limited
  if (preserveSmoothing && p > roundingAndSmoothingBudget) {
    const p1ToP3MaxDistance =
      roundingAndSmoothingBudget - d - arcSectionLength - c;

    const minA = p1ToP3MaxDistance / 6;
    const maxB = p1ToP3MaxDistance - minA;

    b = Math.min(b, maxB);
    a = p1ToP3MaxDistance - b;
    p = Math.min(p, roundingAndSmoothingBudget);
  }

  return { a, b, c, d, p, arcSectionLength, cornerRadius };
}
