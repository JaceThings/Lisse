import 'dart:math' as math;

import '../builder.dart';
import '../orient.dart';
import 'integrate.dart';

const double _angleEpsilon = 1e-6;

/// Clothoid blend: line → clothoid → arc → clothoid → line. Curvature ramps
/// linearly along arc length from 0 (edge) to 1/R (central arc) and mirrors
/// on the way out. G2 at every seam.
///
/// Smoothing s ∈ [0, 1] splits the 90° rotation: each clothoid half rotates
/// (π/4)·s, the arc rotates (π/2)(1 − s). s = 0 is a quarter circle; s = 1
/// is the pure Cornu corner. One cubic Bézier per half-fillet + one SVG `a`.
CornerOutput buildClothoid(CurveBuilderInput input) {
  if (input.cornerRadius <= 0) return emptyCornerOutput;
  final double s = math.max(0, math.min(1, input.smoothing));
  final double r = input.cornerRadius;
  final double dTheta = (math.pi / 4) * s;
  final double l = (math.pi / 2) * r * s;
  // κ(s) = A·s with A = 1/(R·L), so κ(L) = 1/R.
  final double a = l > 0 ? 1 / (r * l) : 0;

  final ClothoidPoint end =
      l > 0 ? integrateClothoid(0, 0, a, l) : const ClothoidPoint(0, 0, 0);
  final ClothoidPoint mid =
      l > 0 ? integrateClothoid(0, 0, a, l / 2) : const ClothoidPoint(0, 0, 0);
  final double xC = end.x, yC = end.y;
  final double xMid = mid.x, yMid = mid.y;

  // Arc centre sits R to the left of the end tangent; by symmetry it lies on
  // the diagonal X + Y = p.
  final double arcCx = xC - r * math.sin(dTheta);
  final double arcCy = yC + r * math.cos(dTheta);
  final double naturalP = arcCx + arcCy;

  // Scale R proportionally when the natural footprint overshoots the budget.
  double p = naturalP;
  double effR = r;
  double effX = xC;
  double effY = yC;
  double effMx = xMid;
  double effMy = yMid;
  if (naturalP > input.roundingAndSmoothingBudget && naturalP > 0) {
    final double scale = input.roundingAndSmoothingBudget / naturalP;
    p = input.roundingAndSmoothingBudget;
    effR = r * scale;
    effX = xC * scale;
    effY = yC * scale;
    effMx = xMid * scale;
    effMy = yMid * scale;
  }
  if (p <= 0) return emptyCornerOutput;

  // Midpoint-match cubic for the half-fillet. Endpoint position + tangent
  // (4 constraints) and the clothoid midpoint (2) pin h0, h1.
  double h0 = 0;
  double h1 = 0;
  if (l > 0) {
    final double cosDt = math.cos(dTheta);
    final double sinDt = math.sin(dTheta);
    if (sinDt > 1e-12) {
      h1 = ((8 / 3) * (effY / 2 - effMy)) / sinDt;
    }
    h0 = (8 / 3) * (effMx - effX / 2) + h1 * cosDt;
  }

  final double arcSweep = math.pi / 2 - 2 * dTheta;
  final bool hasArc = arcSweep.abs() > _angleEpsilon;
  final double cosDt = math.cos(dTheta);
  final double sinDt = math.sin(dTheta);

  return CornerOutput(p, (sink, orient) {
    if (l > 0) {
      // Cloth1: B0 = (0, 0), B1 = (h0, 0), B3 = (effX, effY),
      // B2 = B3 − h1·(cos dTheta, sin dTheta).
      final double b1dx = h0;
      const double b1dy = 0;
      final double b2dx = effX - h1 * cosDt;
      final double b2dy = effY - h1 * sinDt;
      final double b3dx = effX;
      final double b3dy = effY;
      sink.relativeCubicTo(
        transformX(b1dx, b1dy, orient),
        transformY(b1dx, b1dy, orient),
        transformX(b2dx, b2dy, orient),
        transformY(b2dx, b2dy, orient),
        transformX(b3dx, b3dy, orient),
        transformY(b3dx, b3dy, orient),
      );
    }

    if (hasArc) {
      // Arc (effX, effY) → (p − effY, p − effX); relative delta is
      // (p − effX − effY, p − effX − effY) on both axes by symmetry.
      final double arcDelta = p - effX - effY;
      sink.relativeArcTo(
        effR,
        effR,
        transformX(arcDelta, arcDelta, orient),
        transformY(arcDelta, arcDelta, orient),
      );
    }

    if (l > 0) {
      // Cloth2: mirror of cloth1 across X + Y = p.
      final double b1dx = h1 * sinDt;
      final double b1dy = h1 * cosDt;
      final double b2dx = effY;
      final double b2dy = effX - h0;
      final double b3dx = effY;
      final double b3dy = effX;
      sink.relativeCubicTo(
        transformX(b1dx, b1dy, orient),
        transformY(b1dx, b1dy, orient),
        transformX(b2dx, b2dy, orient),
        transformY(b2dx, b2dy, orient),
        transformX(b3dx, b3dy, orient),
        transformY(b3dx, b3dy, orient),
      );
    }
  });
}
