// Sketch-style capsule smoothing. Anchors verified numerically against a
// 101-SVG Sketch corpus (300×100, R=50); see research/capsules/parity.mjs.
import { describe, it, expect } from "vitest";
import svgpath from "svgpath";
import { generatePath } from "../src/generate-path.js";
import { getPathParamsForCorner } from "../src/corner-params.js";
import { drawBlendPath } from "../src/curves/blend.js";

/** Absolute, 4-decimal-rounded segment list. */
function segments(d: string): (string | number)[][] {
  return svgpath(d).abs().round(4).segments as unknown as (string | number)[][];
}

/** Flatten a path to a dense polyline (arcs → cubics via svgpath.unarc). */
function flatten(d: string, steps = 200): [number, number][] {
  const pts: [number, number][] = [];
  let cx = 0, cy = 0, sx = 0, sy = 0;
  const segs = svgpath(d).unarc().abs().segments as unknown as number[][] &
    (string | number)[][];
  for (const s of segs) {
    const cmd = s[0] as string;
    if (cmd === "M") {
      cx = s[1] as number; cy = s[2] as number; sx = cx; sy = cy;
      pts.push([cx, cy]);
    } else if (cmd === "L") {
      cx = s[1] as number; cy = s[2] as number; pts.push([cx, cy]);
    } else if (cmd === "C") {
      const x1 = s[1] as number, y1 = s[2] as number, x2 = s[3] as number,
        y2 = s[4] as number, x3 = s[5] as number, y3 = s[6] as number;
      for (let i = 1; i <= steps; i++) {
        const t = i / steps, u = 1 - t;
        pts.push([
          u * u * u * cx + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
          u * u * u * cy + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3,
        ]);
      }
      cx = x3; cy = y3;
    } else if (cmd === "Z") {
      pts.push([sx, sy]); cx = sx; cy = sy;
    }
  }
  return pts;
}

const distToSeg = (p: number[], a: number[], b: number[]): number => {
  const vx = b[0] - a[0], vy = b[1] - a[1];
  const len2 = vx * vx + vy * vy;
  let t = len2 > 0 ? ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + t * vx), p[1] - (a[1] + t * vy));
};

/** Max symmetric point-to-outline deviation between two flattened paths. */
function deviation(d1: string, d2: string, steps = 200): number {
  const a = flatten(d1, steps), b = flatten(d2, steps);
  const oneWay = (p: number[][], q: number[][]) => {
    let max = 0;
    for (const pt of p) {
      let min = Infinity;
      for (let i = 0; i + 1 < q.length; i++) min = Math.min(min, distToSeg(pt, q[i], q[i + 1]));
      max = Math.max(max, min);
    }
    return max;
  };
  return Math.max(oneWay(a, b), oneWay(b, a));
}

/** All [x, y] vertices touched by M / L / C / A endpoints (Z has none). */
function vertices(d: string): [number, number][] {
  return segments(d)
    .filter((s) => s[0] !== "Z")
    .map((s) => [s[s.length - 2] as number, s[s.length - 1] as number]);
}

const near = (a: number, b: number, eps = 1e-4) => Math.abs(a - b) < eps;

describe("capsule — horizontal 300×100 R=50", () => {
  it("s=0 is a plain capsule: p=R, pure semicircle caps, no shoulders", () => {
    const segs = segments(generatePath(300, 100, { radius: 50, smoothing: 0, curve: "squircle" }));
    // p = R = 50 → flat edge from 50 to 250.
    expect(segs[0]).toEqual(["M", 50, 0]);
    expect(segs[1]).toEqual(["L", 250, 0]);
    // Each cap is two R-arcs to the midline; shoulder cubics are degenerate.
    const arcs = segs.filter((s) => s[0] === "A");
    expect(arcs).toHaveLength(4);
    // Right cap arcs land on the midline point (300, 50).
    expect(near(arcs[0][6] as number, 300) && near(arcs[0][7] as number, 50)).toBe(true);
  });

  it("s=0.5 matches the Sketch reference control points", () => {
    const segs = segments(generatePath(300, 100, { radius: 50, smoothing: 0.5, curve: "squircle" }));
    expect(segs[0]).toEqual(["M", 75, 0]);
    expect(segs[1]).toEqual(["L", 225, 0]);
    // shoulder cubic → junction (269.1342, 3.806); interior controls on y=0.
    expect(segs[2]).toEqual(["C", 248.2971, 0, 259.9456, 0, 269.1342, 3.806]);
    // arc to exact midline, then arc to the mirrored junction.
    expect(segs[3]).toEqual(["A", 50, 50, 0, 0, 1, 300, 50]);
    expect(segs[4]).toEqual(["A", 50, 50, 0, 0, 1, 269.1342, 96.194]);
    expect(segs[5]).toEqual(["C", 259.9456, 100, 248.2971, 100, 225, 100]);
  });

  it("s=1 junction sits at the 45° point (285.3553, 14.6447)", () => {
    const segs = segments(generatePath(300, 100, { radius: 50, smoothing: 1, curve: "squircle" }));
    expect(segs[0]).toEqual(["M", 100, 0]);
    expect(near(segs[2][5] as number, 285.3553)).toBe(true);
    expect(near(segs[2][6] as number, 14.6447)).toBe(true);
    expect(segs[3]).toEqual(["A", 50, 50, 0, 0, 1, 300, 50]);
  });
});

