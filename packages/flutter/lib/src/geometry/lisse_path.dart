import 'builder.dart';
import 'corner_cache.dart';
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

  CornerOutput build(Corner corner, LisseCorner config) {
    final NormalizedCorner n = normalized[corner]!;
    return getCachedBuilderOutput(
      config.curve,
      getCurveBuilder(config.curve),
      CurveBuilderInput(
        cornerRadius: n.radius,
        smoothing: config.smoothing,
        exponent: config.exponent,
        preserveSmoothing: config.preserveSmoothing,
        roundingAndSmoothingBudget: n.roundingAndSmoothingBudget,
      ),
    );
  }

  final CornerOutput tl = build(Corner.topLeft, corners.topLeft);
  final CornerOutput tr = build(Corner.topRight, corners.topRight);
  final CornerOutput br = build(Corner.bottomRight, corners.bottomRight);
  final CornerOutput bl = build(Corner.bottomLeft, corners.bottomLeft);

  // Each side ends with a paired L to the next corner's `p` — a no-op when
  // adjacent radii match, harmless otherwise.
  sink.moveTo(tl.p, 0);
  sink.lineTo(width - tr.p, 0);
  tr.emit(sink, Orient.tr);
  sink.lineTo(width, br.p);
  sink.lineTo(width, height - br.p);
  br.emit(sink, Orient.br);
  sink.lineTo(width - bl.p, height);
  sink.lineTo(bl.p, height);
  bl.emit(sink, Orient.bl);
  sink.lineTo(0, height - tl.p);
  sink.lineTo(0, tl.p);
  tl.emit(sink, Orient.tl);
  sink.close();
}

/// SVG path `d` string for a smooth-cornered rectangle. For
/// verification/debugging; the rendering path uses a `dart:ui` sink.
String debugPathData(double width, double height, LisseCorners corners) {
  final StringPathSink sink = StringPathSink();
  buildLissePath(sink, width, height, corners);
  return sink.data;
}
