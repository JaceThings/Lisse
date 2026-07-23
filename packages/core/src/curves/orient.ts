import type { Orient } from "./types.js";

/**
 * Rotate a canonical (X = entry direction, Y = exit direction) delta into
 * the display (dx, dy) for `orient`, clockwise:
 *
 *   TR — enter +x, exit +y      BL — enter −x, exit −y
 *   BR — enter +y, exit −x      TL — enter −y, exit +x
 *
 * Scalar return (not a tuple) keeps the hot loops allocation-free.
 */
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
