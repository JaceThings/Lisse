import { fixed4 } from "../utils.js";
import type { Orient } from "./types.js";

/**
 * Rotate a canonical (X = entry direction, Y = exit direction) delta into
 * the display (dx, dy) for `orient`, clockwise:
 *
 *   TR — enter +x, exit +y      BL — enter −x, exit −y
 *   BR — enter +y, exit −x      TL — enter −y, exit +x
 *
 * Every orient puts ±X and ±Y in the two slots, so the four corners of a
 * shape emit the *same* magnitudes — only the slot and the sign differ.
 * Formatting per orient therefore did the same work four times over (72
 * `fixed4` calls for a superellipse corner, 56 for a squircle). Instead a
 * builder formats each magnitude once into a `…Text` record, in both signs,
 * and the emitters below only pick strings.
 */

/**
 * The `fixed4` string for `-v`, derived from `v`'s own string instead of a
 * second format call.
 *
 * Two values do not flip textually and must come back unchanged.
 * `(-0).toFixed(4)` is `"0.0000"`, not `"-0.0000"` — zero-radius corners and
 * fully-consumed shoulders produce exact zeros. `(-NaN).toFixed(4)` is
 * `"NaN"`, not `"-NaN"` — a NaN radius reaches the builders unclamped.
 *
 * Everything else is an exact sign flip, *including* magnitudes below
 * 0.00005: the sign is taken before the rounding, so `(-0.00004).toFixed(4)`
 * is `"-0.0000"` and keying this guard on the string `"0.0000"` rather than
 * on `v === 0` would silently drop the minus off small-radius corners.
 */
export function negated(v: number, formatted: string): string {
  if (v === 0 || Number.isNaN(v)) return formatted;
  // 45 = "-". Already-negative magnitudes (a shoulder can overshoot into one)
  // flip by dropping the sign rather than doubling it.
  return formatted.charCodeAt(0) === 45 ? formatted.slice(1) : "-" + formatted;
}

/**
 * One relative cubic's three control deltas in canonical (X, Y) form,
 * pre-formatted in both signs — `x1n` is the string for `-x1`.
 */
export interface CubicText {
  x1: string;
  x1n: string;
  y1: string;
  y1n: string;
  x2: string;
  x2n: string;
  y2: string;
  y2n: string;
  x3: string;
  x3n: string;
  y3: string;
  y3n: string;
}

export function cubicText(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number
): CubicText {
  const fx1 = fixed4(x1);
  const fy1 = fixed4(y1);
  const fx2 = fixed4(x2);
  const fy2 = fixed4(y2);
  const fx3 = fixed4(x3);
  const fy3 = fixed4(y3);
  return {
    x1: fx1,
    x1n: negated(x1, fx1),
    y1: fy1,
    y1n: negated(y1, fy1),
    x2: fx2,
    x2n: negated(x2, fx2),
    y2: fy2,
    y2n: negated(y2, fy2),
    x3: fx3,
    x3n: negated(x3, fx3),
    y3: fy3,
    y3n: negated(y3, fy3),
  };
}

/** Relative `c` command for `t` rotated into `orient`. */
export function cubic(t: CubicText, orient: Orient): string {
  switch (orient) {
    case "TR":
      return `c ${t.x1} ${t.y1} ${t.x2} ${t.y2} ${t.x3} ${t.y3}`;
    case "BR":
      return `c ${t.y1n} ${t.x1} ${t.y2n} ${t.x2} ${t.y3n} ${t.x3}`;
    case "BL":
      return `c ${t.x1n} ${t.y1n} ${t.x2n} ${t.y2n} ${t.x3n} ${t.y3n}`;
    case "TL":
      return `c ${t.y1} ${t.x1n} ${t.y2} ${t.x2n} ${t.y3} ${t.x3n}`;
  }
}

/**
 * A 90° clockwise `a` command with equal x/y radii whose sweep delta has the
 * same magnitude on both axes — the quarter-circle corner and the clothoid's
 * central arc.
 */
export interface EqualArcText {
  /** Both radius slots; an arc radius is never signed. */
  radius: string;
  /** The sweep delta, in both signs. */
  d: string;
  dn: string;
}

export function equalArc(t: EqualArcText, orient: Orient): string {
  switch (orient) {
    case "TR":
      return `a ${t.radius} ${t.radius} 0 0 1 ${t.d} ${t.d}`;
    case "BR":
      return `a ${t.radius} ${t.radius} 0 0 1 ${t.dn} ${t.d}`;
    case "BL":
      return `a ${t.radius} ${t.radius} 0 0 1 ${t.dn} ${t.dn}`;
    case "TL":
      return `a ${t.radius} ${t.radius} 0 0 1 ${t.d} ${t.dn}`;
  }
}
