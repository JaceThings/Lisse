import type { Orient } from "./types.js";

/**
 * Rotate a canonical (X = entry direction, Y = exit direction) delta into
 * the display (dx, dy) for `orient`. Clockwise traversal:
 *
 *   TR — enter +x, exit +y
 *   BR — enter +y, exit −x
 *   BL — enter −x, exit −y
 *   TL — enter −y, exit +x
 *
 * Returned as scalars (not a tuple) so V8 keeps the hot loops
 * allocation-free.
 */
/** dx component of the canonical → display rotation. */
export function transformX(X: number, Y: number, orient: Orient): number {
  switch (orient) {
    case "TR":
      return X;
    case "BR":
      return -Y;
    case "BL":
      return -X;
    case "TL":
      return Y;
  }
}

/** dy component of the canonical → display rotation. */
export function transformY(X: number, Y: number, orient: Orient): number {
  switch (orient) {
    case "TR":
      return Y;
    case "BR":
      return X;
    case "BL":
      return -Y;
    case "TL":
      return -X;
  }
}
