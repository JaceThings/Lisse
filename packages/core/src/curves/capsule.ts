import { fixed4 } from "../utils.js";
import { getPathParamsForCorner } from "../corner-params.js";
import { negated } from "./orient.js";

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

/**
 * The nine magnitudes a cap emits, formatted once in both signs. The four
 * caps are the same figure mirrored end-to-end and transposed, so each one
 * spelled these nine numbers out over eighteen `fixed4` calls.
 *
 * Interior control zeros stay literal so they print `0` (like the squircle
 * drawers), keeping the arc's straight seam noise-free — as do the `0 0 1`
 * arc flags.
 */
interface CapText {
  /** Shoulder cubic deltas `a`, `a + b`, and the full shoulder run `e`. */
  a: string;
  an: string;
  ab: string;
  abn: string;
  e: string;
  en: string;
  /** Mirrored-shoulder deltas `c`, `b + c`, and the cross-axis rise `d`. */
  c: string;
  cn: string;
  bc: string;
  bcn: string;
  d: string;
  dn: string;
  /** Arc radius — both radius slots of both `a` commands, never signed. */
  r: string;
  /** Arc chords along and across the long axis. */
  ax: string;
  axn: string;
  ay: string;
  ayn: string;
}

function capText({ a, b, c, d, e, ax, ay, R }: CapsuleEndParams): CapText {
  const ab = a + b;
  const bc = b + c;
  const fa = fixed4(a);
  const fab = fixed4(ab);
  const fe = fixed4(e);
  const fc = fixed4(c);
  const fbc = fixed4(bc);
  const fd = fixed4(d);
  const fax = fixed4(ax);
  const fay = fixed4(ay);
  return {
    a: fa,
    an: negated(a, fa),
    ab: fab,
    abn: negated(ab, fab),
    e: fe,
    en: negated(e, fe),
    c: fc,
    cn: negated(c, fc),
    bc: fbc,
    bcn: negated(bc, fbc),
    d: fd,
    dn: negated(d, fd),
    r: fixed4(R),
    ax: fax,
    axn: negated(ax, fax),
    ay: fay,
    ayn: negated(ay, fay),
  };
}

/** Right cap: (width−p, 0) → (width−p, height). */
export function drawRightCap(params: CapsuleEndParams): string {
  const t = capText(params);
  return `c ${t.a} 0 ${t.ab} 0 ${t.e} ${t.d} a ${t.r} ${t.r} 0 0 1 ${t.ax} ${t.ay} a ${t.r} ${t.r} 0 0 1 ${t.axn} ${t.ay} c ${t.cn} ${t.d} ${t.bcn} ${t.d} ${t.en} ${t.d}`;
}

/** Left cap: (p, height) → (p, 0). */
export function drawLeftCap(params: CapsuleEndParams): string {
  const t = capText(params);
  return `c ${t.an} 0 ${t.abn} 0 ${t.en} ${t.dn} a ${t.r} ${t.r} 0 0 1 ${t.axn} ${t.ayn} a ${t.r} ${t.r} 0 0 1 ${t.ax} ${t.ayn} c ${t.c} ${t.dn} ${t.bc} ${t.dn} ${t.e} ${t.dn}`;
}

/** Top cap: (0, p) → (width, p). */
export function drawTopCap(params: CapsuleEndParams): string {
  const t = capText(params);
  return `c 0 ${t.an} 0 ${t.abn} ${t.d} ${t.en} a ${t.r} ${t.r} 0 0 1 ${t.ay} ${t.axn} a ${t.r} ${t.r} 0 0 1 ${t.ay} ${t.ax} c ${t.d} ${t.c} ${t.d} ${t.bc} ${t.d} ${t.e}`;
}

/** Bottom cap: (width, height−p) → (0, height−p). */
export function drawBottomCap(params: CapsuleEndParams): string {
  const t = capText(params);
  return `c 0 ${t.a} 0 ${t.ab} ${t.dn} ${t.e} a ${t.r} ${t.r} 0 0 1 ${t.ayn} ${t.ax} a ${t.r} ${t.r} 0 0 1 ${t.ayn} ${t.axn} c ${t.dn} ${t.cn} ${t.dn} ${t.bcn} ${t.dn} ${t.en}`;
}
