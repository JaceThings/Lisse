import type { CurveBuilder, CurveBuilderInput, CurveBuilderOutput, CurveType, Orient } from "./types.js";

/**
 * LRU cache for curve-builder output. The corner shape depends only on
 * `(curve, radius, smoothing, exponent, preserveSmoothing, budget)` —
 * width/height affect where the corner sits in the outer skeleton, not
 * its shape. Without memoisation, pages with many elements sharing one
 * corner config re-run the full math (including 32-point Simpson
 * integration for clothoid) per element.
 *
 * Map insertion order = LRU order: touch by delete+set, evict the
 * first key. Capacity 64 is several multiples of any realistic
 * working set.
 */
const CAPACITY = 64;
const cache = new Map<string, CurveBuilderOutput>();

function key(curve: CurveType, input: CurveBuilderInput): string {
  // Exact-number key — rounding would let two inputs that differ by
  // less than the tolerance share an entry while `builder(input)`
  // would still produce different bytes for each. Mild fragmentation
  // for near-identical floats is fine; correctness drift is not.
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
 * Non-finite inputs (NaN, Infinity) bypass the cache — they'd
 * otherwise occupy a permanent `"NaN"`-keyed slot that never evicts.
 * Builder still runs; output just isn't memoised.
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
 * Lazy per-orient string memoisation. The builder's `pathSegment` re-
 * runs the cubic-arc-cubic blend, `transformX/Y`, and toFixed work on
 * every call. Real workloads call each orient once per `generatePath`
 * so subsequent calls for the same cached shape return the pre-built
 * string directly.
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
    cache.delete(k);
    cache.set(k, cached);
    return cached;
  }
  const fresh = wrapWithOrientCache(builder(input));
  if (cache.size >= CAPACITY) {
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) cache.delete(firstKey);
  }
  cache.set(k, fresh);
  return fresh;
}

export const CURVE_CACHE_CAPACITY = CAPACITY;

export function _curveCacheSize(): number {
  return cache.size;
}

/** Clears the entire cache. */
export function clearCurveCache(): void {
  cache.clear();
}
