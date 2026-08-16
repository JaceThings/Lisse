// Direct tests for the curve-builder LRU cache. Without these the
// cache could silently regress and the only failure surface would be
// a perf bench drift — much later signal.
import { describe, it, expect, beforeEach } from "vitest";
import { buildSquircle, buildClothoid } from "../src/curves/index.js";
import {
  getCachedBuilderOutput,
  clearCurveCache,
  CURVE_CACHE_CAPACITY,
  _curveCacheSize,
} from "../src/curves/cache.js";
import type { CurveBuilderOutput } from "../src/curves/types.js";

const base = {
  cornerRadius: 24,
  smoothing: 0.6,
  exponent: 4,
  preserveSmoothing: true,
  roundingAndSmoothingBudget: 1e9,
};

beforeEach(() => {
  clearCurveCache();
});

describe("curve cache — basic semantics", () => {
  it("returns the same object reference on a cache hit", () => {
    const a = getCachedBuilderOutput("squircle", buildSquircle, base);
    const b = getCachedBuilderOutput("squircle", buildSquircle, base);
    expect(b).toBe(a);
  });

  it("cached output matches fresh output byte-for-byte for every orient", () => {
    const fresh = buildSquircle(base);
    const cached = getCachedBuilderOutput("squircle", buildSquircle, base);
    expect(cached.p).toBe(fresh.p);
    for (const orient of ["TR", "BR", "BL", "TL"] as const) {
      expect(cached.pathSegment(orient)).toBe(fresh.pathSegment(orient));
    }
  });

  it("different inputs produce different cache entries", () => {
    const a = getCachedBuilderOutput("squircle", buildSquircle, base);
    const b = getCachedBuilderOutput("squircle", buildSquircle, { ...base, cornerRadius: 32 });
    expect(b).not.toBe(a);
    expect(b.p).not.toBe(a.p);
  });

  it("different curve types do not collide on identical inputs", () => {
    const sq = getCachedBuilderOutput("squircle", buildSquircle, base);
    const cl = getCachedBuilderOutput("clothoid", buildClothoid, base);
    expect(cl).not.toBe(sq);
    expect(cl.pathSegment("TR")).not.toBe(sq.pathSegment("TR"));
  });
});

describe("curve cache — LRU eviction", () => {
  it("evicts the least-recently-touched entry when capacity is exceeded", () => {
    for (let i = 0; i < CURVE_CACHE_CAPACITY; i++) {
      getCachedBuilderOutput("squircle", buildSquircle, { ...base, cornerRadius: i + 1 });
    }
    expect(_curveCacheSize()).toBe(CURVE_CACHE_CAPACITY);

    getCachedBuilderOutput("squircle", buildSquircle, { ...base, cornerRadius: 1 });
    getCachedBuilderOutput("squircle", buildSquircle, { ...base, cornerRadius: 999 });
    expect(_curveCacheSize()).toBe(CURVE_CACHE_CAPACITY);

    const refetchOne = getCachedBuilderOutput("squircle", buildSquircle, { ...base, cornerRadius: 1 });
    const refetchOneAgain = getCachedBuilderOutput("squircle", buildSquircle, { ...base, cornerRadius: 1 });
    expect(refetchOneAgain).toBe(refetchOne);
  });

  it("a repeated hit on the newest key keeps it newest for eviction", () => {
    // A hit on the already-newest key skips the delete+set touch. If that skip
    // ever loses the entry's position, the next insert evicts the wrong key.
    const refs: CurveBuilderOutput[] = [];
    for (let i = 0; i < CURVE_CACHE_CAPACITY; i++) {
      refs.push(
        getCachedBuilderOutput("squircle", buildSquircle, { ...base, cornerRadius: i + 1 })
      );
    }

    const one = getCachedBuilderOutput("squircle", buildSquircle, { ...base, cornerRadius: 1 });
    expect(one).toBe(refs[0]);
    // Second hit takes the skip path.
    expect(getCachedBuilderOutput("squircle", buildSquircle, { ...base, cornerRadius: 1 })).toBe(one);

    getCachedBuilderOutput("squircle", buildSquircle, { ...base, cornerRadius: 999 });
    expect(_curveCacheSize()).toBe(CURVE_CACHE_CAPACITY);
    // Radius 1 survives; radius 2, the true least-recently-used, is the casualty.
    expect(getCachedBuilderOutput("squircle", buildSquircle, { ...base, cornerRadius: 1 })).toBe(one);
    expect(
      getCachedBuilderOutput("squircle", buildSquircle, { ...base, cornerRadius: 2 })
    ).not.toBe(refs[1]);
  });
});

describe("curve cache — non-finite inputs bypass the cache", () => {
  it("NaN cornerRadius does not pollute the cache", () => {
    const before = _curveCacheSize();
    getCachedBuilderOutput("squircle", buildSquircle, { ...base, cornerRadius: NaN });
    expect(_curveCacheSize()).toBe(before);
  });

  it("Infinity radius does not pollute the cache", () => {
    const before = _curveCacheSize();
    getCachedBuilderOutput("squircle", buildSquircle, { ...base, cornerRadius: Infinity });
    expect(_curveCacheSize()).toBe(before);
  });

  it("NaN smoothing/exponent/budget all bypass", () => {
    const before = _curveCacheSize();
    getCachedBuilderOutput("squircle", buildSquircle, { ...base, smoothing: NaN });
    getCachedBuilderOutput("squircle", buildSquircle, { ...base, exponent: NaN });
    getCachedBuilderOutput("squircle", buildSquircle, { ...base, roundingAndSmoothingBudget: NaN });
    expect(_curveCacheSize()).toBe(before);
  });
});

describe("curve cache — clearCurveCache", () => {
  it("clearCurveCache empties the cache", () => {
    getCachedBuilderOutput("squircle", buildSquircle, base);
    getCachedBuilderOutput("clothoid", buildClothoid, base);
    expect(_curveCacheSize()).toBeGreaterThan(0);
    clearCurveCache();
    expect(_curveCacheSize()).toBe(0);
  });

  it("after clear, the next call is a miss and refills the cache", () => {
    const first = getCachedBuilderOutput("squircle", buildSquircle, base);
    clearCurveCache();
    const second = getCachedBuilderOutput("squircle", buildSquircle, base);
    expect(second).not.toBe(first);
    expect(second.p).toBe(first.p);
    expect(second.pathSegment("TR")).toBe(first.pathSegment("TR"));
  });
});
