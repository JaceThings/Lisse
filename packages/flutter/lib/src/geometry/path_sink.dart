/// Sink that corner builders and the stitcher write into. Two
/// implementations exist: [StringPathSink] (pure Dart, for verification /
/// debugging) and the `dart:ui` adapter in the border layer. Keeping the
/// math behind this interface lets the whole geometry stay free of
/// `dart:ui`, so it runs under `dart run` / `dart test` without a Flutter
/// binding.
///
/// `moveTo` / `lineTo` are absolute; `relativeCubicTo` / `relativeArcTo`
/// are relative to the current pen position — matching the SVG `M`/`L`/`c`/
/// `a` commands the path is composed from.
abstract class PathSink {
  void moveTo(double x, double y);
  void lineTo(double x, double y);
  void relativeCubicTo(
    double dx1,
    double dy1,
    double dx2,
    double dy2,
    double dx3,
    double dy3,
  );

  /// Relative SVG arc. Every Lisse corner arc is a non-large clockwise
  /// quarter (`a rx ry 0 0 1 dx dy`); [clockwise] is exposed for clarity.
  void relativeArcTo(
    double rx,
    double ry,
    double dx,
    double dy, {
    bool clockwise = true,
  });

  void close();
}

/// Emits an SVG path `d` string. Used by `debugPathData` and the
/// parity/verification harness. All numbers are formatted to 4 decimals,
/// the precision the geometry rounds to.
class StringPathSink implements PathSink {
  final StringBuffer _b = StringBuffer();
  bool _first = true;

  void _gap() {
    if (!_first) _b.write(' ');
    _first = false;
  }

  static String _f(double n) => n.toStringAsFixed(4);

  @override
  void moveTo(double x, double y) {
    _gap();
    _b.write('M ${_f(x)} ${_f(y)}');
  }

  @override
  void lineTo(double x, double y) {
    _gap();
    _b.write('L ${_f(x)} ${_f(y)}');
  }

  @override
  void relativeCubicTo(
    double dx1,
    double dy1,
    double dx2,
    double dy2,
    double dx3,
    double dy3,
  ) {
    _gap();
    _b.write(
      'c ${_f(dx1)} ${_f(dy1)} ${_f(dx2)} ${_f(dy2)} ${_f(dx3)} ${_f(dy3)}',
    );
  }

  @override
  void relativeArcTo(
    double rx,
    double ry,
    double dx,
    double dy, {
    bool clockwise = true,
  }) {
    _gap();
    _b.write(
      'a ${_f(rx)} ${_f(ry)} 0 0 ${clockwise ? 1 : 0} ${_f(dx)} ${_f(dy)}',
    );
  }

  @override
  void close() {
    _gap();
    _b.write('Z');
  }

  String get data => _b.toString();
}
