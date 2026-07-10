import 'dart:math' as math;
import 'dart:ui';

import 'package:flutter_test/flutter_test.dart';
import 'package:lisse/lisse.dart';

/// Deterministic seed — every run samples the same cases.
const int _seed = 0x1155E;

/// Random cases per property sweep.
const int _cases = 300;

/// Tolerated bulge past the rect edge (px). The builders clamp tangency to the
/// rect, so any excess is float noise from path sampling — observed ~3e-5.
const double _epsilon = 0.5;

bool _finite(double v) => v.isFinite;

bool _rectFinite(Rect r) =>
    _finite(r.left) && _finite(r.top) && _finite(r.right) && _finite(r.bottom);

/// How far [p] sits outside [rect] on either axis (0 when inside).
double _outside(Offset p, Rect rect) {
  final double ox = math.max(
    0.0,
    math.max(rect.left - p.dx, p.dx - rect.right),
  );
  final double oy = math.max(
    0.0,
    math.max(rect.top - p.dy, p.dy - rect.bottom),
  );
  return math.max(ox, oy);
}

/// Evenly samples positions along every metric of [path].
List<Offset> _sample(Path path, {int steps = 64}) {
  final List<Offset> pts = <Offset>[];
  for (final PathMetric m in path.computeMetrics()) {
    final double len = m.length;
    if (len == 0) continue;
    for (int s = 0; s <= steps; s++) {
      final Tangent? t = m.getTangentForOffset(len * s / steps);
      if (t != null) pts.add(t.position);
    }
  }
  return pts;
}

