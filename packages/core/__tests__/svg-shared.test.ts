import { describe, it, expect } from "vitest";
import { SVG_NS, nextUid, hexToRgb, DEFAULT_SHADOW, darkenHex, darkenGradient, angleToCoords, adjustOptions, createPathCache } from "../src/svg-shared.js";
import type { LinearGradientConfig, RadialGradientConfig, CornerConfig } from "../src/types.js";

describe("SVG_NS", () => {
  it("equals the SVG namespace URI", () => {
    expect(SVG_NS).toBe("http://www.w3.org/2000/svg");
  });
});

describe("nextUid", () => {
  it("returns incrementing numbers on successive calls", () => {
    const a = nextUid();
    const b = nextUid();
    const c = nextUid();
    expect(b).toBe(a + 1);
    expect(c).toBe(b + 1);
  });
});

describe("hexToRgb", () => {
  it("converts #ff0000 to rgb(255,0,0)", () => {
    expect(hexToRgb("#ff0000")).toBe("rgb(255,0,0)");
  });

  it("converts #00ff00 to rgb(0,255,0)", () => {
    expect(hexToRgb("#00ff00")).toBe("rgb(0,255,0)");
  });

  it("converts #0000ff to rgb(0,0,255)", () => {
    expect(hexToRgb("#0000ff")).toBe("rgb(0,0,255)");
  });

  it("converts hex without # prefix", () => {
    expect(hexToRgb("ff00aa")).toBe("rgb(255,0,170)");
  });

  it("converts #000000 to rgb(0,0,0)", () => {
    expect(hexToRgb("#000000")).toBe("rgb(0,0,0)");
  });

  it("converts #ffffff to rgb(255,255,255)", () => {
    expect(hexToRgb("#ffffff")).toBe("rgb(255,255,255)");
  });
});

describe("DEFAULT_SHADOW", () => {
  it("has all zeroed fields with color #000", () => {
    expect(DEFAULT_SHADOW).toEqual({
      offsetX: 0,
      offsetY: 0,
      blur: 0,
      spread: 0,
      color: "#000",
      opacity: 0,
    });
  });
});

describe("darkenHex", () => {
  it("darkens a color by multiplying RGB by 2/3", () => {
    expect(darkenHex("#ffffff")).toBe("#aaaaaa");
    expect(darkenHex("#ff0000")).toBe("#aa0000");
    expect(darkenHex("#336699")).toBe("#224466");
  });

  it("returns #4c4c4c for pure black", () => {
    expect(darkenHex("#000000")).toBe("#4c4c4c");
  });

  it("preserves zeros in other channels", () => {
    expect(darkenHex("#00ff00")).toBe("#00aa00");
  });
});

describe("darkenGradient", () => {
  it("darkens each stop's color in a linear gradient", () => {
    const input: LinearGradientConfig = {
      type: "linear",
      angle: 90,
      stops: [
        { offset: 0, color: "#ffffff" },
        { offset: 1, color: "#ff0000" },
      ],
    };
    const result = darkenGradient(input);
    expect(result.type).toBe("linear");
    expect(result.stops).toHaveLength(2);
    expect(result.stops[0].color).toBe("#aaaaaa");
    expect(result.stops[1].color).toBe("#aa0000");
    // Preserves angle
    expect((result as LinearGradientConfig).angle).toBe(90);
  });

  it("darkens each stop's color in a radial gradient", () => {
    const input: RadialGradientConfig = {
      type: "radial",
      cx: 0.3,
      cy: 0.7,
      r: 0.4,
      stops: [
        { offset: 0, color: "#00ff00", opacity: 0.5 },
        { offset: 1, color: "#000000" },
      ],
    };
    const result = darkenGradient(input);
    expect(result.type).toBe("radial");
    expect(result.stops[0].color).toBe("#00aa00");
    expect(result.stops[0].opacity).toBe(0.5);
    expect(result.stops[1].color).toBe("#4c4c4c");
    // Preserves radial params
    expect((result as RadialGradientConfig).cx).toBe(0.3);
    expect((result as RadialGradientConfig).cy).toBe(0.7);
    expect((result as RadialGradientConfig).r).toBe(0.4);
  });
});

