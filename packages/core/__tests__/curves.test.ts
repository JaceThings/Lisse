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

// Sum endpoint deltas across every `c` and `a` command in a relative
// path segment — verifies that a TR quadrant terminates at (p, p).
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
  it("emits one relative arc per orient", () => {
    const out = buildArc(baseInput());
    expect(out.p).toBe(40);
    expect(out.pathSegment("TR")).toBe("a 40.0000 40.0000 0 0 1 40.0000 40.0000");
    expect(out.pathSegment("BR")).toBe("a 40.0000 40.0000 0 0 1 -40.0000 40.0000");
    expect(out.pathSegment("BL")).toBe("a 40.0000 40.0000 0 0 1 -40.0000 -40.0000");
    expect(out.pathSegment("TL")).toBe("a 40.0000 40.0000 0 0 1 40.0000 -40.0000");
  });

  it("short-circuits at radius 0", () => {
    const out = buildArc(baseInput({ cornerRadius: 0 }));
    expect(out.p).toBe(0);
    expect(out.pathSegment("TR")).toBe("");
  });

  it("clamps p to the budget", () => {
    const out = buildArc(baseInput({ cornerRadius: 50, roundingAndSmoothingBudget: 30 }));
    expect(out.p).toBe(30);
    expect(out.pathSegment("TR")).toBe("a 30.0000 30.0000 0 0 1 30.0000 30.0000");
  });
});

describe("buildSquircle", () => {
  it("matches draw.ts output byte-for-byte (TR)", () => {
    const out = buildSquircle(baseInput());
    expect(out.p).toBe(64);
    expect(out.pathSegment("TR")).toBe(
      "c 22.4021 0 33.6032 0 42.1596 4.3597 a 40.0000 40.0000 0 0 1 17.4806 17.4806 c 4.3597 8.5565 4.3597 19.7575 4.3597 42.1596"
    );
  });

  it("short-circuits at radius 0", () => {
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
    expect(seg.split(" c ").length).toBe(3);
    expect(seg.startsWith("c ")).toBe(true);
  });

  it("reaches the exit tangency point exactly", () => {
    const out = buildSuperellipse(baseInput({ cornerRadius: 40 }));
    const { x, y } = sumEndpointDeltas(out.pathSegment("TR"));
    expect(Math.abs(x - 40)).toBeLessThan(1e-3);
    expect(Math.abs(y - 40)).toBeLessThan(1e-3);
  });

  it("approximates a circle at exponent = 2", () => {
    const out = buildSuperellipse(baseInput({ exponent: 2, cornerRadius: 100 }));
    const { x, y } = sumEndpointDeltas(out.pathSegment("TR"));
    expect(Math.abs(x - 100)).toBeLessThan(1e-3);
    expect(Math.abs(y - 100)).toBeLessThan(1e-3);
  });

  it("short-circuits at radius 0", () => {
    const out = buildSuperellipse(baseInput({ cornerRadius: 0 }));
    expect(out.p).toBe(0);
    expect(out.pathSegment("TR")).toBe("");
  });
});

describe("buildClothoid", () => {
  it("emits cubic-arc-cubic at moderate smoothing", () => {
    const out = buildClothoid(baseInput({ smoothing: 0.6 }));
    expect(out.pathSegment("TR")).toMatch(/^c .* a .* c /);
  });

  it("collapses to a single arc at smoothing = 0", () => {
    const out = buildClothoid(baseInput({ smoothing: 0 }));
    expect(out.p).toBe(40);
    expect(out.pathSegment("TR")).toBe("a 40.0000 40.0000 0 0 1 40.0000 40.0000");
  });

  it("drops the arc at smoothing = 1 (pure Cornu corner)", () => {
    const out = buildClothoid(baseInput({ smoothing: 1 }));
    const seg = out.pathSegment("TR");
    expect(seg.split(" c ").length).toBe(2);
    expect(seg.includes(" a ")).toBe(false);
  });

  it("reaches the exit tangency point exactly", () => {
    const out = buildClothoid(baseInput({ smoothing: 0.6 }));
    const { x, y } = sumEndpointDeltas(out.pathSegment("TR"));
    expect(Math.abs(x - out.p)).toBeLessThan(1e-3);
    expect(Math.abs(y - out.p)).toBeLessThan(1e-3);
  });

  it("short-circuits at radius 0", () => {
    const out = buildClothoid(baseInput({ cornerRadius: 0 }));
    expect(out.p).toBe(0);
    expect(out.pathSegment("TR")).toBe("");
  });

  it("scales down when natural p exceeds budget", () => {
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

// Risk #5 from the curve-type blueprint: the clothoid cubic Bézier's
// endpoint must match the Simpson-integrated clothoid endpoint within
// tight tolerance across the R / smoothing range. Otherwise the cubic
// silently drifts from the true clothoid shape — visible as the corner
// not closing cleanly.
describe("buildClothoid — cubic endpoint property", () => {
  const sumEndpointDeltas = (seg: string): { x: number; y: number } => {
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
  };

  for (const cornerRadius of [10, 40, 100, 200]) {
    for (const smoothing of [0.2, 0.4, 0.6, 0.8, 1.0]) {
      it(`R=${cornerRadius} s=${smoothing}: endpoint lands at (p, p) within 1e-3`, () => {
        const out = buildClothoid(baseInput({ cornerRadius, smoothing }));
        const { x, y } = sumEndpointDeltas(out.pathSegment("TR"));
        expect(Math.abs(x - out.p)).toBeLessThan(1e-3);
        expect(Math.abs(y - out.p)).toBeLessThan(1e-3);
      });
    }
  }
});

describe("buildSuperellipse — input validation", () => {
  it("clamps exponent < 2 to a quarter-circle equivalent (no NaN)", () => {
    const out = buildSuperellipse(baseInput({ exponent: 1 }));
    expect(out.pathSegment("TR")).not.toContain("NaN");
  });
  it("falls back to safe default for non-finite exponent (NaN)", () => {
    const out = buildSuperellipse(baseInput({ exponent: NaN }));
    expect(out.pathSegment("TR")).not.toContain("NaN");
  });
  it("falls back to safe default for Infinity exponent", () => {
    const out = buildSuperellipse(baseInput({ exponent: Infinity }));
    expect(out.pathSegment("TR")).not.toContain("NaN");
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
