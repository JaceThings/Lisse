import { describe, it, expect } from "vitest";
import {
  buildArc,
  buildSquircle,
  buildSuperellipse,
  buildClothoid,
  getCurveBuilder,
  type CurveBuilderInput,
} from "../src/curves/index.js";

const baseInput = (overrides: Partial<CurveBuilderInput> = {}): CurveBuilderInput => ({
  cornerRadius: 40,
  smoothing: 0.6,
  exponent: 4,
  preserveSmoothing: true,
  roundingAndSmoothingBudget: 1e9,
  ...overrides,
});

// Walk a relative-coordinate path segment and accumulate the endpoint
// deltas of every `c` (cubic Bézier — endpoint at offset +5/+6) and `a`
// (elliptical arc — endpoint at offset +6/+7) command. Used to verify
// that each builder's TR quadrant terminates at (p, p).
function sumEndpointDeltas(seg: string): { x: number; y: number } {
  const tokens = seg.split(/\s+/);
  let x = 0;
  let y = 0;
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i] === "c") {
      x += parseFloat(tokens[i + 5]);
      y += parseFloat(tokens[i + 6]);
    } else if (tokens[i] === "a") {
      x += parseFloat(tokens[i + 6]);
      y += parseFloat(tokens[i + 7]);
    }
  }
  return { x, y };
}

describe("buildArc", () => {
  it("emits a single relative arc command for each orient", () => {
    const out = buildArc(baseInput());
    expect(out.p).toBe(40);
    expect(out.pathSegment("TR")).toBe("a 40.0000 40.0000 0 0 1 40.0000 40.0000");
    expect(out.pathSegment("BR")).toBe("a 40.0000 40.0000 0 0 1 -40.0000 40.0000");
    expect(out.pathSegment("BL")).toBe("a 40.0000 40.0000 0 0 1 -40.0000 -40.0000");
    expect(out.pathSegment("TL")).toBe("a 40.0000 40.0000 0 0 1 40.0000 -40.0000");
  });

  it("short-circuits when radius is zero", () => {
    const out = buildArc(baseInput({ cornerRadius: 0 }));
    expect(out.p).toBe(0);
    expect(out.pathSegment("TR")).toBe("");
  });

  it("clamps p to budget", () => {
    const out = buildArc(baseInput({ cornerRadius: 50, roundingAndSmoothingBudget: 30 }));
    expect(out.p).toBe(30);
    expect(out.pathSegment("TR")).toBe("a 30.0000 30.0000 0 0 1 30.0000 30.0000");
  });
});

describe("buildSquircle", () => {
  it("matches the existing draw.ts output byte-for-byte (TR)", () => {
    const out = buildSquircle(baseInput());
    expect(out.p).toBe(64);
    expect(out.pathSegment("TR")).toBe(
      "c 22.4021 0 33.6032 0 42.1596 4.3597 a 40.0000 40.0000 0 0 1 17.4806 17.4806 c 4.3597 8.5565 4.3597 19.7575 4.3597 42.1596"
    );
  });

  it("short-circuits at radius zero", () => {
    const out = buildSquircle(baseInput({ cornerRadius: 0 }));
    expect(out.p).toBe(0);
    expect(out.pathSegment("TR")).toBe("");
  });
});

describe("buildSuperellipse", () => {
  it("emits three relative cubic Béziers per quadrant", () => {
    const out = buildSuperellipse(baseInput());
    expect(out.p).toBe(40);
    const seg = out.pathSegment("TR");
    // Three "c x y x y x y" cubic-Bézier commands.
    expect(seg.split(" c ").length).toBe(3);
    expect(seg.startsWith("c ")).toBe(true);
  });

  it("path reaches the exit tangency point exactly", () => {
    const out = buildSuperellipse(baseInput({ cornerRadius: 40 }));
    const { x, y } = sumEndpointDeltas(out.pathSegment("TR"));
    expect(Math.abs(x - 40)).toBeLessThan(1e-3);
    expect(Math.abs(y - 40)).toBeLessThan(1e-3);
  });

  it("approximates a circle when exponent = 2", () => {
    const out = buildSuperellipse(baseInput({ exponent: 2, cornerRadius: 100 }));
    // Just sanity-check that the endpoint is at (100, 100).
    const { x, y } = sumEndpointDeltas(out.pathSegment("TR"));
    expect(Math.abs(x - 100)).toBeLessThan(1e-3);
    expect(Math.abs(y - 100)).toBeLessThan(1e-3);
  });

  it("short-circuits at radius zero", () => {
    const out = buildSuperellipse(baseInput({ cornerRadius: 0 }));
    expect(out.p).toBe(0);
    expect(out.pathSegment("TR")).toBe("");
  });
});

describe("buildClothoid", () => {
  it("emits a cubic-arc-cubic for moderate smoothing", () => {
    const out = buildClothoid(baseInput({ smoothing: 0.6 }));
    const seg = out.pathSegment("TR");
    // Pattern: c... a... c...
    expect(seg).toMatch(/^c .* a .* c /);
  });

  it("collapses to a single arc at smoothing = 0", () => {
    const out = buildClothoid(baseInput({ smoothing: 0 }));
    expect(out.p).toBe(40);
    expect(out.pathSegment("TR")).toBe("a 40.0000 40.0000 0 0 1 40.0000 40.0000");
  });

  it("drops the arc at smoothing = 1 (pure Cornu corner)", () => {
    const out = buildClothoid(baseInput({ smoothing: 1 }));
    const seg = out.pathSegment("TR");
    // Two cubics, no arc.
    expect(seg.split(" c ").length).toBe(2);
    expect(seg.includes(" a ")).toBe(false);
  });

  it("path reaches the exit tangency point exactly", () => {
    const out = buildClothoid(baseInput({ smoothing: 0.6 }));
    const { x, y } = sumEndpointDeltas(out.pathSegment("TR"));
    expect(Math.abs(x - out.p)).toBeLessThan(1e-3);
    expect(Math.abs(y - out.p)).toBeLessThan(1e-3);
  });

  it("short-circuits at radius zero", () => {
    const out = buildClothoid(baseInput({ cornerRadius: 0 }));
    expect(out.p).toBe(0);
    expect(out.pathSegment("TR")).toBe("");
  });

  it("scales when natural p exceeds budget", () => {
    const big = buildClothoid(baseInput({ cornerRadius: 100, smoothing: 1.0 }));
    const tight = buildClothoid(baseInput({
      cornerRadius: 100,
      smoothing: 1.0,
      roundingAndSmoothingBudget: 50,
    }));
    expect(tight.p).toBe(50);
    expect(big.p).toBeGreaterThan(100);
  });
});

describe("getCurveBuilder", () => {
  it("dispatches each curve type to its builder", () => {
    expect(getCurveBuilder("arc")).toBe(buildArc);
    expect(getCurveBuilder("squircle")).toBe(buildSquircle);
    expect(getCurveBuilder("superellipse")).toBe(buildSuperellipse);
    expect(getCurveBuilder("clothoid")).toBe(buildClothoid);
  });
});
