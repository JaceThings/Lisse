import { rounded } from "../utils.js";
import { getPathParamsForCorner } from "../corner-params.js";

/**
 * Sketch-style capsule smoothing. A capsule end cap is the Figma squircle
 * shoulder applied on the flat-edge side only, with the circular arc carried
 * to the cap midline: shoulder cubic → arc → arc → mirrored shoulder cubic,
 * one continuous segment per end. Reuses `getPathParamsForCorner` verbatim so
 * the shoulder math is identical to the squircle corner.
 */
export interface CapsuleEndParams {
  p: number;
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  /** Arc chord along the long axis, `p − e = R·(1 − sinβ)`. */
  ax: number;
  /** Arc chord toward the midline, `R − d = R·cosβ`. */
  ay: number;
  R: number;
}

/**
 * `longHalf` is each end's share of the long axis — ponytail: half the long
 * side, conservative when the opposite end is smaller.
 */
export function capsuleEndParams(
  R: number,
  smoothing: number,
  preserveSmoothing: boolean,
  longHalf: number
): CapsuleEndParams {
  // The flat edge absorbs all smoothing; when it has no room (near-square) s
  // collapses so the cap stays a true circle. This is the !preserveSmoothing
  // clamp applied unconditionally — with it p never exceeds the budget, so the
  // preserveSmoothing compression branch is moot and β stays consistent.
  const sEff = Math.min(smoothing, longHalf / R - 1);
  const params = getPathParamsForCorner({
    cornerRadius: R,
    cornerSmoothing: sEff,
    preserveSmoothing,
    roundingAndSmoothingBudget: longHalf,
  });
  const e = params.a + params.b + params.c;
  return {
    p: params.p,
    a: params.a,
    b: params.b,
    c: params.c,
    d: params.d,
    e,
    ax: params.p - e,
    ay: R - params.d,
    R,
  };
}

// Interior control zeros are literal so they print `0` (like the squircle
// drawers), keeping the arc's straight seam noise-free.

/** Right cap: (width−p, 0) → (width−p, height). */
export function drawRightCap({ a, b, c, d, e, ax, ay, R }: CapsuleEndParams): string {
  return rounded`c ${a} 0 ${a + b} 0 ${e} ${d} a ${R} ${R} 0 0 1 ${ax} ${ay} a ${R} ${R} 0 0 1 ${-ax} ${ay} c ${-c} ${d} ${-(b + c)} ${d} ${-e} ${d}`;
}

/** Left cap: (p, height) → (p, 0). */
export function drawLeftCap({ a, b, c, d, e, ax, ay, R }: CapsuleEndParams): string {
  return rounded`c ${-a} 0 ${-(a + b)} 0 ${-e} ${-d} a ${R} ${R} 0 0 1 ${-ax} ${-ay} a ${R} ${R} 0 0 1 ${ax} ${-ay} c ${c} ${-d} ${b + c} ${-d} ${e} ${-d}`;
}

/** Top cap: (0, p) → (width, p). */
export function drawTopCap({ a, b, c, d, e, ax, ay, R }: CapsuleEndParams): string {
  return rounded`c 0 ${-a} 0 ${-(a + b)} ${d} ${-e} a ${R} ${R} 0 0 1 ${ay} ${-ax} a ${R} ${R} 0 0 1 ${ay} ${ax} c ${d} ${c} ${d} ${b + c} ${d} ${e}`;
}

/** Bottom cap: (width, height−p) → (0, height−p). */
export function drawBottomCap({ a, b, c, d, e, ax, ay, R }: CapsuleEndParams): string {
  return rounded`c 0 ${a} 0 ${a + b} ${-d} ${e} a ${R} ${R} 0 0 1 ${-ay} ${ax} a ${R} ${R} 0 0 1 ${-ay} ${-ax} c ${-d} ${-c} ${-d} ${-(b + c)} ${-d} ${-e}`;
}
