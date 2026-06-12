import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lisse/lisse.dart';

void main() {
  final LisseCorners corners = LisseCorners.all(radius: 24);

  group('SmoothBox', () {
    testWidgets('passes child content through', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Center(
            child: SmoothBox(
              corners: corners,
              color: const Color(0xFF2196F3),
              child: const Text('hello lisse'),
            ),
          ),
        ),
      );

      expect(find.text('hello lisse'), findsOneWidget);
    });

    testWidgets('paints the full effect set without throwing',
        (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Center(
            child: SmoothBox(
              corners: corners,
              width: 200,
              height: 120,
              gradient: const LinearGradient(
                colors: <Color>[Color(0xFF6A1B9A), Color(0xFFEC407A)],
              ),
              shadows: const <BoxShadow>[
                BoxShadow(
                    color: Color(0x55000000),
                    blurRadius: 12,
                    offset: Offset(0, 6)),
                BoxShadow(color: Color(0x33FF0000), blurRadius: 4),
              ],
              innerShadows: const <LisseInnerShadow>[
                LisseInnerShadow(
                    color: Color(0x66000000),
                    blur: 8,
                    spread: 2,
                    offset: Offset(0, 2)),
              ],
              side: const BorderSide(color: Color(0xFF000000), width: 1),
              padding: const EdgeInsets.all(8),
              borders: const <LisseBorderLayer>[
                LisseBorderLayer(width: 2, color: Color(0xFFFFFFFF)),
                LisseBorderLayer(
                  width: 3,
                  gradient: LinearGradient(
                      colors: <Color>[Color(0xFF00E5FF), Color(0xFF1DE9B6)]),
                  style: LisseBorderStyle.dashed,
                ),
                LisseBorderLayer(
                    width: 4,
                    color: Color(0xFF9E9E9E),
                    style: LisseBorderStyle.doubleLine),
                LisseBorderLayer(
                    width: 4,
                    color: Color(0xFF607D8B),
                    style: LisseBorderStyle.groove),
                LisseBorderLayer(
                    width: 4,
                    color: Color(0xFF607D8B),
                    style: LisseBorderStyle.ridge),
                LisseBorderLayer(
                    width: 2,
                    color: Color(0xFF212121),
                    style: LisseBorderStyle.dotted),
              ],
              child: const Text('full set'),
            ),
          ),
        ),
      );
      await tester.pump();

      expect(tester.takeException(), isNull);
      expect(find.text('full set'), findsOneWidget);
    });

    testWidgets('renders with Clip.none (unclipped) without throwing',
        (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: SmoothBox(
            corners: corners,
            clipBehavior: Clip.none,
            color: const Color(0xFF4CAF50),
            child: const Text('no clip'),
          ),
        ),
      );

      expect(tester.takeException(), isNull);
      expect(find.text('no clip'), findsOneWidget);
    });

    test('asserts when both color and gradient are supplied', () {
      // The assert lives in the const constructor, so construction throws.
      expect(
        () => SmoothBox(
          corners: corners,
          color: const Color(0xFF000000),
          gradient: const LinearGradient(
              colors: <Color>[Color(0xFF000000), Color(0xFFFFFFFF)]),
        ),
        throwsAssertionError,
      );
    });
  });

  group('SmoothClip', () {
    testWidgets('clips a child and mounts without exception',
        (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Center(
            child: SmoothClip(
              corners: corners,
              child: Container(
                width: 100,
                height: 100,
                color: const Color(0xFFFF5722),
                child: const Text('clipped'),
              ),
            ),
          ),
        ),
      );

      expect(tester.takeException(), isNull);
      expect(find.text('clipped'), findsOneWidget);
      expect(find.byType(ClipPath), findsOneWidget);
    });
  });

  group('LisseBorderStyle', () {
    for (final LisseBorderStyle style in LisseBorderStyle.values) {
      testWidgets('renders $style border without throwing',
          (WidgetTester tester) async {
        await tester.pumpWidget(
          MaterialApp(
            home: Center(
              child: SmoothBox(
                corners: corners,
                width: 150,
                height: 80,
                color: const Color(0xFFFFFFFF),
                borders: <LisseBorderLayer>[
                  LisseBorderLayer(
                      width: 4, color: const Color(0xFF3F51B5), style: style),
                ],
              ),
            ),
          ),
        );
        await tester.pump();

        expect(tester.takeException(), isNull);
      });
    }
  });
}
