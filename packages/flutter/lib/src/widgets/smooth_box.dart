import 'package:flutter/foundation.dart' show listEquals;
import 'package:flutter/widgets.dart';

import '../border/lisse_border.dart';
import '../effects/lisse_effects.dart';
import '../geometry/lisse_corner.dart';

/// A smooth-cornered container with the full effect set.
///
/// Layers, back to front: outer [shadows] → [color]/[gradient] fill →
/// [side] border → [innerShadows] → clipped [child] → rich [borders]. The
/// cheap layers (fill, outer shadow, single [side]) ride on a native
/// [ShapeDecoration]; inner shadows and concentric/styled/gradient [borders]
/// are custom-painted because Flutter has no native equivalent.
class SmoothBox extends StatelessWidget {
  const SmoothBox({
    super.key,
    required this.corners,
    this.color,
    this.gradient,
    this.shadows = const <BoxShadow>[],
    this.innerShadows = const <LisseInnerShadow>[],
    this.side = BorderSide.none,
    this.borders = const <LisseBorderLayer>[],
    this.padding,
    this.width,
    this.height,
    this.clipBehavior = Clip.antiAlias,
    this.child,
  }) : assert(
         color == null || gradient == null,
         'provide either color or gradient, not both',
       );

  final LisseCorners corners;

  /// Solid fill. Ignored when [gradient] is set.
  final Color? color;
  final Gradient? gradient;

  /// Outer shadows; each traces the squircle silhouette.
  final List<BoxShadow> shadows;
  final List<LisseInnerShadow> innerShadows;

  /// A single solid border drawn natively from the shape's [side].
  final BorderSide side;

  /// Rich concentric borders (styled / gradient / multi-layer).
  final List<LisseBorderLayer> borders;

  final EdgeInsetsGeometry? padding;
  final double? width;
  final double? height;
  final Clip clipBehavior;
  final Widget? child;

  @override
  Widget build(BuildContext context) {
    final LisseBorder border = LisseBorder(corners: corners, side: side);

    Widget content = child ?? const SizedBox.shrink();
    if (padding != null) {
      content = Padding(padding: padding!, child: content);
    }

    Widget result = clipBehavior == Clip.none
        ? content
        : ClipPath(
            clipper: ShapeBorderClipper(shape: border),
            clipBehavior: clipBehavior,
            child: content,
          );

    if (borders.isNotEmpty) {
      result = CustomPaint(
        foregroundPainter: _BorderPainter(corners, borders),
        child: result,
      );
    }

    if (innerShadows.isNotEmpty) {
      result = CustomPaint(
        painter: _InnerShadowPainter(corners, innerShadows),
        child: result,
      );
    }

    result = DecoratedBox(
      decoration: ShapeDecoration(
        shape: border,
        color: gradient == null ? color : null,
        gradient: gradient,
        shadows: shadows.isEmpty ? null : shadows,
      ),
      child: result,
    );

    if (width != null || height != null) {
      result = SizedBox(width: width, height: height, child: result);
    }
    return result;
  }
}

class _InnerShadowPainter extends CustomPainter {
  _InnerShadowPainter(this.corners, this.shadows);

  final LisseCorners corners;
  final List<LisseInnerShadow> shadows;

  @override
  void paint(Canvas canvas, Size size) =>
      paintInnerShadows(canvas, Offset.zero & size, corners, shadows);

  @override
  bool shouldRepaint(_InnerShadowPainter old) =>
      old.corners != corners || !listEquals(old.shadows, shadows);
}

class _BorderPainter extends CustomPainter {
  _BorderPainter(this.corners, this.borders);

  final LisseCorners corners;
  final List<LisseBorderLayer> borders;

  @override
  void paint(Canvas canvas, Size size) =>
      paintBorderLayers(canvas, Offset.zero & size, corners, borders);

  @override
  bool shouldRepaint(_BorderPainter old) =>
      old.corners != corners || !listEquals(old.borders, borders);
}
