import 'dart:math' as math;

import '../builder.dart';
import '../orient.dart';

/// Superellipse corner. `|X/p|^n + |Y'/p|^n = 1` reflected into the corner,
/// running (0, 0) → (p, p). For n > 2 curvature is exactly 0 at the axis
/// crossings, so the curve is G2-flat with the adjacent edges. n = 2 is a
/// quarter circle; n = 4 is CSS `corner-shape: squircle`.
///
/// Three cubic Béziers per quadrant, sampled at θ ∈ {0, π/6, π/3, π/2},
/// each using the midpoint-match scheme (endpoint position + tangent, plus
/// the parameter midpoint).
CornerOutput buildSuperellipse(CurveBuilderInput input) {
  final double p =
      math.min(input.cornerRadius, input.roundingAndSmoothingBudget);
  if (p <= 0) return emptyCornerOutput;

  // n = 2 is a quarter-circle; n < 2 bulges concave; non-finite ⇒ NaN
  // downstream. Clamp before computing e = 2/n.
  final double n = input.exponent.isFinite ? math.max(2, input.exponent) : 4;
  final double e = 2 / n;
  final double e1 = e - 1;

  double powE(double x) {
    if (n == 2) return x;
    if (n == 4) return math.sqrt(x);
    if (n == 8) return math.sqrt(math.sqrt(x));
    return math.pow(x, e).toDouble();
  }

  double powE1(double x) {
    if (n == 2) return 1;
    if (n == 4) return 1 / math.sqrt(x);
    return math.pow(x, e1).toDouble();
  }

  final List<double> thetas = [0, math.pi / 6, math.pi / 3, math.pi / 2];

  // Pin endpoints to (0, 0) and (p, p): cos(π/2) is ~6e-17, not exact zero.
  final List<List<double>> points = [];
  for (int i = 0; i < thetas.length; i++) {
    if (i == 0) {
      points.add([0, 0]);
    } else if (i == thetas.length - 1) {
      points.add([p, p]);
    } else {
      final double sinTh = math.sin(thetas[i]);
      final double cosTh = math.cos(thetas[i]);
      points.add([p * powE(sinTh), p * (1 - powE(cosTh))]);
    }
  }

  // Endpoint tangents use the geometric limit (edge direction) — the
  // parametric form is numerically unstable at θ = 0 / π/2 for n > 2.
  final List<List<double>> tangents = [];
  for (int i = 0; i < thetas.length; i++) {
    if (i == 0) {
      tangents.add([1, 0]);
    } else if (i == thetas.length - 1) {
      tangents.add([0, 1]);
    } else {
      final double sinTh = math.sin(thetas[i]);
      final double cosTh = math.cos(thetas[i]);
      final double dX = e * powE1(sinTh) * cosTh * p;
      final double dY = e * powE1(cosTh) * sinTh * p;
      double m = math.sqrt(dX * dX + dY * dY);
      if (m == 0) m = 1;
      tangents.add([dX / m, dY / m]);
    }
  }

  return CornerOutput(p, (sink, orient) {
    for (int i = 0; i < thetas.length - 1; i++) {
      final double x0 = points[i][0];
      final double y0 = points[i][1];
      final double x1 = points[i + 1][0];
      final double y1 = points[i + 1][1];
      final double t0x = tangents[i][0];
      final double t0y = tangents[i][1];
      final double t1x = tangents[i + 1][0];
      final double t1y = tangents[i + 1][1];

      // Parameter midpoint — the third constraint that pins h0, h1.
      final double thMid = (thetas[i] + thetas[i + 1]) / 2;
      final double sinM = math.sin(thMid);
      final double cosM = math.cos(thMid);
      final double mx = p * powE(sinM);
      final double my = p * (1 - powE(cosM));

      // P(0.5) = ½(B0 + B3) + (3/8)(h0 T0 − h1 T1); solve for h0, h1.
      final double rhsX = (8 / 3) * (mx - (x0 + x1) / 2);
      final double rhsY = (8 / 3) * (my - (y0 + y1) / 2);
      final double det = t1x * t0y - t1y * t0x;
      final double h0 = det != 0 ? (-t1y * rhsX + t1x * rhsY) / det : 0;
      final double h1 = det != 0 ? (t0x * rhsY - t0y * rhsX) / det : 0;

      final double b1x = x0 + h0 * t0x;
      final double b1y = y0 + h0 * t0y;
      final double b2x = x1 - h1 * t1x;
      final double b2y = y1 - h1 * t1y;

      final double dB1x = b1x - x0;
      final double dB1y = b1y - y0;
      final double dB2x = b2x - x0;
      final double dB2y = b2y - y0;
      final double dB3x = x1 - x0;
      final double dB3y = y1 - y0;

      sink.relativeCubicTo(
        transformX(dB1x, dB1y, orient),
        transformY(dB1x, dB1y, orient),
        transformX(dB2x, dB2y, orient),
        transformY(dB2x, dB2y, orient),
        transformX(dB3x, dB3y, orient),
        transformY(dB3x, dB3y, orient),
      );
    }
  });
}
