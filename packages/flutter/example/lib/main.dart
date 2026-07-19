import 'package:flutter/material.dart';
import 'package:lisse/lisse.dart';

void main() => runApp(const LisseGalleryApp());

const Color _bg = Color(0xFFF1F1F4);
const Color _ink = Color(0xFF18181B);
const Color _muted = Color(0xFF71717A);
const Color _accent = Color(0xFF4F46E5);
const Color _accent2 = Color(0xFF06B6D4);

class LisseGalleryApp extends StatelessWidget {
  const LisseGalleryApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Lisse for Flutter',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(scaffoldBackgroundColor: _bg, fontFamily: 'Roboto'),
      home: const _Gallery(),
    );
  }
}

class _Gallery extends StatelessWidget {
  const _Gallery();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 1040),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(32, 56, 32, 80),
            children: [
              const Text(
                'Lisse',
                style: TextStyle(
                  fontSize: 44,
                  fontWeight: FontWeight.w700,
                  color: _ink,
                  letterSpacing: -1,
                ),
              ),
              const SizedBox(height: 6),
              const Text(
                'Smooth corners for Flutter — squircle, arc, '
                'superellipse and clothoid, as a native ShapeBorder.',
                style: TextStyle(fontSize: 16, color: _muted),
              ),
              const SizedBox(height: 44),

              _section('Curve families', 'Same 56px radius, four curves.'),
              Wrap(
                spacing: 20,
                runSpacing: 20,
                children: [
                  _curveTile('arc', LisseCurve.arc),
                  _curveTile('squircle', LisseCurve.squircle),
                  _curveTile('superellipse', LisseCurve.superellipse),
                  _curveTile('clothoid', LisseCurve.clothoid),
                ],
              ),
              const SizedBox(height: 44),

              _section('Squircle smoothing', '0 (arc) → 1 (max).'),
              Wrap(
                spacing: 20,
                runSpacing: 20,
                children: [
                  for (final s in const [0.0, 0.3, 0.6, 1.0])
                    _labelled(
                      's = $s',
                      _fill(LisseCorners.all(radius: 52, smoothing: s)),
                    ),
                ],
              ),
              const SizedBox(height: 44),

              _section(
                'Superellipse exponent',
                'n = 2 is a circle; higher is squarer.',
              ),
              Wrap(
                spacing: 20,
                runSpacing: 20,
                children: [
                  for (final n in const [2.0, 4.0, 6.0, 8.0])
                    _labelled(
                      'n = $n',
                      _fill(
                        LisseCorners.all(
                          radius: 52,
                          curve: LisseCurve.superellipse,
                          exponent: n,
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 44),

              _section(
                'Effects',
                'Shadows, borders and fills tracing the curve.',
              ),
              Wrap(
                spacing: 20,
                runSpacing: 20,
                children: [
                  _labelled(
                    'drop shadow',
                    SmoothBox(
                      width: 150,
                      height: 110,
                      corners: LisseCorners.all(radius: 34),
                      color: Colors.white,
                      shadows: const [
                        BoxShadow(
                          color: Color(0x33000000),
                          blurRadius: 26,
                          offset: Offset(0, 12),
                        ),
                      ],
                    ),
                  ),
                  _labelled(
                    'inner shadow',
                    SmoothBox(
                      width: 150,
                      height: 110,
                      corners: LisseCorners.all(radius: 34),
                      color: const Color(0xFFE6E6EB),
                      innerShadows: const [
                        LisseInnerShadow(
                          color: Color(0x73000000),
                          blur: 18,
                          spread: 1,
                          offset: Offset(0, 7),
                        ),
                      ],
                    ),
                  ),
                  _labelled(
                    'solid border',
                    SmoothBox(
                      width: 150,
                      height: 110,
                      corners: LisseCorners.all(radius: 34),
                      color: Colors.white,
                      side: const BorderSide(color: _accent, width: 3),
                    ),
                  ),
                  _labelled(
                    'concentric',
                    SmoothBox(
                      width: 150,
                      height: 110,
                      corners: LisseCorners.all(radius: 34),
                      color: Colors.white,
                      borders: const [
                        LisseBorderLayer(width: 4, color: _accent),
                        LisseBorderLayer(width: 3, color: _accent2),
                      ],
                    ),
                  ),
                  _labelled(
                    'gradient fill',
                    SmoothBox(
                      width: 150,
                      height: 110,
                      corners: LisseCorners.all(radius: 34),
                      gradient: const LinearGradient(
                        colors: [_accent, _accent2],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                    ),
                  ),
                  _labelled(
                    'gradient border',
                    SmoothBox(
                      width: 150,
                      height: 110,
                      corners: LisseCorners.all(radius: 34),
                      color: Colors.white,
                      borders: const [
                        LisseBorderLayer(
                          width: 5,
                          gradient: LinearGradient(colors: [_accent, _accent2]),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 28),

              _section(
                'Border styles',
                'dashed · dotted',
              ),
              Wrap(
                spacing: 20,
                runSpacing: 20,
                children: [
                  for (final e in const [
                    ['dashed', LisseBorderStyle.dashed],
                    ['dotted', LisseBorderStyle.dotted],
                  ])
                    _labelled(
                      e[0] as String,
                      SmoothBox(
                        width: 132,
                        height: 100,
                        corners: LisseCorners.all(radius: 30),
                        color: Colors.white,
                        borders: [
                          LisseBorderLayer(
                            width: 6,
                            color: _accent,
                            style: e[1] as LisseBorderStyle,
                          ),
                        ],
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 44),

              _section(
                'Per-corner',
                'Each corner its own radius, curve and smoothing.',
              ),
              Wrap(
                spacing: 20,
                runSpacing: 20,
                children: [
                  _labelled(
                    'asymmetric',
                    _fillSized(
                      220,
                      130,
                      LisseCorners.only(
                        topLeft: const LisseCorner(radius: 12),
                        topRight: const LisseCorner(radius: 44, smoothing: 0.6),
                        bottomRight: const LisseCorner(radius: 0),
                        bottomLeft: const LisseCorner(
                          radius: 60,
                          smoothing: 0.3,
                        ),
                      ),
                    ),
                  ),
                  _labelled(
                    'pill',
                    _fillSized(220, 96, LisseCorners.all(radius: 80)),
                  ),
                ],
              ),
              const SizedBox(height: 44),

              _section(
                'ClipPath',
                'Clipping arbitrary content to the silhouette.',
              ),
              Align(
                alignment: Alignment.centerLeft,
                child: ClipPath(
                  clipper: ShapeBorderClipper(
                    shape: LisseBorder(corners: LisseCorners.all(radius: 40)),
                  ),
                  child: Container(
                    width: 320,
                    height: 170,
                    decoration: const BoxDecoration(
                      gradient: LinearGradient(
                        colors: [_accent, _accent2],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                    ),
                    alignment: Alignment.center,
                    child: const Text(
                      'clipped',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 26,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 44),

              _section(
                'A card',
                'SmoothBox the way you would actually ship it.',
              ),
              Align(
                alignment: Alignment.centerLeft,
                child: SmoothBox(
                  width: 340,
                  corners: LisseCorners.all(radius: 28),
                  color: Colors.white,
                  padding: const EdgeInsets.all(22),
                  shadows: const [
                    BoxShadow(
                      color: Color(0x1A000000),
                      blurRadius: 30,
                      offset: Offset(0, 16),
                    ),
                  ],
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      SmoothBox(
                        width: 52,
                        height: 52,
                        corners: LisseCorners.all(radius: 16),
                        gradient: const LinearGradient(
                          colors: [_accent, _accent2],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        child: const Icon(Icons.bolt, color: Colors.white),
                      ),
                      const SizedBox(height: 16),
                      const Text(
                        'Continuous corners',
                        style: TextStyle(
                          fontSize: 19,
                          fontWeight: FontWeight.w700,
                          color: _ink,
                        ),
                      ),
                      const SizedBox(height: 6),
                      const Text(
                        'The same Figma squircle maths the web packages ship, '
                        'now as a Flutter ShapeBorder.',
                        style: TextStyle(
                          fontSize: 14,
                          color: _muted,
                          height: 1.45,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  static Widget _section(String title, String sub) => Padding(
    padding: const EdgeInsets.only(bottom: 18),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: const TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.w700,
            color: _ink,
          ),
        ),
        const SizedBox(height: 2),
        Text(sub, style: const TextStyle(fontSize: 14, color: _muted)),
      ],
    ),
  );

  static Widget _labelled(String label, Widget child) => Column(
    mainAxisSize: MainAxisSize.min,
    children: [
      child,
      const SizedBox(height: 8),
      Text(
        label,
        style: const TextStyle(
          fontSize: 12.5,
          color: _muted,
          fontWeight: FontWeight.w500,
        ),
      ),
    ],
  );

  static Widget _curveTile(String name, LisseCurve curve) => _labelled(
    name,
    SmoothBox(
      width: 150,
      height: 150,
      corners: LisseCorners.all(radius: 56, curve: curve),
      gradient: const LinearGradient(
        colors: [_accent, _accent2],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
    ),
  );

  static Widget _fill(LisseCorners corners) => _fillSized(150, 150, corners);

  static Widget _fillSized(double w, double h, LisseCorners corners) =>
      SmoothBox(width: w, height: h, corners: corners, color: _accent);
}
