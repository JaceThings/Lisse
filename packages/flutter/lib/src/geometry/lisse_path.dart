import 'dart:math' as math;

import 'builder.dart';
import 'corner_cache.dart';
import 'curves/blend.dart';
import 'curves/capsule.dart';
import 'curves/registry.dart';
import 'distribute.dart';
import 'lisse_corner.dart';
import 'lisse_curve.dart';
import 'orient.dart';
import 'path_sink.dart';

double _finite(double v, double fallback) => v.isFinite ? v : fallback;

// Non-finite radius/smoothing/exponent would propagate NaN into a dart:ui
// Path, which asserts on non-finite coordinates. Replace them with safe
// fallbacks so the outline is always drawable.
LisseCorner _sanitiseCorner(LisseCorner c) {
  if (c.radius.isFinite && c.smoothing.isFinite && c.exponent.isFinite) {
    return c;
  }
  return c.copyWith(
    radius: _finite(c.radius, 0),
    smoothing: _finite(c.smoothing, kDefaultSmoothing),
    exponent: _finite(c.exponent, kDefaultExponent),
  );
}

LisseCorners _sanitise(LisseCorners c) => LisseCorners(
      topLeft: _sanitiseCorner(c.topLeft),
      topRight: _sanitiseCorner(c.topRight),
      bottomRight: _sanitiseCorner(c.bottomRight),
      bottomLeft: _sanitiseCorner(c.bottomLeft),
    );