describe("capsule — vertical 100×300 mirrors horizontal", () => {
  it("caps sit on the top/bottom, midline points on the vertical centre", () => {
    const segs = segments(generatePath(100, 300, { radius: 50, smoothing: 0.5, curve: "squircle" }));
    // Starts at the top cap's left tangent (0, p=75).
    expect(segs[0]).toEqual(["M", 0, 75]);
    // Top-cap arcs reach the top midline (50, 0); bottom-cap reach (50, 300).
    const arcEnds = segs.filter((s) => s[0] === "A").map((s) => [s[6], s[7]]);
    expect(arcEnds).toContainEqual([50, 0]);
    expect(arcEnds).toContainEqual([50, 300]);
    // Transposing the horizontal capsule (swap x/y) gives the same vertex set.
    const h = vertices(generatePath(300, 100, { radius: 50, smoothing: 0.5, curve: "squircle" }));
    const v = vertices(generatePath(100, 300, { radius: 50, smoothing: 0.5, curve: "squircle" }));
    const key = (pts: [number, number][]) =>
      pts.map(([x, y]) => `${x.toFixed(4)},${y.toFixed(4)}`).sort().join(" ");
    expect(key(v)).toBe(key(h.map(([x, y]) => [y, x])));
  });
});

describe("capsule — square 100×100 full radius is a circle", () => {
  it("collapses to four R-arcs meeting on the midlines, no shoulder bulge", () => {
    const d = generatePath(100, 100, { radius: 50, smoothing: 1, curve: "squircle" });
    const segs = segments(d);
    const arcs = segs.filter((s) => s[0] === "A");
    expect(arcs).toHaveLength(4);
    // Every vertex is exactly R from the centre (50, 50): a true circle.
    for (const [x, y] of vertices(d)) {
      expect(near(Math.hypot(x - 50, y - 50), 50, 1e-3)).toBe(true);
    }
    // No cubic moves off the circle (shoulders degenerate at s_eff=0).
    for (const s of segs.filter((s) => s[0] === "C")) {
      for (let i = 1; i < s.length; i += 2) {
        expect(near(Math.hypot((s[i] as number) - 50, (s[i + 1] as number) - 50), 50, 1e-3)).toBe(true);
      }
    }
  });
});

describe("capsule — narrow 120×100 s=1 clamps without self-intersection", () => {
  it("p ≤ width/2 so the two caps never cross", () => {
    const d = generatePath(120, 100, { radius: 50, smoothing: 1, curve: "squircle" });
    const segs = segments(d);
    const startX = segs[0][1] as number; // M x = p
    expect(startX).toBeLessThanOrEqual(60 + 1e-6); // width/2
    // The two caps meet but do not overlap: flat edge length ≥ 0.
    const topEdgeEnd = segs[1][1] as number; // L x = width - p
    expect(topEdgeEnd - startX).toBeGreaterThanOrEqual(-1e-6);
    expect(d).not.toContain("NaN");
  });
});