describe("angleToCoords", () => {
  const round = (v: number) => Math.round(v * 1000) / 1000;

  it("0deg = bottom-to-top", () => {
    const c = angleToCoords(0);
    expect(round(c.x1)).toBe(0.5);
    expect(round(c.y1)).toBe(1);
    expect(round(c.x2)).toBe(0.5);
    expect(round(c.y2)).toBe(0);
  });

  it("90deg = left-to-right", () => {
    const c = angleToCoords(90);
    expect(round(c.x1)).toBe(0);
    expect(round(c.y1)).toBe(0.5);
    expect(round(c.x2)).toBe(1);
    expect(round(c.y2)).toBe(0.5);
  });

  it("180deg = top-to-bottom", () => {
    const c = angleToCoords(180);
    expect(round(c.x1)).toBe(0.5);
    expect(round(c.y1)).toBe(0);
    expect(round(c.x2)).toBe(0.5);
    expect(round(c.y2)).toBe(1);
  });

  it("270deg = right-to-left", () => {
    const c = angleToCoords(270);
    expect(round(c.x1)).toBe(1);
    expect(round(c.y1)).toBe(0.5);
    expect(round(c.x2)).toBe(0);
    expect(round(c.y2)).toBe(0.5);
  });
});

// Risk #1 from the curve-type blueprint: `adjustOptions` rebuilds each
// per-corner object via a `{...v, radius}` spread. If a future refactor
// dropped to picking known keys, the `curve` and `exponent` fields would
// silently disappear — the main path would render the requested curve
// while the shadow rendered a squircle. Lock the spread behavior with
// explicit tests so a future change can't regress this quietly.
describe("adjustOptions — curve-type preservation", () => {
  it("preserves curve and exponent on a uniform CornerConfig", () => {
    const result = adjustOptions(
      { radius: 20, curve: "clothoid", smoothing: 0.7, preserveSmoothing: false },
      4,
    );
    expect(result).toMatchObject({
      radius: 24,
      curve: "clothoid",
      smoothing: 0.7,
      preserveSmoothing: false,
    });
  });

  it("preserves curve and exponent on per-corner CornerConfig branches", () => {
    const result = adjustOptions(
      {
        topLeft: { radius: 20, curve: "clothoid" },
        topRight: { radius: 16, curve: "superellipse", exponent: 6 },
        bottomRight: { radius: 12, curve: "arc" },
        bottomLeft: 8,
      },
      4,
    );
    expect(result).toMatchObject({
      topLeft: { radius: 24, curve: "clothoid" },
      topRight: { radius: 20, curve: "superellipse", exponent: 6 },
      bottomRight: { radius: 16, curve: "arc" },
      bottomLeft: 12,
    });
  });

  it("clamps radius to zero rather than going negative on tight cutouts", () => {
    const result = adjustOptions(
      { topLeft: { radius: 10, curve: "clothoid" } as CornerConfig },
      -100,
    );
    expect(result).toMatchObject({
      topLeft: { radius: 0, curve: "clothoid" },
    });
  });
});

// Risk #4 from the curve-type blueprint: the per-dispatch path cache
// keys on `JSON.stringify(options)`. Since `curve` lives inside the
// options object it should be included in the key automatically — lock
// that with an explicit test.
describe("createPathCache — curve invalidation", () => {
  it("returns different paths for different curve types at the same dimensions", () => {
    const baseSquircle = { radius: 40, curve: "squircle" as const };
    const baseClothoid = { radius: 40, curve: "clothoid" as const };
    const getSq = createPathCache(baseSquircle);
    const getCl = createPathCache(baseClothoid);
    const sqPath = getSq(200, 200, baseSquircle, 0);
    const clPath = getCl(200, 200, baseClothoid, 0);
    expect(sqPath).not.toBe(clPath);
  });
});