/// Emits a smooth-cornered rectangle outline into [sink]. Pure geometry —
/// no `dart:ui`. The order mirrors a clockwise traversal starting from the
/// top edge: top-right, bottom-right, bottom-left, top-left.
void buildLissePath(
  PathSink sink,
  double width,
  double height,
  LisseCorners corners,
) {
  if (width <= 0 || height <= 0) {
    sink.moveTo(0, 0);
    sink.close();
    return;
  }

  corners = _sanitise(corners);

  // Fast path: all corners zero — an exact rectangle.
  if (corners.isAllZero) {
    sink.moveTo(0, 0);
    sink.lineTo(width, 0);
    sink.lineTo(width, height);
    sink.lineTo(0, height);
    sink.close();
    return;
  }

  final Map<Corner, NormalizedCorner> normalized = distributeAndNormalize(
    topLeftCornerRadius: corners.topLeft.radius,
    topRightCornerRadius: corners.topRight.radius,
    bottomRightCornerRadius: corners.bottomRight.radius,
    bottomLeftCornerRadius: corners.bottomLeft.radius,
    width: width,
    height: height,
  );

  // Lazy: the blend and cap branches return without touching some (or any)
  // corners, so build each at most once and only on demand.
  final Map<Corner, CornerOutput> built = <Corner, CornerOutput>{};
  CornerOutput out(Corner corner, LisseCorner config) {
    return built[corner] ??= getCachedBuilderOutput(
      config.curve,
      getCurveBuilder(config.curve),
      CurveBuilderInput(
        cornerRadius: normalized[corner]!.radius,
        smoothing: config.smoothing,
        exponent: config.exponent,
        preserveSmoothing: config.preserveSmoothing,
        roundingAndSmoothingBudget:
            normalized[corner]!.roundingAndSmoothingBudget,
      ),
    );
  }

  CornerOutput tl() => out(Corner.topLeft, corners.topLeft);
  CornerOutput tr() => out(Corner.topRight, corners.topRight);
  CornerOutput br() => out(Corner.bottomRight, corners.bottomRight);
  CornerOutput bl() => out(Corner.bottomLeft, corners.bottomLeft);

  // Blend band: a uniform squircle whose short side sits strictly in
  // (2R, 2(1+s)R) morphs per-edge toward the capsule instead of popping. Both
  // band edges fall through to the byte-identical pure regimes.
  final LisseCorner u = corners.topLeft;
  if (_isUniformSquircle(corners)) {
    final double blendR = math.min(u.radius, math.min(width / 2, height / 2));
    final double shortHalf = math.min(width, height) / 2;
    const double bandEps = 1e-9;
    if (blendR > 0 &&
        shortHalf > blendR + bandEps &&
        shortHalf < (1 + u.smoothing) * blendR - bandEps) {
      drawBlendPath(
        sink,
        width,
        height,
        blendR,
        u.smoothing,
        u.preserveSmoothing,
      );
      return;
    }
  }

  // Sketch-style capsule smoothing: a fully-rounded end becomes one continuous
  // cap segment. Each end is independent (half-pills work); non-capsule ends
  // fall through to the byte-identical template below.
  const double eps = 1e-9;
  final bool horizontal = width >= height;
  final double capR = horizontal ? height / 2 : width / 2;
  bool isCap(Corner x, LisseCorner cx, Corner y, LisseCorner cy) {
    return cx.curve == LisseCurve.squircle &&
        cy.curve == LisseCurve.squircle &&
        (normalized[x]!.radius - capR).abs() < eps &&
        (normalized[y]!.radius - capR).abs() < eps &&
        cx.smoothing == cy.smoothing &&
        cx.preserveSmoothing == cy.preserveSmoothing;
  }

  if (horizontal) {
    final bool rightCap = isCap(
      Corner.topRight,
      corners.topRight,
      Corner.bottomRight,
      corners.bottomRight,
    );
    final bool leftCap = isCap(
      Corner.topLeft,
      corners.topLeft,
      Corner.bottomLeft,
      corners.bottomLeft,
    );
    if (rightCap || leftCap) {
      final double longHalf = width / 2;
      final CapsuleEndParams? cR = rightCap
          ? capsuleEndParams(
              capR,
              corners.topRight.smoothing,
              corners.topRight.preserveSmoothing,
              longHalf,
            )
          : null;
      final CapsuleEndParams? cL = leftCap
          ? capsuleEndParams(
              capR,
              corners.topLeft.smoothing,
              corners.topLeft.preserveSmoothing,
              longHalf,
            )
          : null;

      sink.moveTo(cL != null ? cL.p : tl().p, 0);
      sink.lineTo(width - (cR != null ? cR.p : tr().p), 0);
      if (cR != null) {
        drawRightCap(sink, cR);
      } else {
        tr().emit(sink, Orient.tr);
        sink.lineTo(width, br().p);
        sink.lineTo(width, height - br().p);
        br().emit(sink, Orient.br);
      }
      if (cL != null) {
        sink.lineTo(cL.p, height);
        drawLeftCap(sink, cL);
      } else {
        sink.lineTo(width - bl().p, height);
        sink.lineTo(bl().p, height);
        bl().emit(sink, Orient.bl);
        sink.lineTo(0, height - tl().p);
        sink.lineTo(0, tl().p);
        tl().emit(sink, Orient.tl);
      }
      sink.close();
      return;
    }
  } else {
    final bool topCap = isCap(
      Corner.topLeft,
      corners.topLeft,
      Corner.topRight,
      corners.topRight,
    );
    final bool bottomCap = isCap(
      Corner.bottomLeft,
      corners.bottomLeft,
      Corner.bottomRight,
      corners.bottomRight,
    );
    if (topCap || bottomCap) {
      final double longHalf = height / 2;
      final CapsuleEndParams? cT = topCap
          ? capsuleEndParams(
              capR,
              corners.topLeft.smoothing,
              corners.topLeft.preserveSmoothing,
              longHalf,
            )
          : null;
      final CapsuleEndParams? cB = bottomCap
          ? capsuleEndParams(
              capR,
              corners.bottomLeft.smoothing,
              corners.bottomLeft.preserveSmoothing,
              longHalf,
            )
          : null;

      if (cT != null) {
        sink.moveTo(0, cT.p);
        drawTopCap(sink, cT);
      } else {
        sink.moveTo(tl().p, 0);
        sink.lineTo(width - tr().p, 0);
        tr().emit(sink, Orient.tr);
      }
      sink.lineTo(width, height - (cB != null ? cB.p : br().p));
      if (cB != null) {
        drawBottomCap(sink, cB);
      } else {
        br().emit(sink, Orient.br);
        sink.lineTo(bl().p, height);
        bl().emit(sink, Orient.bl);
      }
      if (cT != null) {
        sink.lineTo(0, cT.p);
      } else {
        sink.lineTo(0, height - tl().p);
        sink.lineTo(0, tl().p);
        tl().emit(sink, Orient.tl);
      }
      sink.close();
      return;
    }
  }

  // Each side ends with a paired L to the next corner's `p` — a no-op when
  // adjacent radii match, harmless otherwise.
  sink.moveTo(tl().p, 0);
  sink.lineTo(width - tr().p, 0);
  tr().emit(sink, Orient.tr);
  sink.lineTo(width, br().p);
  sink.lineTo(width, height - br().p);
  br().emit(sink, Orient.br);
  sink.lineTo(width - bl().p, height);
  sink.lineTo(bl().p, height);
  bl().emit(sink, Orient.bl);
  sink.lineTo(0, height - tl().p);
  sink.lineTo(0, tl().p);
  tl().emit(sink, Orient.tl);
  sink.close();
}

/// Uniform squircle across all four corners (radius, smoothing, preserve
/// match) — the gate for the blend regime. Exponent is irrelevant to squircle.
bool _isUniformSquircle(LisseCorners c) {
  final LisseCorner u = c.topLeft;
  if (u.curve != LisseCurve.squircle) return false;
  for (final LisseCorner o in <LisseCorner>[
    c.topRight,
    c.bottomRight,
    c.bottomLeft,
  ]) {
    if (o.curve != LisseCurve.squircle ||
        o.radius != u.radius ||
        o.smoothing != u.smoothing ||
        o.preserveSmoothing != u.preserveSmoothing) {
      return false;
    }
  }
  return true;
}

/// SVG path `d` string for a smooth-cornered rectangle. For
/// verification/debugging; the rendering path uses a `dart:ui` sink.
String debugPathData(double width, double height, LisseCorners corners) {
  final StringPathSink sink = StringPathSink();
  buildLissePath(sink, width, height, corners);
  return sink.data;
}
