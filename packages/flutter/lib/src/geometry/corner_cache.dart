import 'dart:collection';

import 'builder.dart';
import 'lisse_curve.dart';

/// LRU cache for curve-builder output. The corner shape depends only on
/// `(curve, radius, smoothing, exponent, preserveSmoothing, budget)` —
/// width/height affect where the corner sits in the outer skeleton, not its
/// shape. Without memoisation, many elements sharing one corner config
/// re-run the full math (including 32-point Simpson integration for
/// clothoid) per element.
///
/// `LinkedHashMap` insertion order = LRU order: touch by remove+put, evict
/// the first key. Capacity 64 is several multiples of any realistic working
/// set.
const int _capacity = 64;
final LinkedHashMap<String, CornerOutput> _cache =
    LinkedHashMap<String, CornerOutput>();

String _key(LisseCurve curve, CurveBuilderInput input) {
  return '${curve.index}|${input.cornerRadius}|${input.smoothing}'
      '|${input.exponent}|${input.preserveSmoothing ? 1 : 0}'
      '|${input.roundingAndSmoothingBudget}';
}

bool _hasNonFiniteKeyField(CurveBuilderInput input) {
  return !input.cornerRadius.isFinite ||
      !input.smoothing.isFinite ||
      !input.exponent.isFinite ||
      !input.roundingAndSmoothingBudget.isFinite;
}

/// Returns memoised corner output, computing and caching on a miss.
CornerOutput getCachedBuilderOutput(
  LisseCurve curve,
  CurveBuilder builder,
  CurveBuilderInput input,
) {
  if (_hasNonFiniteKeyField(input)) return builder(input);
  final String k = _key(curve, input);
  final CornerOutput? cached = _cache[k];
  if (cached != null) {
    // Touch by remove + re-insert so the entry moves to the LRU tail.
    _cache.remove(k);
    _cache[k] = cached;
    return cached;
  }
  final CornerOutput fresh = builder(input);
  if (_cache.length >= _capacity) {
    _cache.remove(_cache.keys.first);
  }
  _cache[k] = fresh;
  return fresh;
}

/// Clears the entire cache (tests / per-request SSR-style reset).
void clearCurveCache() {
  _cache.clear();
}
