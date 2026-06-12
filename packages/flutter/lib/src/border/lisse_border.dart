import 'package:flutter/widgets.dart';

import '../geometry/lisse_corner.dart';
import '../geometry/lisse_curve.dart';
import '../geometry/lisse_path.dart';
import '../geometry/path_sink.dart';

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
  ) =>
      _path.relativeCubicTo(dx1, dy1, dx2, dy2, dx3, dy3);

  @override
  void relativeArcTo(
    double rx,
    double ry,
    double dx,
    double dy, {
    bool clockwise = true,
  }) =>
      _path.relativeArcToPoint(
        Offset(dx, dy),
        radius: Radius.elliptical(rx, ry),
        clockwise: clockwise,
      );

  @override
  void close() => _path.close();
}

/// Builds a smooth-cornered [Path] filling [rect]. Public for custom
/// clippers/painters; most code uses [LisseBorder].
Path lissePath(Rect rect, LisseCorners corners) {
  final Path path = Path();
  buildLissePath(
      _UiPathSink(path, rect.left, rect.top), rect.width, rect.height, corners);
  return path;
}

LisseCorners _deflate(LisseCorners c, double inset) {
  LisseCorner d(LisseCorner k) {
    final double r = k.radius - inset;
    return k.copyWith(radius: r < 0 ? 0 : r);
  }

  return LisseCorners(
    topLeft: d(c.topLeft),
    topRight: d(c.topRight),
    bottomRight: d(c.bottomRight),
    bottomLeft: d(c.bottomLeft),
  );
}

LisseCorners _scale(LisseCorners c, double t) {
  LisseCorner s(LisseCorner k) => k.copyWith(radius: k.radius * t);
  return LisseCorners(
    topLeft: s(c.topLeft),
    topRight: s(c.topRight),
    bottomRight: s(c.bottomRight),
    bottomLeft: s(c.bottomLeft),
  );
}

/// An [OutlinedBorder] whose outline is a Lisse smooth-cornered rectangle.
///
/// Hand it to any shape-taking Flutter API and clipping, the [side] border,
/// and `ShapeDecoration` shadows all trace the squircle:
///
/// ```dart
/// Container(
///   decoration: ShapeDecoration(
///     shape: LisseBorder(corners: LisseCorners.all(radius: 24)),
///     color: Colors.white,
///     shadows: const [BoxShadow(blurRadius: 24, color: Colors.black26)],
///   ),
/// )
/// ```
class LisseBorder extends OutlinedBorder {
  const LisseBorder({
    required this.corners,
    super.side = BorderSide.none,
  });

  /// Uniform-radius convenience.
  LisseBorder.all({
    required double radius,
    LisseCurve curve = LisseCurve.squircle,
    double smoothing = 0.6,
    super.side = BorderSide.none,
  }) : corners = LisseCorners.all(
          radius: radius,
          curve: curve,
          smoothing: smoothing,
        );

  final LisseCorners corners;

  @override
  EdgeInsetsGeometry get dimensions => EdgeInsets.all(side.strokeInset);

  @override
  ShapeBorder scale(double t) =>
      LisseBorder(corners: _scale(corners, t), side: side.scale(t));

  @override
  Path getOuterPath(Rect rect, {TextDirection? textDirection}) =>
      lissePath(rect, corners);

  @override
  Path getInnerPath(Rect rect, {TextDirection? textDirection}) {
    final double inset = side.strokeInset;
    if (inset <= 0) return lissePath(rect, corners);
    return lissePath(rect.deflate(inset), _deflate(corners, inset));
  }

  @override
  void paint(Canvas canvas, Rect rect, {TextDirection? textDirection}) {
    if (side.style == BorderStyle.none || side.width == 0) return;
    // Centre the stroke on the line implied by strokeAlign.
    final double inset = side.strokeInset - side.width / 2;
    final Rect lineRect = rect.deflate(inset);
    final Path path = lissePath(lineRect, _deflate(corners, inset));
    canvas.drawPath(path, side.toPaint());
  }

  @override
  LisseBorder copyWith({BorderSide? side, LisseCorners? corners}) =>
      LisseBorder(
        corners: corners ?? this.corners,
        side: side ?? this.side,
      );

  @override
  ShapeBorder? lerpFrom(ShapeBorder? a, double t) {
    if (a is LisseBorder) {
      return LisseBorder(
        corners: LisseCorners.lerp(a.corners, corners, t),
        side: BorderSide.lerp(a.side, side, t),
      );
    }
    return super.lerpFrom(a, t);
  }

  @override
  ShapeBorder? lerpTo(ShapeBorder? b, double t) {
    if (b is LisseBorder) {
      return LisseBorder(
        corners: LisseCorners.lerp(corners, b.corners, t),
        side: BorderSide.lerp(side, b.side, t),
      );
    }
    return super.lerpTo(b, t);
  }

  @override
  bool operator ==(Object other) =>
      other is LisseBorder && other.side == side && other.corners == corners;

  @override
  int get hashCode => Object.hash(side, corners);

  @override
  String toString() => 'LisseBorder(side: $side, corners: $corners)';
}
