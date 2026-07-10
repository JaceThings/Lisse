import 'dart:math' as math;
import 'dart:ui' show PathOperation, BlurStyle, MaskFilter, PathMetric;

import 'package:flutter/widgets.dart';

import '../geometry/lisse_corner.dart';
import '../ui_path.dart';

/// Visual style of a [LisseBorderLayer] stroke.
enum LisseBorderStyle { solid, dashed, dotted, doubleLine, groove, ridge }

/// An inner shadow cast inside the silhouette. Flutter has no native inner
/// shadow; [SmoothBox] paints this above the fill and below the content.
@immutable
class LisseInnerShadow {
  const LisseInnerShadow({
    this.color = const Color(0x66000000),
    this.offset = Offset.zero,
    this.blur = 8,
    this.spread = 0,
  }) : assert(blur >= 0, 'blur must be >= 0');

  final Color color;
  final Offset offset;
  final double blur;
  final double spread;

  @override
  bool operator ==(Object other) =>
      other is LisseInnerShadow &&
      other.color == color &&
      other.offset == offset &&
      other.blur == blur &&
      other.spread == spread;

  @override
  int get hashCode => Object.hash(color, offset, blur, spread);
}

/// One concentric border stroke. Layers are painted from the outer edge
/// inward in the order given, each consuming its own [width].
@immutable
class LisseBorderLayer {
  const LisseBorderLayer({
    required this.width,
    this.color,
    this.gradient,
    this.opacity = 1,
    this.style = LisseBorderStyle.solid,
    this.dash,
    this.gap,
    this.cap = StrokeCap.butt,
  })  : assert(width >= 0, 'width must be >= 0'),
        assert(opacity >= 0 && opacity <= 1, 'opacity must be 0..1'),
        assert(
          color != null || gradient != null,
          'a border layer needs a color or a gradient',
        );

  final double width;
  final Color? color;

  /// Stroke shader. Ignored by [LisseBorderStyle.groove] and
  /// [LisseBorderStyle.ridge], which derive light/dark tones from [color].
  final Gradient? gradient;
  final double opacity;
  final LisseBorderStyle style;

  /// Dash length for dashed/dotted styles. Sensible defaults derive from
  /// [width] when null.
  final double? dash;

  /// Gap length for dashed/dotted styles.
  final double? gap;
  final StrokeCap cap;

  @override
  bool operator ==(Object other) =>
      other is LisseBorderLayer &&
      other.width == width &&
      other.color == color &&
      other.gradient == gradient &&
      other.opacity == opacity &&
      other.style == style &&
      other.dash == dash &&
      other.gap == gap &&
      other.cap == cap;

  @override
  int get hashCode =>
      Object.hash(width, color, gradient, opacity, style, dash, gap, cap);
}

double _sigma(double radius) => radius <= 0 ? 0 : radius * 0.57735 + 0.5;

/// Paints inner shadows clipped to the silhouette. Called above the fill,
/// below content.
void paintInnerShadows(
  Canvas canvas,
  Rect rect,
  LisseCorners corners,
  List<LisseInnerShadow> shadows,
) {
  if (shadows.isEmpty) return;
  final Path outer = lissePath(rect, corners);
  final double maxSpread = math.min(rect.width, rect.height) / 2 - 1;
  canvas.save();
  canvas.clipPath(outer);
  for (final LisseInnerShadow s in shadows) {
    // A huge cover with the (offset, spread-adjusted) silhouette punched
    // out; the blurred edge that bleeds inside the clip reads as an inner
    // shadow. Clamp spread so the punch-out never collapses the whole box.
    final double spread = s.spread > maxSpread ? maxSpread : s.spread;
    final Path hole = insetLissePath(rect, corners, spread).shift(s.offset);
    final Path cover = Path()
      ..addRect(rect.inflate(rect.longestSide + s.blur + spread.abs()));
    final Path ring = Path.combine(PathOperation.difference, cover, hole);
    final Paint paint = Paint()
      ..color = s.color
      ..maskFilter =
          s.blur > 0 ? MaskFilter.blur(BlurStyle.normal, _sigma(s.blur)) : null;
    canvas.drawPath(ring, paint);
  }
  canvas.restore();
}

