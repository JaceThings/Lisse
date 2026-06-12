// Golden silhouette lock. Pure shapes only (no text — fonts are not
// deterministic in the test harness). Baselines are HOST-GENERATED via
// `flutter test --update-goldens test/golden_test.dart`; regenerate on the
// same host if the rasteriser changes.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lisse/lisse.dart';

const Color _bg = Color(0xFFFFFFFF);
const Color _fill = Color(0xFF3366CC);

/// One filled tile, fixed 120×120, radius 48 in the given [curve].
Widget _tile(LisseCurve curve) {
  return SmoothBox(
    width: 120,
    height: 120,
    corners: LisseCorners.all(radius: 48, curve: curve),
    color: _fill,
  );
}

/// Wraps [child] in a sized, white, LTR surface so the raster is fully
/// determined (no MediaQuery / Directionality ambiguity).
Widget _surface(Widget child, {required double width, required double height}) {
  return Directionality(
    textDirection: TextDirection.ltr,
    child: Center(
      child: ColoredBox(
        color: _bg,
        child: SizedBox(width: width, height: height, child: child),
      ),
    ),
  );
}

void main() {
  testWidgets('curves silhouettes', (WidgetTester tester) async {
    final Widget row = Padding(
      padding: const EdgeInsets.all(16),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: <Widget>[
          _tile(LisseCurve.arc),
          const SizedBox(width: 16),
          _tile(LisseCurve.squircle),
          const SizedBox(width: 16),
          _tile(LisseCurve.superellipse),
          const SizedBox(width: 16),
          _tile(LisseCurve.clothoid),
        ],
      ),
    );

    // 4×120 + 3×16 gaps + 2×16 padding = 560 wide; 120 + 32 = 152 tall.
    await tester.pumpWidget(_surface(row, width: 560, height: 152));
    await expectLater(
      find.byType(Row),
      matchesGoldenFile('goldens/curves.png'),
    );
  });

  testWidgets('effects: outer shadow + concentric borders', (
    WidgetTester tester,
  ) async {
    final Widget box = SmoothBox(
      width: 120,
      height: 120,
      corners: LisseCorners.all(radius: 40, curve: LisseCurve.squircle),
      color: _fill,
      shadows: const <BoxShadow>[
        BoxShadow(
          color: Color(0x55000000),
          blurRadius: 16,
          offset: Offset(0, 8),
        ),
      ],
      borders: const <LisseBorderLayer>[
        LisseBorderLayer(width: 4, color: Color(0xFF112244)),
        LisseBorderLayer(width: 3, color: Color(0xFFFFCC00)),
      ],
    );

    await tester.pumpWidget(
      _surface(
        Center(child: box),
        width: 200,
        height: 200,
      ),
    );
    await expectLater(
      find.byType(SmoothBox),
      matchesGoldenFile('goldens/effects.png'),
    );
  });
}
