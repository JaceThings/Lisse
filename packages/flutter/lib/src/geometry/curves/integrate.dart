import 'dart:math' as math;

/// Endpoint of a clothoid position integral.
class ClothoidPoint {
  final double x;
  final double y;
  final double theta;
  const ClothoidPoint(this.x, this.y, this.theta);
}

/// Simpson's-rule integration of the clothoid position integrals
///     X(L) = ∫₀ᴸ cos θ(s) ds,   Y(L) = ∫₀ᴸ sin θ(s) ds
/// where θ(s) = θ₀ + κ₀·s + (A/2)·s². Returns endpoint (x, y) and θ(L).
///
/// N = 32 keeps the absolute position error below 1e-4 across all
/// Lisse-realistic radii (R ≤ 500). Simpson error is O((L/N)⁴·L).
ClothoidPoint integrateClothoid(
  double theta0,
  double kappa0,
  double a,
  double l,
) {
  const int n = 32;
  if (l <= 0) return ClothoidPoint(0, 0, theta0);

  final double step = l / n;
  double xAcc = 0;
  double yAcc = 0;
  for (int i = 1; i <= n; i++) {
    final double sA = (i - 1) * step;
    final double sB = sA + step;
    final double sM = (sA + sB) / 2;
    final double thA = theta0 + kappa0 * sA + (a / 2) * sA * sA;
    final double thB = theta0 + kappa0 * sB + (a / 2) * sB * sB;
    final double thM = theta0 + kappa0 * sM + (a / 2) * sM * sM;
    xAcc += (step / 6) * (math.cos(thA) + 4 * math.cos(thM) + math.cos(thB));
    yAcc += (step / 6) * (math.sin(thA) + 4 * math.sin(thM) + math.sin(thB));
  }
  final double thetaEnd = theta0 + kappa0 * l + (a / 2) * l * l;
  return ClothoidPoint(xAcc, yAcc, thetaEnd);
}
