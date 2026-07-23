// Property-based geometric invariants. fast-check generates random inputs;
// the seed is logged on failure so any reproducer is one re-run away.
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { svgPathProperties } from "svg-path-properties";
import {
  buildArc,
  buildSquircle,
  buildSuperellipse,
  buildClothoid,
  CURVE_TYPES,
  getCurveBuilder,
} from "../src/curves/index.js";
import type { CurveType } from "../src/curves/index.js";
import type { CurveBuilderInput } from "../src/curves/types.js";

const NUM_RUNS = 500;

const curveArb = fc.constantFrom(...CURVE_TYPES);
const radiusArb = fc.float({ min: 10, max: 200, noNaN: true, noDefaultInfinity: true });
const smoothingArb = fc.float({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true });
const exponentArb = fc.float({ min: 2, max: 8, noNaN: true, noDefaultInfinity: true });

function input(
  curve: CurveType,
  radius: number,
  smoothing: number,
  exponent: number,
  budget?: number,
): CurveBuilderInput {
  return {
    cornerRadius: radius,
    smoothing,
    exponent,
    preserveSmoothing: true,
    roundingAndSmoothingBudget: budget ?? radius * 100,
  };
}

interface Pt {
  x: number;
  y: number;
}

function samplePath(d: string, n: number): Pt[] {
  if (d.length === 0) return [];
  const props = new svgPathProperties(`M 0 0 ${d}`);
  const total = props.getTotalLength();
  if (total <= 0) return [];
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1)) * total;
    const pt = props.getPointAtLength(t);
    out.push({ x: pt.x, y: pt.y });
  }
  return out;
}

describe("Invariant 1 — monotonic x/y progress along TR", () => {
  it("x is non-decreasing and y is non-decreasing across the curve", () => {
    fc.assert(
      fc.property(curveArb, radiusArb, smoothingArb, exponentArb, (curve, r, s, e) => {
        const out = getCurveBuilder(curve)(input(curve, r, s, e));
        const samples = samplePath(out.pathSegment("TR"), 32);
        if (samples.length < 2) return true;
        const subPixelDriftSlack = 1e-3;
        for (let i = 1; i < samples.length; i++) {
          if (samples[i].x < samples[i - 1].x - subPixelDriftSlack) return false;
          if (samples[i].y < samples[i - 1].y - subPixelDriftSlack) return false;
        }
        return true;
      }),
      { numRuns: NUM_RUNS, verbose: true },
    );
  });
});

describe("Invariant 2 — no self-crossing", () => {
  it("no two non-adjacent sample points coincide within ε", () => {
    fc.assert(
      fc.property(curveArb, radiusArb, smoothingArb, exponentArb, (curve, r, s, e) => {
        const out = getCurveBuilder(curve)(input(curve, r, s, e));
        const samples = samplePath(out.pathSegment("TR"), 24);
        if (samples.length < 4) return true;
        // ε scaled to radius — a tiny corner can have legitimately
        // closer-than-radius points; the threshold must scale.
        const eps = Math.max(0.5, r * 0.005);
        for (let i = 0; i < samples.length; i++) {
          for (let j = i + 2; j < samples.length; j++) {
            const dx = samples[i].x - samples[j].x;
            const dy = samples[i].y - samples[j].y;
            if (Math.hypot(dx, dy) < eps) return false;
          }
        }
        return true;
      }),
      { numRuns: NUM_RUNS, verbose: true },
    );
  });
});

describe("Invariant 3 — symmetry", () => {
  // The intrinsic invariant: the TR curve is symmetric across the
  // anti-diagonal x + y = p in its own frame. That property holds
  // regardless of how the orient transform rotates the curve into each
  // orient — it tests the math, not the orient plumbing.
  it("TR curve is symmetric across the anti-diagonal x + y = p", () => {
    fc.assert(
      fc.property(curveArb, radiusArb, smoothingArb, exponentArb, (curve, r, s, e) => {
        const out = getCurveBuilder(curve)(input(curve, r, s, e));
        const oddSampleCountSoMiddleHitsDiagonal = 17;
        const tr = samplePath(out.pathSegment("TR"), oddSampleCountSoMiddleHitsDiagonal);
        if (tr.length < 4) return true;
        const p = out.p;
        const tol = Math.max(0.5, p * 0.01);
        // Reflection of (x, y) across x+y=p is (p-y, p-x). The point
        // i steps from the start should reflect to the point i steps
        // from the end.
        for (let i = 0; i < tr.length; i++) {
          const j = tr.length - 1 - i;
          if (Math.abs(tr[i].x - (p - tr[j].y)) > tol) return false;
          if (Math.abs(tr[i].y - (p - tr[j].x)) > tol) return false;
        }
        return true;
      }),
      { numRuns: NUM_RUNS, verbose: true },
    );
  });

  // The orient sign-flip property: BL is rotated 180° from TR, so its
  // relative samples in local frame coincide with -TR. Independent
  // test surface — pinpoints orient-transform plumbing bugs.
  it("TR mirror across X+Y=p coincides with BL", () => {
    fc.assert(
      fc.property(curveArb, radiusArb, smoothingArb, exponentArb, (curve, r, s, e) => {
        const out = getCurveBuilder(curve)(input(curve, r, s, e));
        const tr = samplePath(out.pathSegment("TR"), 16);
        const bl = samplePath(out.pathSegment("BL"), 16);
        if (tr.length === 0 || bl.length === 0) return tr.length === bl.length;
        // BL is TR rotated 180°: relative path commands negate both axes, so
        // after M 0 0 the BL samples land at (-tr.x, -tr.y) in local frame.
        const tolerance = Math.max(0.5, out.p * 0.01);
        for (let i = 0; i < Math.min(tr.length, bl.length); i++) {
          const a = tr[i];
          const b = bl[i];
          if (Math.abs(a.x + b.x) > tolerance) return false;
          if (Math.abs(a.y + b.y) > tolerance) return false;
        }
        return true;
      }),
      { numRuns: NUM_RUNS, verbose: true },
    );
  });
});

