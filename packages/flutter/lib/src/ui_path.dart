import 'package:flutter/widgets.dart';

import 'geometry/lisse_corner.dart';
import 'geometry/lisse_path.dart';
import 'geometry/path_sink.dart';

/// Writes the geometry's relative/absolute commands into a `dart:ui` [Path].
/// Absolute moves/lines are shifted by the rect origin; relative cubics and
/// arcs pass straight through.
class _UiPathSink implements PathSink {
  _UiPathSink(this._path, this._ox, this._oy);

  final Path _path;
  final double _ox;
  final double _oy;

  @override
  void moveTo(double x, double y) => _path.moveTo(x + _ox, y + _oy);

  @override
  void lineTo(double x, double y) => _path.lineTo(x + _ox, y + _oy);

  @override
  void relativeCubicTo(
    double dx1,
    double dy1,
    double dx2,
    double dy2,
    double dx3,
    double dy3,
  ) => _path.relativeCubicTo(dx1, dy1, dx2, dy2, dx3, dy3);

  @override
  void relativeArcTo(double rx, double ry, double dx, double dy) =>
      _path.relativeArcToPoint(
        Offset(dx, dy),
        radius: Radius.elliptical(rx, ry),
        clockwise: true,
      );

  @override
  void close() => _path.close();
}

/// Builds a smooth-cornered [Path] filling [rect]. Public for custom
/// clippers/painters; most code uses `LisseBorder`.
Path lissePath(Rect rect, LisseCorners corners) {
  final Path path = Path();
  buildLissePath(
    _UiPathSink(path, rect.left, rect.top),
    rect.width,
    rect.height,
    corners,
  );
  return path;
}

/// A smooth-cornered [Path] at [inset] inside [rect] — radii reduced to stay
/// concentric. A negative [inset] grows the path outward.
Path insetLissePath(Rect rect, LisseCorners corners, double inset) =>
    lissePath(rect.deflate(inset), corners.deflate(inset));
