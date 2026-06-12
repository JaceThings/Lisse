import '../builder.dart';
import '../orient.dart';
import '../path_sink.dart';
import 'corner_params.dart';

/// Figma squircle — cubic shoulder + central arc + cubic shoulder. G1 with
/// the adjacent edges (curvature steps at the cubic↔arc seams). The four
/// per-orient drawers reproduce what Lisse has shipped since 0.1.0.
CornerOutput buildSquircle(CurveBuilderInput input) {
  final CornerPathParams params = getPathParamsForCorner(
    cornerRadius: input.cornerRadius,
    cornerSmoothing: input.smoothing,
    preserveSmoothing: input.preserveSmoothing,
    roundingAndSmoothingBudget: input.roundingAndSmoothingBudget,
  );
  if (params.cornerRadius <= 0) return emptyCornerOutput;

  return CornerOutput(params.p, (sink, orient) {
    switch (orient) {
      case Orient.tr:
        _drawTopRight(sink, params);
        break;
      case Orient.br:
        _drawBottomRight(sink, params);
        break;
      case Orient.bl:
        _drawBottomLeft(sink, params);
        break;
      case Orient.tl:
        _drawTopLeft(sink, params);
        break;
    }
  });
}

void _drawTopRight(PathSink s, CornerPathParams p) {
  final double a = p.a, b = p.b, c = p.c, d = p.d;
  final double r = p.cornerRadius, arc = p.arcSectionLength;
  s.relativeCubicTo(a, 0, a + b, 0, a + b + c, d);
  s.relativeArcTo(r, r, arc, arc);
  s.relativeCubicTo(d, c, d, b + c, d, a + b + c);
}

void _drawBottomRight(PathSink s, CornerPathParams p) {
  final double a = p.a, b = p.b, c = p.c, d = p.d;
  final double r = p.cornerRadius, arc = p.arcSectionLength;
  s.relativeCubicTo(0, a, 0, a + b, -d, a + b + c);
  s.relativeArcTo(r, r, -arc, arc);
  s.relativeCubicTo(-c, d, -(b + c), d, -(a + b + c), d);
}

void _drawBottomLeft(PathSink s, CornerPathParams p) {
  final double a = p.a, b = p.b, c = p.c, d = p.d;
  final double r = p.cornerRadius, arc = p.arcSectionLength;
  s.relativeCubicTo(-a, 0, -(a + b), 0, -(a + b + c), -d);
  s.relativeArcTo(r, r, -arc, -arc);
  s.relativeCubicTo(-d, -c, -d, -(b + c), -d, -(a + b + c));
}

void _drawTopLeft(PathSink s, CornerPathParams p) {
  final double a = p.a, b = p.b, c = p.c, d = p.d;
  final double r = p.cornerRadius, arc = p.arcSectionLength;
  s.relativeCubicTo(0, -a, 0, -(a + b), d, -(a + b + c));
  s.relativeArcTo(r, r, arc, -arc);
  s.relativeCubicTo(c, -d, b + c, -d, a + b + c, -d);
}
