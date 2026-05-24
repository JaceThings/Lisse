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
 * Returns a fresh tuple. Allocates per call — for hot paths, use the
 * `transformX` / `transformY` pair which return scalars and let V8
 * keep the loop allocation-free.
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

/** dx component of `transformXY(X, Y, orient)`. Inline-friendly. */
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

/** dy component of `transformXY(X, Y, orient)`. Inline-friendly. */
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
