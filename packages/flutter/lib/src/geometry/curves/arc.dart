import 'dart:math' as math;

import '../builder.dart';
import '../orient.dart';

/// Plain quarter-circle corner via native SVG `a`. G1 with the adjacent
/// edges: tangent matches but curvature jumps from 0 to 1/R at the seam.
/// This is the CSS `border-radius` curve and the smoothing → 0 fallback.
///
/// Ignores `smoothing` and `exponent`. `p` is clamped to the budget so the
/// adjacent straight `L` segments can't overlap.
CornerOutput buildArc(CurveBuilderInput input) {
  final double p =
      math.min(input.cornerRadius, input.roundingAndSmoothingBudget);
  if (p <= 0) return emptyCornerOutput;
  return CornerOutput(p, (sink, orient) {
    final double dx = transformX(p, p, orient);
    final double dy = transformY(p, p, orient);
    sink.relativeArcTo(p, p, dx, dy);
  });
}
