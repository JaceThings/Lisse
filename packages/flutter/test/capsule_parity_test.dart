import 'dart:convert';
import 'dart:io';
import 'dart:math' as math;
import 'dart:ui';

import 'package:flutter_test/flutter_test.dart';
import 'package:lisse/lisse.dart';

/// Capsule/blend parity: the ported Dart geometry must trace the same outline
/// @lisse/core emits. Fixtures in `test/fixtures/capsule_parity.json` hold
/// ~200 evenly-spaced points sampled off the core d-string; each must lie
/// within [_tol] of the Dart outline (measured point-to-segment, so the check
/// is the true geometric deviation, not a sampling artefact).
const double _tol = 0.05;

/// Dense polyline of every contour of [path].
List<Offset> _polyline(Path path, {double stepPx = 0.2}) {
  final List<Offset> out = <Offset>[];
  for (final PathMetric metric in path.computeMetrics()) {
    final double len = metric.length;
    if (len <= 0) continue;
    final int n = math.max(1, (len / stepPx).ceil());
    for (int i = 0; i <= n; i++) {
      final Tangent? t = metric.getTangentForOffset(math.min(len, i * stepPx));
      if (t != null) out.add(t.position);
    }
  }
  return out;
}

/// Distance from [p] to segment [a]→[b].
double _distPointSeg(Offset p, Offset a, Offset b) {
  final double vx = b.dx - a.dx, vy = b.dy - a.dy;
  final double vv = vx * vx + vy * vy;
  double t = vv == 0 ? 0 : ((p.dx - a.dx) * vx + (p.dy - a.dy) * vy) / vv;
  if (t < 0) {
    t = 0;
  } else if (t > 1) {
    t = 1;
  }
  final double dx = p.dx - (a.dx + t * vx), dy = p.dy - (a.dy + t * vy);
  return math.sqrt(dx * dx + dy * dy);
}

/// Nearest distance from [p] to the [poly]line.
double _distToPolyline(Offset p, List<Offset> poly) {
  double best = double.infinity;
  for (int i = 0; i + 1 < poly.length; i++) {
    final double d = _distPointSeg(p, poly[i], poly[i + 1]);
    if (d < best) best = d;
    if (best < 1e-4) break;
  }
  return best;
}

LisseCorner _corner(Map<String, dynamic> j) => LisseCorner(
  radius: (j['radius'] as num).toDouble(),
  smoothing: (j['smoothing'] as num).toDouble(),
);

void main() {
  final List<dynamic> fixtures =
      jsonDecode(File('test/fixtures/capsule_parity.json').readAsStringSync())
          as List<dynamic>;

  double globalMax = 0;
  String globalWorst = '';

  for (final dynamic raw in fixtures) {
    final Map<String, dynamic> f = raw as Map<String, dynamic>;
    final String name = f['name'] as String;
    final double w = (f['w'] as num).toDouble();
    final double h = (f['h'] as num).toDouble();
    final Map<String, dynamic> co = f['corners'] as Map<String, dynamic>;

    test('parity $name (${w}x$h)', () {
      final Path path = lissePath(
        Rect.fromLTWH(0, 0, w, h),
        LisseCorners(
          topLeft: _corner(co['tl'] as Map<String, dynamic>),
          topRight: _corner(co['tr'] as Map<String, dynamic>),
          bottomRight: _corner(co['br'] as Map<String, dynamic>),
          bottomLeft: _corner(co['bl'] as Map<String, dynamic>),
        ),
      );
      final List<Offset> poly = _polyline(path);
      expect(poly.length, greaterThan(50), reason: '$name: too few samples');

      double worst = 0;
      for (final dynamic pt in f['points'] as List<dynamic>) {
        final List<dynamic> xy = pt as List<dynamic>;
        final Offset p = Offset(
          (xy[0] as num).toDouble(),
          (xy[1] as num).toDouble(),
        );
        worst = math.max(worst, _distToPolyline(p, poly));
      }
      if (worst > globalMax) {
        globalMax = worst;
        globalWorst = name;
      }
      // Print per-case deviation so the parity margin is visible in the log.
      // ignore: avoid_print
      print('parity $name: max ${worst.toStringAsFixed(5)} px');
      expect(
        worst,
        lessThan(_tol),
        reason: '$name exceeded $_tol px (max ${worst.toStringAsFixed(5)})',
      );
    });
  }

  tearDownAll(() {
    // ignore: avoid_print
    print(
      'capsule parity worst case: $globalWorst = ${globalMax.toStringAsFixed(5)} px',
    );
  });
}
