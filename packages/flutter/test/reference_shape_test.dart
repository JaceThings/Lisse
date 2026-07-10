import 'dart:math' as math;
import 'dart:ui';

import 'package:flutter_test/flutter_test.dart';
import 'package:lisse/lisse.dart';
import 'package:lisse/src/geometry/curves/integrate.dart';

/// Reference-shape parity: the Bézier approximations the builders emit must
/// trace the analytic curves they claim to. We sample the real `lissePath`
/// via [PathMetric] (the same geometry dart:ui renders) and check it against
/// the closed-form definition of each curve family.

/// Dense sample of every point along [path]'s contours.
List<Offset> samplePath(Path path, {double stepPx = 0.5}) {
  final List<Offset> out = <Offset>[];
  for (final PathMetric metric in path.computeMetrics()) {
    final double len = metric.length;
    if (len <= 0) continue;
    // +1 so the contour end is included.
    final int n = math.max(1, (len / stepPx).ceil());
    for (int i = 0; i <= n; i++) {
      final double d = math.min(len, i * stepPx);
      final Tangent? t = metric.getTangentForOffset(d);
      if (t != null) out.add(t.position);
    }
  }
  return out;
}

void main() {
  group('superellipse Lamé parity (top-right corner)', () {
    const double s = 240; // square side
    const double r = 72; // radius; budget per corner is 120, so p == r

    // Per the source, the cubic fit is sub-pixel for n in [2, 4] and degrades
    // for higher n; tolerances scale accordingly.
    double tolFor(double n) => n <= 4 ? 0.03 : 0.15;

    for (final double n in <double>[2, 3, 4, 6, 8]) {
      test('n=$n implicit value stays ~1 across the corner', () {
        final Path path = lissePath(
          const Rect.fromLTWH(0, 0, s, s),
          LisseCorners.all(
            radius: r,
            curve: LisseCurve.superellipse,
            exponent: n,
          ),
        );

        final List<Offset> pts = samplePath(path);

        // TR corner box (GEOMETRY NOTES): tangency at (S-R, 0) and (S, R),
        // sharp vertex at (S, 0). Open intervals drop the straight-edge runs
        // and the exact tangency endpoints, keeping interior corner samples.
        final List<Offset> corner = pts
            .where(
              (Offset p) => p.dx > s - r && p.dx < s && p.dy > 0 && p.dy < r,
            )
            .toList();

        // Guard: the filter must actually capture the corner before asserting.
        expect(
          corner.length,
          greaterThan(20),
          reason: 'TR corner region produced too few samples',
        );

        // Standard Lamé form for this corner. Inward depth from the right
        // edge is (S - x); from the top edge it is y. With the sharp vertex
        // at (S, 0) the implicit value is
        //   u = (R - (S - x)) / R,  v = (R - y) / R,  f = u^n + v^n ≈ 1.
        double maxErr = 0;
        for (final Offset p in corner) {
          final double u = (r - (s - p.dx)) / r;
          final double v = (r - p.dy) / r;
          final double f =
              math.pow(u, n).toDouble() + math.pow(v, n).toDouble();
          maxErr = math.max(maxErr, (f - 1).abs());
        }

        expect(
          maxErr,
          lessThan(tolFor(n)),
          reason: 'n=$n max|f-1|=$maxErr exceeded tolerance ${tolFor(n)}',
        );
      });
    }
  });

  group('clothoid', () {
    /// Parse the SVG `d` strings emitted by [debugPathData] into coordinate
    /// lists. Relative cubics/arcs are folded into absolute pen positions so
    /// two paths can be compared point-for-point.
    List<double> coords(String d) {
      final List<double> nums = <double>[];
      double px = 0, py = 0; // pen
      final List<String> tokens = d.split(' ');
      int i = 0;

      double next() => double.parse(tokens[i++]);

      while (i < tokens.length) {
        final String cmd = tokens[i++];
        switch (cmd) {
          case 'M':
            px = next();
            py = next();
            nums
              ..add(px)
              ..add(py);
            break;
          case 'L':
            px = next();
            py = next();
            nums
              ..add(px)
              ..add(py);
            break;
          case 'c':
            // Three relative control points; record each absolute, advance the
            // pen to the third (the endpoint).
            for (int k = 0; k < 3; k++) {
              final double cx = px + next();
              final double cy = py + next();
              nums
                ..add(cx)
                ..add(cy);
              if (k == 2) {
                px = cx;
                py = cy;
              }
            }
            break;
          case 'a':
            next(); // rx
            next(); // ry
            next(); // x-axis-rotation
            next(); // large-arc-flag
            next(); // sweep-flag
            final double dx = next();
            final double dy = next();
            px += dx;
            py += dy;
            nums
              ..add(px)
              ..add(py);
            break;
          case 'Z':
            break;
          default:
            fail('unexpected path token: $cmd');
        }
      }
      return nums;
    }

    for (final List<double> wh in <List<double>>[
      <double>[200, 200],
      <double>[320, 180],
    ]) {
      final double w = wh[0], h = wh[1];
      test('smoothing 0 equals arc at ${w}x$h', () {
        const double radius = 48;
        final String clothoidD = debugPathData(
          w,
          h,
          LisseCorners.all(
            radius: radius,
            curve: LisseCurve.clothoid,
            smoothing: 0,
          ),
        );
        final String arcD = debugPathData(
          w,
          h,
          LisseCorners.all(radius: radius, curve: LisseCurve.arc),
        );

        final List<double> a = coords(clothoidD);
        final List<double> b = coords(arcD);
        expect(
          a.length,
          b.length,
          reason: 'point counts differ:\n$clothoidD\n$arcD',
        );
        for (int k = 0; k < a.length; k++) {
          expect(
            (a[k] - b[k]).abs(),
            lessThan(0.5),
            reason: 'coord $k differs: ${a[k]} vs ${b[k]}',
          );
        }
      });
    }

    for (final double smoothing in <double>[0.4, 0.8]) {
      test('smoothing $smoothing stays inside the rect and closes', () {
        const double w = 260, h = 200, radius = 56;
        final Path path = lissePath(
          const Rect.fromLTWH(0, 0, w, h),
          LisseCorners.all(
            radius: radius,
            curve: LisseCurve.clothoid,
            smoothing: smoothing,
          ),
        );

        // Closed: dart:ui reports a contour for a closed sub-path.
        final List<PathMetric> metrics = path.computeMetrics().toList();
        expect(metrics, isNotEmpty);
        expect(metrics.first.isClosed, isTrue);

        // Strictly within the rect (allow a hair of float slack at the edges).
        const double eps = 1e-3;
        for (final Offset p in samplePath(path)) {
          expect(p.dx, greaterThanOrEqualTo(-eps));
          expect(p.dx, lessThanOrEqualTo(w + eps));
          expect(p.dy, greaterThanOrEqualTo(-eps));
          expect(p.dy, lessThanOrEqualTo(h + eps));
        }
      });
    }

    test('integrateClothoid returns finite points that grow with l', () {
      // κ(s) = A·s with A = 1/(R·L); use R = 48, L = π/2·R·s, s = 1.
      const double r = 48;
      final double bigL = (math.pi / 2) * r;
      final double a = 1 / (r * bigL);

      ClothoidPoint dist(double l) {
        final ClothoidPoint p = integrateClothoid(0, 0, a, l);
        return p;
      }

      final ClothoidPoint quarter = dist(bigL / 4);
      final ClothoidPoint half = dist(bigL / 2);
      final ClothoidPoint full = dist(bigL);

      for (final ClothoidPoint p in <ClothoidPoint>[quarter, half, full]) {
        expect(p.x.isFinite, isTrue);
        expect(p.y.isFinite, isTrue);
        expect(p.theta.isFinite, isTrue);
      }

      // Arc length along the curve grows, so the displacement magnitude grows.
      double mag(ClothoidPoint p) => math.sqrt(p.x * p.x + p.y * p.y);
      expect(mag(quarter), lessThan(mag(half)));
      expect(mag(half), lessThan(mag(full)));

      // l = 0 is the origin with the seed heading.
      final ClothoidPoint zero = integrateClothoid(0, 0, a, 0);
      expect(zero.x, 0);
      expect(zero.y, 0);
    });
  });
}
