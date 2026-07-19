import { describe, it, expect } from "vitest";
import { SVG_NS, nextUid, hexToRgb, DEFAULT_SHADOW, adjustOptions, createPathCache } from "../src/svg-shared.js";
import type { CornerConfig } from "../src/types.js";

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

// Risk #1: `adjustOptions` rebuilds each per-corner object via a
// `{...v, radius}` spread. A refactor that switched to picking known
// keys would silently drop `curve` and `exponent`, leaving the main
// path on the requested curve while the shadow fell back to squircle.
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

  it("clamps radius to 0 rather than going negative on tight cutouts", () => {
    const result = adjustOptions(
      { topLeft: { radius: 10, curve: "clothoid" } as CornerConfig },
      -100,
    );
    expect(result).toMatchObject({
      topLeft: { radius: 0, curve: "clothoid" },
    });
  });
});

// Path cache keys on structured corner fields (not JSON.stringify) and on
// call-time opts so spread-adjusted radii memoise correctly.
describe("createPathCache — curve invalidation", () => {
  it("returns different paths for different curves at the same dimensions", () => {
    const baseSquircle = { radius: 40, curve: "squircle" as const };
    const baseClothoid = { radius: 40, curve: "clothoid" as const };
    const getSq = createPathCache();
    const getCl = createPathCache();
    const sqPath = getSq(200, 200, baseSquircle, 0);
    const clPath = getCl(200, 200, baseClothoid, 0);
    expect(sqPath).not.toBe(clPath);
  });

  it("keys on spread-adjusted opts, not the factory options", () => {
    const base = { radius: 40, curve: "squircle" as const };
    const getPath = createPathCache();
    const adjusted = adjustOptions(base, 4);
    const fromAdjusted = getPath(208, 208, adjusted, 4);
    const fromBase = getPath(208, 208, base, 4);
    expect(fromAdjusted).not.toBe(fromBase);
  });
});
