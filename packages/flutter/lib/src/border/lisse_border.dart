import 'package:flutter/widgets.dart';

import '../geometry/lisse_corner.dart';
import '../geometry/lisse_curve.dart';
import '../ui_path.dart';

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
  const LisseBorder({required this.corners, super.side = BorderSide.none});

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
      LisseBorder(corners: corners.scale(t), side: side.scale(t));

  @override
  Path getOuterPath(Rect rect, {TextDirection? textDirection}) =>
      lissePath(rect, corners);

  @override
  Path getInnerPath(Rect rect, {TextDirection? textDirection}) {
    final double inset = side.strokeInset;
    if (inset <= 0) return lissePath(rect, corners);
    return insetLissePath(rect, corners, inset);
  }

  @override
  void paint(Canvas canvas, Rect rect, {TextDirection? textDirection}) {
    if (side.style == BorderStyle.none || side.width == 0) return;
    // Centre the stroke on the line implied by strokeAlign.
    final double inset = side.strokeInset - side.width / 2;
    final Path path = insetLissePath(rect, corners, inset);
    canvas.drawPath(path, side.toPaint());
  }

  @override
  LisseBorder copyWith({BorderSide? side, LisseCorners? corners}) =>
      LisseBorder(corners: corners ?? this.corners, side: side ?? this.side);

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