Path _dashed(Path source, double dashLen, double gapLen) {
  // Guard against non-positive dash (would not advance) / negative gap.
  final double dash = dashLen.isFinite && dashLen > 0 ? dashLen : 1;
  final double gap = gapLen.isFinite && gapLen >= 0 ? gapLen : 0;
  final Path dest = Path();
  for (final PathMetric metric in source.computeMetrics()) {
    double distance = 0;
    while (distance < metric.length) {
      final double end = math.min(distance + dash, metric.length);
      dest.addPath(metric.extractPath(distance, end), Offset.zero);
      distance = end + gap;
    }
  }
  return dest;
}

void _stroke(
  Canvas canvas,
  Path path,
  LisseBorderLayer layer,
  double strokeWidth,
  Rect rect, {
  Color? colorOverride,
  StrokeCap? capOverride,
}) {
  final Paint paint = Paint()
    ..style = PaintingStyle.stroke
    ..strokeWidth = strokeWidth
    ..strokeCap = capOverride ?? layer.cap;
  if (layer.gradient != null) {
    paint.shader = layer.gradient!.createShader(rect);
    if (layer.opacity < 1) {
      paint.color = const Color(0xFFFFFFFF).withValues(alpha: layer.opacity);
    }
  } else {
    final Color base = colorOverride ?? layer.color!;
    paint.color = base.withValues(alpha: base.a * layer.opacity);
  }
  canvas.drawPath(path, paint);
}

/// Paints concentric border layers from the outer edge inward.
void paintBorderLayers(
  Canvas canvas,
  Rect rect,
  LisseCorners corners,
  List<LisseBorderLayer> layers,
) {
  final double limit = math.min(rect.width, rect.height) / 2;
  double offset = 0;
  for (final LisseBorderLayer layer in layers) {
    if (layer.width <= 0) continue;
    final double w = layer.width;
    final double center = offset + w / 2;
    // Deeper layers would invert the inset rect — stop once we run out of room.
    if (center >= limit) break;
    final Path centerPath = insetLissePath(rect, corners, center);

    switch (layer.style) {
      case LisseBorderStyle.solid:
        _stroke(canvas, centerPath, layer, w, rect);
        break;
      case LisseBorderStyle.dashed:
        _stroke(
          canvas,
          _dashed(centerPath, layer.dash ?? w * 3, layer.gap ?? w * 2),
          layer,
          w,
          rect,
        );
        break;
      case LisseBorderStyle.dotted:
        // Near-zero dash: the round cap renders each as a circle of diameter w.
        _stroke(
          canvas,
          _dashed(centerPath, layer.dash ?? 0.01, layer.gap ?? w * 1.6),
          layer,
          w,
          rect,
          capOverride: StrokeCap.round,
        );
        break;
      case LisseBorderStyle.doubleLine:
        final double sub = w / 3;
        _stroke(
          canvas,
          insetLissePath(rect, corners, offset + sub / 2),
          layer,
          sub,
          rect,
        );
        _stroke(
          canvas,
          insetLissePath(rect, corners, offset + w - sub / 2),
          layer,
          sub,
          rect,
        );
        break;
      case LisseBorderStyle.groove:
      case LisseBorderStyle.ridge:
        final Color base = layer.color ?? const Color(0xFF808080);
        // Shift tone but keep the base alpha (lerping to opaque would
        // otherwise make translucent borders solid).
        final Color dark = Color.lerp(
          base,
          const Color(0xFF000000),
          0.35,
        )!
            .withValues(alpha: base.a);
        final Color light = Color.lerp(
          base,
          const Color(0xFFFFFFFF),
          0.45,
        )!
            .withValues(alpha: base.a);
        final bool groove = layer.style == LisseBorderStyle.groove;
        final double half = w / 2;
        _stroke(
          canvas,
          insetLissePath(rect, corners, offset + half / 2),
          layer,
          half,
          rect,
          colorOverride: groove ? dark : light,
        );
        _stroke(
          canvas,
          insetLissePath(rect, corners, offset + w - half / 2),
          layer,
          half,
          rect,
          colorOverride: groove ? light : dark,
        );
        break;
    }
    offset += w;
  }
}
