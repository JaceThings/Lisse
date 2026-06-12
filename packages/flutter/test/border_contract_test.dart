import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lisse/lisse.dart';

/// Inflate a rect by [d] on every side, so a `contains` check tolerates the
/// sub-pixel slop a curved bounding box leaves against a straight one.
bool rectContains(Rect outer, Rect inner, {double tol = 0.5}) {
  final Rect grown = outer.inflate(tol);
  return grown.left <= inner.left &&
      grown.top <= inner.top &&
      grown.right >= inner.right &&
      grown.bottom >= inner.bottom;
}

void main() {
  const Rect rect = Rect.fromLTWH(0, 0, 200, 120);

  group('getOuterPath', () {
    test('is closed and bounds match the rect', () {
      final border = LisseBorder.all(radius: 24);
      final path = border.getOuterPath(rect);

      // A filled smooth-cornered rect leaves the path closed.
      final metrics = path.computeMetrics().toList();
      expect(metrics, isNotEmpty);
      expect(metrics.single.isClosed, isTrue);

      expect(path.getBounds().left, closeTo(rect.left, 0.5));
      expect(path.getBounds().top, closeTo(rect.top, 0.5));
      expect(path.getBounds().right, closeTo(rect.right, 0.5));
      expect(path.getBounds().bottom, closeTo(rect.bottom, 0.5));
    });

    test('honours rect origin offset', () {
      const offset = Rect.fromLTWH(40, 30, 200, 120);
      final path = LisseBorder.all(radius: 24).getOuterPath(offset);
      final b = path.getBounds();
      expect(b.left, closeTo(offset.left, 0.5));
      expect(b.top, closeTo(offset.top, 0.5));
      expect(b.right, closeTo(offset.right, 0.5));
      expect(b.bottom, closeTo(offset.bottom, 0.5));
    });
  });

  group('getInnerPath', () {
    test('contained within outer when side.width > 0', () {
      final border = LisseBorder.all(
        radius: 24,
        side: const BorderSide(width: 6),
      );
      final outer = border.getOuterPath(rect).getBounds();
      final inner = border.getInnerPath(rect).getBounds();

      expect(rectContains(outer, inner), isTrue);
      // Inside stroke alignment shrinks the inner rect on every edge.
      expect(inner.width, lessThan(outer.width));
      expect(inner.height, lessThan(outer.height));
    });

    test('equals outer when side is none', () {
      final border = LisseBorder.all(radius: 24);
      final outer = border.getOuterPath(rect).getBounds();
      final inner = border.getInnerPath(rect).getBounds();

      expect(inner.left, closeTo(outer.left, 0.001));
      expect(inner.top, closeTo(outer.top, 0.001));
      expect(inner.right, closeTo(outer.right, 0.001));
      expect(inner.bottom, closeTo(outer.bottom, 0.001));
    });
  });

  group('dimensions', () {
    test('is EdgeInsets.all(side.strokeInset)', () {
      const side = BorderSide(width: 4);
      final border = LisseBorder.all(radius: 24, side: side);
      expect(border.dimensions, EdgeInsets.all(side.strokeInset));
    });

    test('is zero with no side', () {
      final border = LisseBorder.all(radius: 24);
      expect(border.dimensions, EdgeInsets.zero);
    });
  });

  group('scale', () {
    test('doubles corner radii and side width', () {
      final border = LisseBorder.all(
        radius: 24,
        side: const BorderSide(width: 3),
      );
      final scaled = border.scale(2.0);

      expect(scaled, isA<LisseBorder>());
      final ls = scaled as LisseBorder;
      expect(ls.corners.topLeft.radius, closeTo(48, 1e-9));
      expect(ls.corners.topRight.radius, closeTo(48, 1e-9));
      expect(ls.corners.bottomRight.radius, closeTo(48, 1e-9));
      expect(ls.corners.bottomLeft.radius, closeTo(48, 1e-9));
      expect(ls.side.width, closeTo(6, 1e-9));
    });
  });

  group('copyWith', () {
    test('replaces side only', () {
      final border = LisseBorder.all(radius: 24);
      const newSide = BorderSide(width: 5, color: Color(0xFF112233));
      final copy = border.copyWith(side: newSide);

      expect(copy.side, newSide);
      expect(copy.corners, border.corners);
    });

    test('replaces corners only', () {
      final border = LisseBorder.all(
        radius: 24,
        side: const BorderSide(width: 5),
      );
      final newCorners = LisseCorners.all(radius: 8);
      final copy = border.copyWith(corners: newCorners);

      expect(copy.corners, newCorners);
      expect(copy.side, border.side);
    });

    test('keeps both when given nothing', () {
      final border = LisseBorder.all(
        radius: 24,
        side: const BorderSide(width: 5),
      );
      final copy = border.copyWith();
      expect(copy, border);
    });
  });

  group('value equality', () {
    test('equal borders are == with equal hashCodes', () {
      final a = LisseBorder.all(radius: 24, side: const BorderSide(width: 2));
      final b = LisseBorder.all(radius: 24, side: const BorderSide(width: 2));
      expect(a, equals(b));
      expect(a.hashCode, b.hashCode);
    });

    test('differing radius breaks equality', () {
      final a = LisseBorder.all(radius: 24);
      final b = LisseBorder.all(radius: 25);
      expect(a, isNot(equals(b)));
    });

    test('differing side breaks equality', () {
      final a = LisseBorder.all(radius: 24, side: const BorderSide(width: 2));
      final b = LisseBorder.all(radius: 24, side: const BorderSide(width: 3));
      expect(a, isNot(equals(b)));
    });

    test('differing curve breaks equality', () {
      final a = LisseBorder.all(radius: 24, curve: LisseCurve.squircle);
      final b = LisseBorder.all(radius: 24, curve: LisseCurve.arc);
      expect(a, isNot(equals(b)));
    });
  });

  group('lerp', () {
    test('lerpFrom same curve gives an intermediate radius', () {
      final a = LisseBorder.all(radius: 10, curve: LisseCurve.squircle);
      final b = LisseBorder.all(radius: 30, curve: LisseCurve.squircle);
      final mid = b.lerpFrom(a, 0.5);

      expect(mid, isA<LisseBorder>());
      final corners = (mid! as LisseBorder).corners;
      expect(corners.topLeft.radius, closeTo(20, 1e-9));
    });

    test('lerpTo same curve gives an intermediate radius', () {
      final a = LisseBorder.all(radius: 10, curve: LisseCurve.squircle);
      final b = LisseBorder.all(radius: 30, curve: LisseCurve.squircle);
      final mid = a.lerpTo(b, 0.5);

      expect(mid, isA<LisseBorder>());
      final corners = (mid! as LisseBorder).corners;
      expect(corners.topLeft.radius, closeTo(20, 1e-9));
    });

    test('lerp between different curves does not throw', () {
      final squircle = LisseBorder.all(radius: 10, curve: LisseCurve.squircle);
      final arc = LisseBorder.all(radius: 30, curve: LisseCurve.arc);

      // Discrete family switch at t = 0.5: must return a ShapeBorder, not throw.
      expect(arc.lerpFrom(squircle, 0.5), isA<ShapeBorder>());
      expect(squircle.lerpTo(arc, 0.5), isA<ShapeBorder>());
      expect(arc.lerpFrom(squircle, 0.25), isA<ShapeBorder>());
      expect(squircle.lerpTo(arc, 0.75), isA<ShapeBorder>());
    });

    test('lerpFrom a non-LisseBorder does not throw', () {
      final border = LisseBorder.all(radius: 24);
      // Falls through to OutlinedBorder.lerpFrom; nulls are acceptable.
      expect(() => border.lerpFrom(null, 0.5), returnsNormally);
    });
  });

  testWidgets('works as a ShapeDecoration shape with shadows', (tester) async {
    await tester.pumpWidget(
      Directionality(
        textDirection: TextDirection.ltr,
        child: Center(
          child: SizedBox(
            width: 200,
            height: 120,
            child: DecoratedBox(
              decoration: ShapeDecoration(
                shape: LisseBorder.all(
                  radius: 24,
                  side: const BorderSide(width: 2),
                ),
                color: const Color(0xFFFFFFFF),
                shadows: const [BoxShadow(blurRadius: 8)],
              ),
            ),
          ),
        ),
      ),
    );

    expect(tester.takeException(), isNull);
  });
}
