import type { CurveBuilder, CurveBuilderInput, CurveBuilderOutput, CurveType, Orient } from "./types.js";

/**
 * LRU cache for curve-builder output. The corner shape depends only on
 * `(curve, radius, smoothing, exponent, preserveSmoothing, budget)` —
 * width/height place the corner in the skeleton but don't change its shape.
 *
 * Map insertion order = LRU order: touch by delete+set, evict the first
 * key. Capacity 64 is several multiples of any realistic working set.
 */
const CAPACITY = 64;
const cache = new Map<string, CurveBuilderOutput>();

/** Key most recently moved to the back of `cache`. A hit on it needs no
 *  delete+set: the entry is already last in insertion order, so the touch is
 *  three rehashing Map operations that change nothing. A page whose elements
 *  share one corner config hammers exactly this key. `null` whenever the
 *  newest key is unknown (start, after `clearCurveCache`). */
let newestKey: string | null = null;

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

/** Non-finite inputs bypass the cache — they'd otherwise pin a permanent
 *  `"NaN"`-keyed slot that never evicts. The builder still runs. */
function hasNonFiniteKeyField(input: CurveBuilderInput): boolean {
  return (
    !Number.isFinite(input.cornerRadius) ||
    !Number.isFinite(input.smoothing) ||
    !Number.isFinite(input.exponent) ||
    !Number.isFinite(input.roundingAndSmoothingBudget)
  );
}

/** Lazy per-orient string memoisation — `pathSegment` re-runs the blend,
 *  transforms, and toFixed on every call, so cache the string per orient. */
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
    if (k !== newestKey) {
      cache.delete(k);
      cache.set(k, cached);
      newestKey = k;
    }
    return cached;
  }
  const fresh = wrapWithOrientCache(builder(input));
  if (cache.size >= CAPACITY) {
    cache.delete(cache.keys().next().value!);
  }
  cache.set(k, fresh);
  newestKey = k;
  return fresh;
}

export const CURVE_CACHE_CAPACITY = CAPACITY;

export function _curveCacheSize(): number {
  return cache.size;
}

export function clearCurveCache(): void {
  cache.clear();
  newestKey = null;
}