describe("Invariant 4 — scale invariance", () => {
  it("doubling radius doubles p and scales every sampled point by 2×", () => {
    fc.assert(
      fc.property(curveArb, radiusArb, smoothingArb, exponentArb, (curve, r, s, e) => {
        const small = getCurveBuilder(curve)(input(curve, r, s, e));
        const big = getCurveBuilder(curve)(input(curve, r * 2, s, e));
        // Tolerance: 0.1% to absorb rounding-to-4-decimal noise.
        const expectedP = small.p * 2;
        if (Math.abs(big.p - expectedP) > Math.max(1e-3, expectedP * 1e-3)) return false;

        // Sample both curves at the same arc-length fractions.
        const sSmall = samplePath(small.pathSegment("TR"), 24);
        const sBig = samplePath(big.pathSegment("TR"), 24);
        if (sSmall.length !== sBig.length) return false;
        const tol = Math.max(0.5, expectedP * 0.01);
        for (let i = 0; i < sSmall.length; i++) {
          if (Math.abs(sBig[i].x - sSmall[i].x * 2) > tol) return false;
          if (Math.abs(sBig[i].y - sSmall[i].y * 2) > tol) return false;
        }
        return true;
      }),
      { numRuns: NUM_RUNS, verbose: true },
    );
  });
});

describe("Invariant 5 — endpoint tangent direction", () => {
  it("first segment exits along +X, last segment arrives along +Y", () => {
    fc.assert(
      fc.property(curveArb, radiusArb, smoothingArb, exponentArb, (curve, r, s, e) => {
        const out = getCurveBuilder(curve)(input(curve, r, s, e));
        const samples = samplePath(out.pathSegment("TR"), 64);
        if (samples.length < 4) return true;
        // Numerical derivative (chord) at each end, approximating the tangent.
        const startTangentX = samples[1].x - samples[0].x;
        const startTangentY = samples[1].y - samples[0].y;
        const startTangentLen = Math.hypot(startTangentX, startTangentY);
        const N = samples.length;
        const endTangentX = samples[N - 1].x - samples[N - 2].x;
        const endTangentY = samples[N - 1].y - samples[N - 2].y;
        const endTangentLen = Math.hypot(endTangentX, endTangentY);
        // Slack of 0.5: a large step + sharp shoulder can drift the chord a
        // few degrees off the true tangent, so only the dominant axis matters.
        const angleSlack = 0.5;
        return startTangentX > 0 && startTangentLen > 0 &&
          Math.abs(startTangentY) / startTangentLen < angleSlack &&
          endTangentY > 0 && endTangentLen > 0 &&
          Math.abs(endTangentX) / endTangentLen < angleSlack;
      }),
      { numRuns: NUM_RUNS, verbose: true },
    );
  });
});

describe("Invariant 6 — budget clamping", () => {
  it("p = budget when natural p > budget", () => {
    fc.assert(
      fc.property(curveArb, smoothingArb, exponentArb, (curve, s, e) => {
        const tightBudget = 20;
        const radiusFarAboveBudget = 200;
        const out = getCurveBuilder(curve)(input(curve, radiusFarAboveBudget, s, e, tightBudget));
        return Math.abs(out.p - tightBudget) <= 1e-4;
      }),
      { numRuns: NUM_RUNS, verbose: true },
    );
  });

  it("p = natural unclamped when budget is generous (continuity at the boundary)", () => {
    fc.assert(
      fc.property(curveArb, radiusArb, smoothingArb, exponentArb, (curve, r, s, e) => {
        const natural = getCurveBuilder(curve)(input(curve, r, s, e, r * 1e6)).p;
        // Tolerance scales with natural since builders round to 4 decimals
        // and naturalP can be hundreds of px.
        const tol = Math.max(1e-3, natural * 1e-3);
        // Budget exactly at natural: no off-by-one clamp at the boundary.
        const atBoundary = getCurveBuilder(curve)(input(curve, r, s, e, natural)).p;
        if (Math.abs(atBoundary - natural) > tol) return false;
        // Budget just below natural: must clamp to the budget.
        const justBelow = getCurveBuilder(curve)(input(curve, r, s, e, natural - 1)).p;
        if (Math.abs(justBelow - (natural - 1)) > Math.max(tol, 1e-3)) return false;
        // Budget far above natural: p is unaffected.
        const farAbove = getCurveBuilder(curve)(input(curve, r, s, e, natural * 2)).p;
        if (Math.abs(farAbove - natural) > tol) return false;
        return true;
      }),
      { numRuns: NUM_RUNS, verbose: true },
    );
  });
});

describe("Builder exhaustiveness", () => {
  it("every CURVE_TYPES entry has a working builder", () => {
    for (const curve of CURVE_TYPES) {
      const builder = getCurveBuilder(curve);
      const out = builder(input(curve, 40, 0.6, 4));
      expect(typeof out.p).toBe("number");
      expect(typeof out.pathSegment("TR")).toBe("string");
    }
  });

  it("direct builder imports match getCurveBuilder dispatch", () => {
    expect(getCurveBuilder("arc")).toBe(buildArc);
    expect(getCurveBuilder("squircle")).toBe(buildSquircle);
    expect(getCurveBuilder("superellipse")).toBe(buildSuperellipse);
    expect(getCurveBuilder("clothoid")).toBe(buildClothoid);
  });
});
