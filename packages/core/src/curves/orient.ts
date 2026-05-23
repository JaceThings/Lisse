import type { Orient } from "./types.js";

/**
 * Rotate a canonical (X = entry direction, Y = exit direction) delta into
 * the display (dx, dy) for `orient`. Clockwise traversal:
 *
 *   TR — enter +x, exit +y
 *   BR — enter +y, exit −x
 *   BL — enter −x, exit −y
 *   TL — enter −y, exit +x
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