describe("capsule — tangency invariant d/c = tan(45°·s_eff)", () => {
  const R = 50;
  for (const { w, s } of [
    { w: 300, s: 0 },
    { w: 300, s: 0.5 },
    { w: 300, s: 1 },
    { w: 120, s: 1 }, // clamped: s_eff < s
    { w: 100, s: 1 }, // square: s_eff = 0
  ]) {
    it(`w=${w} s=${s}`, () => {
      const longHalf = w / 2;
      const sEff = Math.min(s, longHalf / R - 1);
      const { c, d } = getPathParamsForCorner({
        cornerRadius: R,
        cornerSmoothing: sEff,
        preserveSmoothing: true,
        roundingAndSmoothingBudget: longHalf,
      });
      const expected = Math.tan((45 * sEff * Math.PI) / 180);
      if (sEff === 0) {
        expect(near(c, 0) && near(d, 0)).toBe(true); // both zero, tan(0)=0
      } else {
        expect(near(d / c, expected, 1e-9)).toBe(true);
      }
    });
  }
});

// The blend band: uniform squircle whose short side is strictly between 2R and
// 2(1+s)R. Per-edge smoothing keeps the outline continuous from the unclamped
// squircle (short≥2(1+s)R) down to the capsule limit (short=2R), replacing the
// symmetric-clamp "pop" the classic template produced. For 300×h r=50 s=0.6
// the band is 100 < h < 160.
describe("blend band — 300×h r=50 s=0.6", () => {
  const opt = { radius: 50, smoothing: 0.6, curve: "squircle" as const };

  it("resizes continuously: each 1px step moves the outline ≤ ~1px", () => {
    // Sweeps both regime edges: capsule↔blend at h=100, blend↔template at h=160.
    let worst = 0, worstH = 0;
    let prev = generatePath(300, 99, opt);
    for (let h = 100; h <= 165; h++) {
      const cur = generatePath(300, h, opt);
      const d = deviation(prev, cur, 40);
      if (d > worst) { worst = d; worstH = h; }
      prev = cur;
    }
    // 1px of resize is 1px of outline motion; allow a hair for arc sampling.
    expect(worst, `worst step at h=${worstH}`).toBeLessThan(1.05);
  });

  it("agrees with the pure capsule regime at the lower edge (h=100)", () => {
    const blend = drawBlendPath(300, 100, 50, 0.6, true); // s_edge_V → 0
    const capsule = generatePath(300, 100, opt);
    expect(deviation(blend, capsule)).toBeLessThan(0.005);
  });

  it("agrees with the pure squircle regime at the upper edge (h=160)", () => {
    const blend = drawBlendPath(300, 160, 50, 0.6, true); // both s_edge → s
    const squircle = generatePath(300, 160, opt);
    expect(deviation(blend, squircle)).toBeLessThan(0.005);
  });

  it("is asymmetric mid-band: long edges keep more smoothing than short", () => {
    // h=130: sH = min(150/50−1, 0.6) = 0.6 (roomy), sV = min(65/50−1, 0.6) = 0.3.
    const d = generatePath(300, 130, opt);
    // Top-edge shoulder starts at p=(1+0.6)·50=80 from the corner (x=80);
    // side-edge shoulder starts at p=(1+0.3)·50=65 from the corner (y=65).
    const segs = segments(d);
    expect(segs[0][1]).toBeCloseTo(80, 3);   // M x = horizontal p
    // first vertical tangent point sits at y = 65 down the right edge
    const ys = segs.flatMap((s) => [s[s.length - 1] as number]);
    expect(ys.some((y) => Math.abs(y - 65) < 1e-3)).toBe(true);
  });
});

describe("blend band — near-square, both axes clamped", () => {
  // R < shortHalf and both w/2, h/2 < (1+s)R, so both edges clamp independently.
  for (const [w, h] of [[100, 100], [110, 100], [100, 108]] as const) {
    it(`${w}×${h} r=40 s=0.6 is closed, in-bounds, NaN-free`, () => {
      const d = generatePath(w, h, { radius: 40, smoothing: 0.6, curve: "squircle" });
      expect(d).not.toContain("NaN");
      expect(d.trim().endsWith("Z")).toBe(true);
      for (const [x, y] of flatten(d)) {
        expect(x).toBeGreaterThanOrEqual(-0.01);
        expect(x).toBeLessThanOrEqual(w + 0.01);
        expect(y).toBeGreaterThanOrEqual(-0.01);
        expect(y).toBeLessThanOrEqual(h + 0.01);
      }
    });
  }
});
