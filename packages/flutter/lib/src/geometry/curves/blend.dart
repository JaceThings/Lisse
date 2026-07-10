import 'dart:math' as math;

import '../path_sink.dart';
import 'corner_params.dart';

/// The blend regime: a uniform squircle resized into the band where its short
/// side sits strictly between 2R and 2(1+s)R. The classic squircle clamps
/// smoothing symmetrically here (a visible pop while resizing toward a
/// capsule); instead each corner gets per-edge smoothing
///
///     s_edge = clamp(min(s, room_edge/R − 1), 0, s)
///
/// so the roomy long edges keep full smoothing while the constrained short
/// edges give theirs up, and the outline moves ~1 px per 1 px of resize all the
/// way to the capsule limit. Both ends of the band are exact: both edges roomy
/// → the Figma squircle, one edge fully consumed → the Sketch capsule law.

double _toRadians(double degrees) => degrees * math.pi / 180;

class _Shoulder {
  final double a;
  final double b;
  final double p;

  /// sin/cos of the shoulder→arc tangent angle `45°·s_edge`, computed once.
  final double sin;
  final double cos;

  const _Shoulder(this.a, this.b, this.p, this.sin, this.cos);
}

// s_edge is pre-clamped so p = (1+s_edge)R never exceeds `room`; the budget
// branches inside getPathParamsForCorner are therefore inert and the result
// matches the raw figure-11.1 cubic regardless of preserveSmoothing.
_Shoulder _shoulder(double r, double sEdge, bool preserveSmoothing, double room) {
  final CornerPathParams params = getPathParamsForCorner(
    cornerRadius: r,
    cornerSmoothing: sEdge,
    preserveSmoothing: preserveSmoothing,
    roundingAndSmoothingBudget: room,
  );
  final double beta = _toRadians(45 * sEdge);
  return _Shoulder(params.a, params.b, params.p, math.sin(beta), math.cos(beta));
}

double _clampEdge(double room, double r, double s) =>
    math.max(0, math.min(room / r - 1, s));

/// Emits a uniform-squircle rectangle in the blend band into [sink]. [r] is the
/// effective radius `min(radius, width/2, height/2)`; the caller guarantees the
/// short side lies in `(2R, 2(1+s)R)`.
void drawBlendPath(
  PathSink sink,
  double width,
  double height,
  double r,
  double smoothing,
  bool preserveSmoothing,
) {
  final _Shoulder h =
      _shoulder(r, _clampEdge(width / 2, r, smoothing), preserveSmoothing, width / 2);
  final _Shoulder v =
      _shoulder(r, _clampEdge(height / 2, r, smoothing), preserveSmoothing, height / 2);

  // One corner, oriented by unit axes: u points from the corner back along the
  // edge we arrive on, v along the edge we leave on. Horizontal edges use the
  // width shoulder H, vertical edges the height shoulder V. The arc runs
  // between the two shoulder→arc junctions j1, j2 on the corner's R-circle
  // (centre o), collapsing to nothing when the shoulders consume the full 90°.
  void seg(double cx, double cy, double ux, double uy, double vx, double vy) {
    final _Shoulder s1 = uy == 0 ? h : v;
    final _Shoulder s2 = vy == 0 ? h : v;
    final double ox = cx + (ux + vx) * r;
    final double oy = cy + (uy + vy) * r;
    final double j1x = ox - vx * r * s1.cos - ux * r * s1.sin;
    final double j1y = oy - vy * r * s1.cos - uy * r * s1.sin;
    final double j2x = ox - ux * r * s2.cos - vx * r * s2.sin;
    final double j2y = oy - uy * r * s2.cos - vy * r * s2.sin;
    final double p0x = cx + ux * s1.p;
    final double p0y = cy + uy * s1.p;
    final bool arced = math.sqrt((j2x - j1x) * (j2x - j1x) + (j2y - j1y) * (j2y - j1y)) > 1e-6;
    final double ex = arced ? j2x : j1x;
    final double ey = arced ? j2y : j1y;
    final double p3x = cx + vx * s2.p;
    final double p3y = cy + vy * s2.p;

    sink.lineTo(p0x, p0y);
    sink.relativeCubicTo(
      -ux * s1.a,
      -uy * s1.a,
      -ux * (s1.a + s1.b),
      -uy * (s1.a + s1.b),
      j1x - p0x,
      j1y - p0y,
    );
    if (arced) {
      sink.relativeArcTo(r, r, j2x - j1x, j2y - j1y);
    }
    sink.relativeCubicTo(
      p3x - vx * (s2.a + s2.b) - ex,
      p3y - vy * (s2.a + s2.b) - ey,
      p3x - vx * s2.a - ex,
      p3y - vy * s2.a - ey,
      p3x - ex,
      p3y - ey,
    );
  }

  // Corners clockwise from top-left; the path opens on the top edge.
  sink.moveTo(h.p, 0);
  seg(width, 0, -1, 0, 0, 1); // tr
  seg(width, height, 0, -1, -1, 0); // br
  seg(0, height, 1, 0, 0, -1); // bl
  seg(0, 0, 0, 1, 1, 0); // tl
  sink.close();
}