void main() {
  group('property sweep (300 random cases)', () {
    test('outer path is closed for non-degenerate input', () {
      final math.Random rng = math.Random(_seed);
      for (int i = 0; i < _cases; i++) {
        final double w = 20.0 + rng.nextDouble() * 500; // 20..520
        final double h = 20.0 + rng.nextDouble() * 360; // 20..380
        final double r = rng.nextDouble() * (math.min(w, h) / 2);
        final LisseCorners corners = LisseCorners.all(
          radius: r,
          curve: LisseCurve.values[rng.nextInt(LisseCurve.values.length)],
          smoothing: rng.nextDouble(),
          exponent: 2.0 + rng.nextDouble() * 6, // 2..8
        );
        final Path path = lissePath(Rect.fromLTWH(0, 0, w, h), corners);
        final List<PathMetric> metrics = path.computeMetrics().toList();
        expect(metrics, isNotEmpty);
        for (final PathMetric m in metrics) {
          expect(
            m.isClosed,
            isTrue,
            reason: 'case $i w=$w h=$h r=$r curve=${corners.topLeft.curve}',
          );
        }
      }
    });

    test('silhouette never bulges outside its box, all samples finite', () {
      final math.Random rng = math.Random(_seed);
      for (int i = 0; i < _cases; i++) {
        final double w = 20.0 + rng.nextDouble() * 500;
        final double h = 20.0 + rng.nextDouble() * 360;
        final double r = rng.nextDouble() * (math.min(w, h) / 2);
        // Random origin too — containment must hold for any rect, not just at 0.
        final Rect rect = Rect.fromLTWH(
          rng.nextDouble() * 40,
          rng.nextDouble() * 40,
          w,
          h,
        );
        final LisseCorners corners = LisseCorners.all(
          radius: r,
          curve: LisseCurve.values[rng.nextInt(LisseCurve.values.length)],
          smoothing: rng.nextDouble(),
          exponent: 2.0 + rng.nextDouble() * 6,
        );
        final Path path = lissePath(rect, corners);
        for (final Offset p in _sample(path)) {
          expect(
            _finite(p.dx) && _finite(p.dy),
            isTrue,
            reason: 'NaN/Inf sample in case $i at $p',
          );
          expect(
            _outside(p, rect),
            lessThanOrEqualTo(_epsilon),
            reason:
                'case $i bulges outside $rect at $p '
                'r=$r curve=${corners.topLeft.curve}',
          );
        }
      }
    });
  });

  group('radius 0 collapses to a rectangle', () {
    for (final LisseCurve curve in LisseCurve.values) {
      test('curve=$curve', () {
        // Off-origin rect to catch any origin handling bug.
        const Rect rect = Rect.fromLTWH(5, 7, 200, 150);
        final Path path = lissePath(
          rect,
          LisseCorners.all(radius: 0, curve: curve),
        );
        final Rect b = path.getBounds();
        expect(b.left, closeTo(rect.left, 1e-6));
        expect(b.top, closeTo(rect.top, 1e-6));
        expect(b.right, closeTo(rect.right, 1e-6));
        expect(b.bottom, closeTo(rect.bottom, 1e-6));

        // A true rectangle: every sample sits on the perimeter (some edge),
        // never interior to it.
        for (final Offset p in _sample(path)) {
          final bool onEdge =
              (p.dx - rect.left).abs() < 1e-3 ||
              (rect.right - p.dx).abs() < 1e-3 ||
              (p.dy - rect.top).abs() < 1e-3 ||
              (rect.bottom - p.dy).abs() < 1e-3;
          expect(onEdge, isTrue, reason: 'curve=$curve off-edge sample $p');
        }
      });
    }
  });

  test('oversized radius clamps within the rect', () {
    const Rect rect = Rect.fromLTWH(10, 20, 200, 150);
    for (final LisseCurve curve in LisseCurve.values) {
      final Path path = lissePath(
        rect,
        LisseCorners.all(radius: 9999, curve: curve),
      );
      final Rect b = path.getBounds();
      // Bounds must not escape the rect (allow epsilon for float noise).
      expect(b.left, greaterThanOrEqualTo(rect.left - _epsilon));
      expect(b.top, greaterThanOrEqualTo(rect.top - _epsilon));
      expect(b.right, lessThanOrEqualTo(rect.right + _epsilon));
      expect(b.bottom, lessThanOrEqualTo(rect.bottom + _epsilon));
      for (final Offset p in _sample(path)) {
        expect(
          _outside(p, rect),
          lessThanOrEqualTo(_epsilon),
          reason: 'oversized curve=$curve sample $p outside $rect',
        );
      }
    }
  });

  test('uniform square is 4-fold symmetric under 90 rotation', () {
    const double n = 200;
    const Rect rect = Rect.fromLTWH(0, 0, n, n);
    final Path path = lissePath(rect, LisseCorners.all(radius: 60));

    // Bounds fill the square and are centred.
    final Rect b = path.getBounds();
    expect(b.left, closeTo(0, 0.5));
    expect(b.top, closeTo(0, 0.5));
    expect(b.right, closeTo(n, 0.5));
    expect(b.bottom, closeTo(n, 0.5));
    expect(b.center.dx, closeTo(n / 2, 0.5));
    expect(b.center.dy, closeTo(n / 2, 0.5));

    // Dense sample; rotate each point 90 clockwise about the centre and assert
    // it still lands on the silhouette (nearest sampled point within 0.5px).
    final List<Offset> pts = _sample(path, steps: 720);
    expect(pts.length, greaterThan(100));
    const Offset c = Offset(n / 2, n / 2);
    double worst = 0;
    for (final Offset p in pts) {
      final Offset rotated = Offset(c.dx - (p.dy - c.dy), c.dy + (p.dx - c.dx));
      double best = double.infinity;
      for (final Offset q in pts) {
        final double d = (q - rotated).distance;
        if (d < best) best = d;
      }
      if (best > worst) worst = best;
    }
    expect(worst, lessThanOrEqualTo(0.5), reason: 'rotation mismatch $worst');
  });

  group('degenerate dimensions do not throw', () {
    test('width <= 0', () {
      expect(
        () => lissePath(
          const Rect.fromLTWH(0, 0, 0, 100),
          LisseCorners.all(radius: 10),
        ),
        returnsNormally,
      );
      expect(
        () => lissePath(
          const Rect.fromLTWH(0, 0, -50, 100),
          LisseCorners.all(radius: 10),
        ),
        returnsNormally,
      );
    });

    test('height <= 0', () {
      expect(
        () => lissePath(
          const Rect.fromLTWH(0, 0, 100, 0),
          LisseCorners.all(radius: 10),
        ),
        returnsNormally,
      );
      expect(
        () => lissePath(
          const Rect.fromLTWH(0, 0, 100, -50),
          LisseCorners.all(radius: 10),
        ),
        returnsNormally,
      );
    });
  });

  group('non-finite input is guarded into a finite, drawable path', () {
    // buildLissePath sanitises non-finite radius/smoothing/exponent before
    // they reach the dart:ui Path (which asserts on NaN/Inf), so lissePath is
    // total and always drawable — across every curve family.
    const Rect rect = Rect.fromLTWH(0, 0, 200, 150);

    test('debugPathData never throws on garbage input', () {
      for (final LisseCurve curve in LisseCurve.values) {
        expect(
          () => debugPathData(
            200,
            150,
            LisseCorners.all(radius: double.nan, curve: curve),
          ),
          returnsNormally,
          reason: 'curve=$curve',
        );
      }
    });

    test('lissePath yields a finite path for non-finite radius', () {
      for (final LisseCurve curve in LisseCurve.values) {
        late Path path;
        expect(
          () => path = lissePath(
            rect,
            LisseCorners.all(radius: double.nan, curve: curve),
          ),
          returnsNormally,
          reason: 'curve=$curve',
        );
        expect(_rectFinite(path.getBounds()), isTrue, reason: 'curve=$curve');
        for (final Offset p in _sample(path)) {
          expect(
            _finite(p.dx) && _finite(p.dy),
            isTrue,
            reason: 'curve=$curve',
          );
        }
      }
    });

    test(
      'lissePath yields a finite in-bounds path for non-finite smoothing',
      () {
        for (final double sm in <double>[double.infinity, double.nan]) {
          for (final LisseCurve curve in LisseCurve.values) {
            late Path path;
            expect(
              () => path = lissePath(
                rect,
                LisseCorners.all(radius: 30, curve: curve, smoothing: sm),
              ),
              returnsNormally,
              reason: 'curve=$curve smoothing=$sm',
            );
            expect(_rectFinite(path.getBounds()), isTrue);
            for (final Offset p in _sample(path)) {
              expect(_finite(p.dx) && _finite(p.dy), isTrue);
              expect(_outside(p, rect), lessThanOrEqualTo(_epsilon));
            }
          }
        }
      },
    );

    test('non-finite exponent yields a finite superellipse path', () {
      for (final double ex in <double>[double.nan, double.infinity]) {
        final Path path = lissePath(
          rect,
          LisseCorners.all(
            radius: 30,
            curve: LisseCurve.superellipse,
            exponent: ex,
          ),
        );
        expect(_rectFinite(path.getBounds()), isTrue, reason: 'exponent=$ex');
        for (final Offset p in _sample(path)) {
          expect(_finite(p.dx) && _finite(p.dy), isTrue);
        }
      }
    });
  });

  group('LisseCorners value-type transforms', () {
    test('copyWith replaces only the named corners', () {
      final LisseCorners base = LisseCorners.all(radius: 10);
      final LisseCorners updated = base.copyWith(
        topLeft: const LisseCorner(radius: 30),
      );
      expect(updated.topLeft.radius, 30);
      expect(updated.topRight, base.topRight);
      expect(updated.bottomLeft, base.bottomLeft);
      expect(updated.bottomRight, base.bottomRight);
    });

    test('deflate reduces and clamps; negative grows; scale multiplies', () {
      final LisseCorners c = LisseCorners.all(radius: 20);
      expect(c.deflate(5).topLeft.radius, 15);
      expect(c.deflate(50).topLeft.radius, 0); // clamped at 0
      expect(c.deflate(-5).topLeft.radius, 25); // negative inset grows
      expect(c.scale(2).topLeft.radius, 40);
      // Other fields are preserved.
      final LisseCorner d = LisseCorners.all(
        radius: 20,
        curve: LisseCurve.clothoid,
        smoothing: 0.3,
      ).deflate(5).topLeft;
      expect(d.curve, LisseCurve.clothoid);
      expect(d.smoothing, 0.3);
    });
  });
}
