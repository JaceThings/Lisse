import { getPathParamsForCorner } from "../corner-params.js";
import { toRadians } from "../utils.js";

/**
 * The blend regime: a uniform squircle resized into the band where its short
 * side sits strictly between 2R and 2(1+s)R. The classic squircle clamps
 * smoothing symmetrically here (a visible pop while resizing toward a
 * capsule); instead each corner gets per-edge smoothing
 *
 *     s_edge = clamp(min(s, room_edge/R − 1), 0, s)
 *
 * so the roomy long edges keep full smoothing while the constrained short
 * edges give theirs up, and the outline moves ~1 px per 1 px of resize all the
 * way to the capsule limit. Both ends of the band are exact: both edges roomy
 * → the Figma squircle, one edge fully consumed → the Sketch capsule law.
 * The shoulder cubic per edge is the same figure-11.1 formula as the squircle
 * corner (verified identical to `getPathParamsForCorner` to ~3e-14).
 */

interface Shoulder {
  a: number;
  b: number;
  p: number;
  /** sin/cos of the shoulder→arc tangent angle `45°·s_edge`, computed once —
   *  seg() reads each four times per path. */
  sin: number;
  cos: number;
}

// s_edge is pre-clamped so p = (1+s_edge)R never exceeds `room`; the budget
// branches inside getPathParamsForCorner are therefore inert and the result
// matches the raw figure-11.1 cubic regardless of preserveSmoothing.
function shoulder(
  R: number,
  sEdge: number,
  preserveSmoothing: boolean,
  room: number
): Shoulder {
  const params = getPathParamsForCorner({
    cornerRadius: R,
    cornerSmoothing: sEdge,
    preserveSmoothing,
    roundingAndSmoothingBudget: room,
  });
  const beta = toRadians(45 * sEdge);
  return {
    a: params.a,
    b: params.b,
    p: params.p,
    sin: Math.sin(beta),
    cos: Math.cos(beta),
  };
}

const clampEdge = (room: number, R: number, s: number): number =>
  Math.max(0, Math.min(room / R - 1, s));

const r4 = (n: number): string => (Object.is(n, -0) ? 0 : n).toFixed(4);

/**
 * Full `d` string for a uniform-squircle rectangle in the blend band. `R` is
 * the effective radius `min(radius, width/2, height/2)`; the caller guarantees
 * the short side lies in `(2R, 2(1+s)R)`.
 */
export function drawBlendPath(
  width: number,
  height: number,
  R: number,
  smoothing: number,
  preserveSmoothing: boolean
): string {
  const H = shoulder(R, clampEdge(width / 2, R, smoothing), preserveSmoothing, width / 2);
  const V = shoulder(R, clampEdge(height / 2, R, smoothing), preserveSmoothing, height / 2);

  // One corner, oriented by unit axes: u points from the corner back along the
  // arrival edge, v along the departure edge. Horizontal edges use the width
  // shoulder H, vertical edges the height shoulder V. The arc runs between the
  // two shoulder→arc junctions j1, j2 on the corner's R-circle (centre o),
  // collapsing to nothing when the shoulders consume the full 90°. Emitted like
  // the other drawers: absolute `L` onto the shoulder start, then relative
  // cubic/arc/cubic, so the four corner deltas stay symmetric.
  const seg = (
    cx: number,
    cy: number,
    ux: number,
    uy: number,
    vx: number,
    vy: number
  ): string => {
    const s1 = uy === 0 ? H : V;
    const s2 = vy === 0 ? H : V;
    const ox = cx + (ux + vx) * R;
    const oy = cy + (uy + vy) * R;
    const j1x = ox - vx * R * s1.cos - ux * R * s1.sin;
    const j1y = oy - vy * R * s1.cos - uy * R * s1.sin;
    const j2x = ox - ux * R * s2.cos - vx * R * s2.sin;
    const j2y = oy - uy * R * s2.cos - vy * R * s2.sin;
    const p0x = cx + ux * s1.p;
    const p0y = cy + uy * s1.p;
    const arced = Math.hypot(j2x - j1x, j2y - j1y) > 1e-6;
    const ex = arced ? j2x : j1x;
    const ey = arced ? j2y : j1y;
    const p3x = cx + vx * s2.p;
    const p3y = cy + vy * s2.p;
    let d = `L ${r4(p0x)} ${r4(p0y)} `;
    d += `c ${r4(-ux * s1.a)} ${r4(-uy * s1.a)} ${r4(-ux * (s1.a + s1.b))} ${r4(-uy * (s1.a + s1.b))} ${r4(j1x - p0x)} ${r4(j1y - p0y)} `;
    if (arced) {
      d += `a ${r4(R)} ${r4(R)} 0 0 1 ${r4(j2x - j1x)} ${r4(j2y - j1y)} `;
    }
    d += `c ${r4(p3x - vx * (s2.a + s2.b) - ex)} ${r4(p3y - vy * (s2.a + s2.b) - ey)} ${r4(p3x - vx * s2.a - ex)} ${r4(p3y - vy * s2.a - ey)} ${r4(p3x - ex)} ${r4(p3y - ey)}`;
    return d;
  };

  // Corners clockwise from top-left; the path opens on the top edge.
  const tr = seg(width, 0, -1, 0, 0, 1);
  const br = seg(width, height, 0, -1, -1, 0);
  const bl = seg(0, height, 1, 0, 0, -1);
  const tl = seg(0, 0, 0, 1, 1, 0);
  return `M ${r4(H.p)} 0 ${tr} ${br} ${bl} ${tl} Z`;
}
