import type { Orient } from "./types.js";

/**
 * Transform a canonical (X, Y) delta into a display (dx, dy) delta for
 * the given corner orientation.
 *
 * Canonical frame: X = distance along entry direction, Y = distance
 * along exit direction. The path traverses the rectangle clockwise, so:
 *
 *   TR — enter going right (+x), exit going down (+y)
 *   BR — enter going down (+y), exit going left (−x)
 *   BL — enter going left (−x), exit going up (−y)
 *   TL — enter going up (−y), exit going right (+x)
 */
export function transformXY(X: number, Y: number, orient: Orient): [number, number] {
  switch (orient) {
    case "TR":
      return [X, Y];
    case "BR":
      return [-Y, X];
    case "BL":
      return [-X, -Y];
    case "TL":
      return [Y, -X];
  }
}
