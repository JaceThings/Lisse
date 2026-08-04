import { describe, it, expect } from "vitest";
import { SVG_NS, nextUid, hexToRgb, DEFAULT_SHADOW, darkenHex, darkenGradient, angleToCoords, adjustOptions, createPathCache, PATH_CACHE_CAPACITY } from "../src/svg-shared.js";
import { generatePath } from "../src/generate-path.js";
import type { LinearGradientConfig, RadialGradientConfig, CornerConfig, SmoothCornerOptions } from "../src/types.js";

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

  it("falls back to color-mix for wide-gamut input", () => {
    // Reading channels off a non-hex string used to yield NaN, which rendered
    // the groove edge as pure black.
    expect(darkenHex("oklch(0.623 0.214 259.815)")).toBe(
      "color-mix(in oklab, oklch(0.623 0.214 259.815), black 33%)",
    );
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

// Risk #4: the path cache keys on `JSON.stringify(options)`. `curve`
// lives inside that object so it should bust the key automatically —
// lock that behaviour explicitly.
describe("createPathCache — curve invalidation", () => {
  it("returns different paths for different curves at the same dimensions", () => {
    const baseSquircle = { radius: 40, curve: "squircle" as const };
    const baseClothoid = { radius: 40, curve: "clothoid" as const };
    const getSq = createPathCache(baseSquircle);
    const getCl = createPathCache(baseClothoid);
    const sqPath = getSq(200, 200, baseSquircle, 0);
    const clPath = getCl(200, 200, baseClothoid, 0);
    expect(sqPath).not.toBe(clPath);
  });
});

// Regression: setOptions must re-serialize every call, not just on reference
// change. Vue reactive props mutate a retained object in place, so a bare
// reference check would keep serving the old shape's border/shadow paths.
describe("createPathCache — in-place options mutation", () => {
  it("busts the cache when a same-reference options object is mutated", () => {
    const opts: SmoothCornerOptions = { radius: 20, curve: "squircle" };
    const getPath = createPathCache(opts);
    const before = getPath(200, 100, opts, 0);
    expect(before).toBe(generatePath(200, 100, { radius: 20, curve: "squircle" }));

    // Mutate the same object reference (no new allocation).
    (opts as { radius: number }).radius = 60;
    getPath.setOptions(opts);
    const after = getPath(200, 100, opts, 0);

    expect(after).not.toBe(before);
    expect(after).toBe(generatePath(200, 100, { radius: 60, curve: "squircle" }));
  });

  it("re-uses the cache and does not clear when the serialized shape is unchanged", () => {
    const opts: SmoothCornerOptions = { radius: 20, curve: "squircle" };
    const getPath = createPathCache(opts);
    getPath(200, 100, opts, 0);
    getPath(300, 100, opts, 0);
    expect(getPath._size()).toBe(2);
    // Same shape, fresh object reference — no clear.
    getPath.setOptions({ radius: 20, curve: "squircle" });
    expect(getPath._size()).toBe(2);
  });
});

// Regression: the per-size Map had no eviction, so a resize animation would
// accumulate one entry per unique (w, h, spread) without bound.
describe("createPathCache — LRU cap", () => {
  it("keeps the map bounded to the capacity across many unique sizes", () => {
    const opts: SmoothCornerOptions = { radius: 8, curve: "arc" };
    const getPath = createPathCache(opts);
    for (let i = 0; i < PATH_CACHE_CAPACITY + 250; i++) {
      getPath(100 + i, 60, opts, 0);
    }
    expect(getPath._size()).toBeLessThanOrEqual(PATH_CACHE_CAPACITY);
  });

  it("evicts the oldest entry first (LRU order)", () => {
    const opts: SmoothCornerOptions = { radius: 8, curve: "arc" };
    const getPath = createPathCache(opts);
    // Fill to capacity with distinct widths starting at 1000.
    for (let i = 0; i < PATH_CACHE_CAPACITY; i++) getPath(1000 + i, 60, opts, 0);
    // One more unique size evicts the oldest (width 1000).
    getPath(9999, 60, opts, 0);
    expect(getPath._size()).toBe(PATH_CACHE_CAPACITY);
  });
});
