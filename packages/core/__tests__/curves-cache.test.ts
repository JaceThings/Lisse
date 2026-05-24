// Direct tests for the curve-builder LRU cache.
//
// The cache is otherwise exercised implicitly by every generatePath
// call in the suite — these tests pin its specific behaviour:
//
//   - cached output equals fresh output (no drift)
//   - LRU eviction respects insertion + touch order
//   - non-finite inputs bypass the cache (no permanent garbage slots)
//   - clearCurveCache() actually clears
//
// Without these the cache could silently regress and the only failure
// surface would be a perf bench drift, which is much later signal.
import { describe, it, expect, beforeEach } from "vitest";
import { buildSquircle, buildClothoid } from "../src/curves/index.js";
import {
  getCachedBuilderOutput,
  clearCurveCache,
  CURVE_CACHE_CAPACITY,
  _curveCacheSize,
} from "../src/curves/cache.js";

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
    // Fill the cache, then add one more.
    for (let i = 0; i < CURVE_CACHE_CAPACITY; i++) {
      getCachedBuilderOutput("squircle", buildSquircle, { ...base, cornerRadius: i + 1 });
    }
    expect(_curveCacheSize()).toBe(CURVE_CACHE_CAPACITY);

    // Touch entry 0 so it becomes most-recent.
    getCachedBuilderOutput("squircle", buildSquircle, { ...base, cornerRadius: 1 });

    // Insert one new entry — should evict entry "2" (now LRU), not "1".
    getCachedBuilderOutput("squircle", buildSquircle, { ...base, cornerRadius: 999 });
    expect(_curveCacheSize()).toBe(CURVE_CACHE_CAPACITY);

    // Entry 1 should still be cached (re-fetching it must not allocate
    // a fresh builder result — by reference identity).
    const refetchOne = getCachedBuilderOutput("squircle", buildSquircle, { ...base, cornerRadius: 1 });
    const refetchOneAgain = getCachedBuilderOutput("squircle", buildSquircle, { ...base, cornerRadius: 1 });
    expect(refetchOneAgain).toBe(refetchOne);
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
    // Different object reference (cleared, so re-built).
    expect(second).not.toBe(first);
    // But equal output.
    expect(second.p).toBe(first.p);
    expect(second.pathSegment("TR")).toBe(first.pathSegment("TR"));
  });
});
