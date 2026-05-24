import type { CurveBuilder, CurveBuilderInput, CurveBuilderOutput, CurveType, Orient } from "./types.js";

/**
 * LRU cache for curve-builder output keyed on the shape-determining
 * inputs.
 *
 * The corner shape (`{ p, pathSegment(orient) }`) depends only on
 * `(curve, radius, smoothing, exponent, preserveSmoothing, budget)`.
 * Element width and height affect *where* the corner is placed in the
 * outer skeleton, not what the corner *looks like*. Real-world pages
 * have many elements sharing the same corner config but different
 * dimensions — without memoisation we re-do the full builder math
 * (including 32-point Simpson integration for clothoid) once per
 * element. The cache collapses that to one build per unique config.
 *
 * Capacity: 64. Real apps converge on a handful of corner configs
 * (default squircle, one or two custom radii); 64 is several multiples
 * of any realistic working set. Insertion-order Map gives O(1)
 * LRU-by-insertion semantics — on hit we delete + re-insert so the
 * most-recent entry is always at the end.
 *
 * Test escape valve: call `clearCurveCache()`. Tests that pin a
 * specific builder branch can call this to defeat warm-cache
 * artifacts.
 */
const CAPACITY = 64;
const cache = new Map<string, CurveBuilderOutput>();

function key(curve: CurveType, input: CurveBuilderInput): string {
  // Exact-number key. We deliberately do not round here: rounding
  // would let two inputs that differ by less than the tolerance share
  // a cache entry while the underlying builder math (and the public
  // `p`/path-string output) still differs — that's a correctness leak
  // where the cache returns output that doesn't match `builder(input)`
  // for that exact input. Identical inputs always hit; different
  // inputs always miss. Worst case is mild cache fragmentation for
  // near-identical floats, which the 64-entry LRU absorbs fine.
  return (
    curve +
    "|" +
    input.cornerRadius +
    "|" +
    input.smoothing +
    "|" +
    input.exponent +
    "|" +
    (input.preserveSmoothing ? 1 : 0) +
    "|" +
    input.roundingAndSmoothingBudget
  );
}

/**
 * `true` if any cache-key field is non-finite. We refuse to cache
 * those inputs — they'd otherwise occupy a permanent slot under the
 * `"NaN"` / `"Infinity"` string key and never evict via LRU. The
 * builder still runs (callers get whatever output the builder would
 * have produced uncached); we just don't memoise.
 */
function hasNonFiniteKeyField(input: CurveBuilderInput): boolean {
  return (
    !Number.isFinite(input.cornerRadius) ||
    !Number.isFinite(input.smoothing) ||
    !Number.isFinite(input.exponent) ||
    !Number.isFinite(input.roundingAndSmoothingBudget)
  );
}

/**
 * Wrap a builder output with lazy per-orient string memoisation. The
 * builder itself produces `pathSegment(orient)` that recomputes the
 * cubic-arc-cubic blend, `transformX/Y` calls, and `rounded.toFixed`
 * formatting on every call. Real workloads call each orient once per
 * `generatePath` so the second-and-onward calls for the same cached
 * shape can return the pre-rendered string directly.
 *
 * Cached strings: 4 orients × up to ~150 chars × 64 cache entries ≈
 * 40 KB worst case. Negligible.
 */
function wrapWithOrientCache(fresh: CurveBuilderOutput): CurveBuilderOutput {
  const orients: Partial<Record<Orient, string>> = {};
  return {
    p: fresh.p,
    pathSegment: (orient) => {
      const cached = orients[orient];
      if (cached !== undefined) return cached;
      const s = fresh.pathSegment(orient);
      orients[orient] = s;
      return s;
    },
  };
}

export function getCachedBuilderOutput(
  curve: CurveType,
  builder: CurveBuilder,
  input: CurveBuilderInput,
): CurveBuilderOutput {
  if (hasNonFiniteKeyField(input)) return builder(input);
  const k = key(curve, input);
  const cached = cache.get(k);
  if (cached) {
    // LRU touch: re-insert so this entry moves to the end.
    cache.delete(k);
    cache.set(k, cached);
    return cached;
  }
  const fresh = wrapWithOrientCache(builder(input));
  if (cache.size >= CAPACITY) {
    // Evict the least-recently-inserted entry — the first Map key.
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) cache.delete(firstKey);
  }
  cache.set(k, fresh);
  return fresh;
}

/** Capacity exposed for tests. */
export const CURVE_CACHE_CAPACITY = CAPACITY;

/** Internal: current size, for tests. */
export function _curveCacheSize(): number {
  return cache.size;
}

/** Test/debug escape hatch — clears the entire cache. */
export function clearCurveCache(): void {
  cache.clear();
}
