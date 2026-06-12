import 'dart:math' as math;

double _toRadians(double degrees) => degrees * math.pi / 180;

/// Resolved Figma-squircle control parameters for one corner.
class CornerPathParams {
  final double a;
  final double b;
  final double c;
  final double d;
  final double p;
  final double arcSectionLength;
  final double cornerRadius;

  const CornerPathParams({
    required this.a,
    required this.b,
    required this.c,
    required this.d,
    required this.p,
    required this.arcSectionLength,
    required this.cornerRadius,
  });
}

/// Compute bezier curve parameters for a single corner.
///
/// Based on Figma's squircle blog post and MartinRGB's approximation.
CornerPathParams getPathParamsForCorner({
  required double cornerRadius,
  required double cornerSmoothing,
  required bool preserveSmoothing,
  required double roundingAndSmoothingBudget,
}) {
  // Short-circuit: the `!preserveSmoothing` branch divides by cornerRadius.
  if (cornerRadius <= 0) {
    return const CornerPathParams(
      a: 0,
      b: 0,
      c: 0,
      d: 0,
      p: 0,
      arcSectionLength: 0,
      cornerRadius: 0,
    );
  }

  // From figure 12.2: p = (1 + cornerSmoothing) * q, where q = R (θ = 90°).
  double p = (1 + cornerSmoothing) * cornerRadius;

  if (!preserveSmoothing) {
    final double maxCornerSmoothing =
        roundingAndSmoothingBudget / cornerRadius - 1;
    cornerSmoothing = math.min(cornerSmoothing, maxCornerSmoothing);
    p = math.min(p, roundingAndSmoothingBudget);
  }

  // Arc measure shrinks as smoothing increases.
  final double arcMeasure = 90 * (1 - cornerSmoothing);
  final double arcSectionLength =
      math.sin(_toRadians(arcMeasure / 2)) * cornerRadius * math.sqrt(2);

  // Distance between control points P3 and P4.
  final double angleAlpha = (90 - arcMeasure) / 2;
  final double p3ToP4Distance =
      cornerRadius * math.tan(_toRadians(angleAlpha / 2));

  // a, b, c, d from figure 11.1.
  final double angleBeta = 45 * cornerSmoothing;
  final double c = p3ToP4Distance * math.cos(_toRadians(angleBeta));
  final double d = c * math.tan(_toRadians(angleBeta));

  double b = (p - arcSectionLength - c - d) / 3;
  double a = 2 * b;

  // Adjust P1/P2 control points when space is limited.
  if (preserveSmoothing && p > roundingAndSmoothingBudget) {
    final double p1ToP3MaxDistance =
        roundingAndSmoothingBudget - d - arcSectionLength - c;

    final double minA = p1ToP3MaxDistance / 6;
    final double maxB = p1ToP3MaxDistance - minA;

    b = math.min(b, maxB);
    a = p1ToP3MaxDistance - b;
    p = math.min(p, roundingAndSmoothingBudget);
  }

  return CornerPathParams(
    a: a,
    b: b,
    c: c,
    d: d,
    p: p,
    arcSectionLength: arcSectionLength,
    cornerRadius: cornerRadius,
  );
}
