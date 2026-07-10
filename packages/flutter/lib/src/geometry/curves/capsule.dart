import 'dart:math' as math;

import '../path_sink.dart';
import 'corner_params.dart';

/// Sketch-style capsule smoothing. A capsule end cap is the Figma squircle
/// shoulder applied on the flat-edge side only, with the circular arc carried
/// to the cap midline: shoulder cubic → arc → arc → mirrored shoulder cubic,
/// one continuous segment per end. Reuses [getPathParamsForCorner] verbatim so
/// the shoulder math is identical to the squircle corner.
class CapsuleEndParams {
  final double p;
  final double a;
  final double b;
  final double c;
  final double d;
  final double e;

  /// Arc chord along the long axis, `p − e = R·(1 − sinβ)`.
  final double ax;

  /// Arc chord toward the midline, `R − d = R·cosβ`.
  final double ay;
  final double r;

  const CapsuleEndParams({
    required this.p,
    required this.a,
    required this.b,
    required this.c,
    required this.d,
    required this.e,
    required this.ax,
    required this.ay,
    required this.r,
  });
}

/// [longHalf] is each end's share of the long axis — half the long side,
/// conservative when the opposite end is smaller.
CapsuleEndParams capsuleEndParams(
  double r,
  double smoothing,
  bool preserveSmoothing,
  double longHalf,
) {
  // The flat edge absorbs all smoothing; when it has no room (near-square) s
  // collapses so the cap stays a true circle. Clamping unconditionally keeps p
  // within budget, so the preserveSmoothing branch is inert and β stays
  // consistent.
  final double sEff = math.min(smoothing, longHalf / r - 1);
  final CornerPathParams params = getPathParamsForCorner(
    cornerRadius: r,
    cornerSmoothing: sEff,
    preserveSmoothing: preserveSmoothing,
    roundingAndSmoothingBudget: longHalf,
  );
  final double e = params.a + params.b + params.c;
  return CapsuleEndParams(
    p: params.p,
    a: params.a,
    b: params.b,
    c: params.c,
    d: params.d,
    e: e,
    ax: params.p - e,
    ay: r - params.d,
    r: r,
  );
}

/// Right cap: (width−p, 0) → (width−p, height).
void drawRightCap(PathSink s, CapsuleEndParams p) {
  s.relativeCubicTo(p.a, 0, p.a + p.b, 0, p.e, p.d);
  s.relativeArcTo(p.r, p.r, p.ax, p.ay);
  s.relativeArcTo(p.r, p.r, -p.ax, p.ay);
  s.relativeCubicTo(-p.c, p.d, -(p.b + p.c), p.d, -p.e, p.d);
}

/// Left cap: (p, height) → (p, 0).
void drawLeftCap(PathSink s, CapsuleEndParams p) {
  s.relativeCubicTo(-p.a, 0, -(p.a + p.b), 0, -p.e, -p.d);
  s.relativeArcTo(p.r, p.r, -p.ax, -p.ay);
  s.relativeArcTo(p.r, p.r, p.ax, -p.ay);
  s.relativeCubicTo(p.c, -p.d, p.b + p.c, -p.d, p.e, -p.d);
}

/// Top cap: (0, p) → (width, p).
void drawTopCap(PathSink s, CapsuleEndParams p) {
  s.relativeCubicTo(0, -p.a, 0, -(p.a + p.b), p.d, -p.e);
  s.relativeArcTo(p.r, p.r, p.ay, -p.ax);
  s.relativeArcTo(p.r, p.r, p.ay, p.ax);
  s.relativeCubicTo(p.d, p.c, p.d, p.b + p.c, p.d, p.e);
}

/// Bottom cap: (width, height−p) → (0, height−p).
void drawBottomCap(PathSink s, CapsuleEndParams p) {
  s.relativeCubicTo(0, p.a, 0, p.a + p.b, -p.d, p.e);
  s.relativeArcTo(p.r, p.r, -p.ay, p.ax);
  s.relativeArcTo(p.r, p.r, -p.ay, -p.ax);
  s.relativeCubicTo(-p.d, -p.c, -p.d, -(p.b + p.c), -p.d, -p.e);
}
