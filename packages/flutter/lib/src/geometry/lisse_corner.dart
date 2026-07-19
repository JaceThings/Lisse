import 'lisse_curve.dart';

/// Configuration for a single corner. Immutable: all fields are final.
class LisseCorner {
  /// Corner radius in logical pixels.
  final double radius;

  /// Curve family. Default: [LisseCurve.squircle].
  final LisseCurve curve;

  /// 0 (sharp) to 1 (max). Used by `squircle` and `clothoid`; ignored by
  /// `arc` and `superellipse`. Default: [kAppleSmoothing] (`0.65`);
  /// Figma's "iOS" preset is [kFigmaSmoothing] (`0.6`).
  final double smoothing;

  /// Superellipse exponent, only when [curve] is [LisseCurve.superellipse].
  /// Default: 4 (matches CSS `corner-shape: squircle`).
  final double exponent;

  /// Preserve smoothing when space is limited. Default: true.
  final bool preserveSmoothing;

  const LisseCorner({
    required this.radius,
    this.curve = LisseCurve.squircle,
    this.smoothing = kDefaultSmoothing,
    this.exponent = kDefaultExponent,
    this.preserveSmoothing = kDefaultPreserveSmoothing,
  });

  static const LisseCorner zero = LisseCorner(radius: 0);

  LisseCorner copyWith({
    double? radius,
    LisseCurve? curve,
    double? smoothing,
    double? exponent,
    bool? preserveSmoothing,
  }) {
    return LisseCorner(
      radius: radius ?? this.radius,
      curve: curve ?? this.curve,
      smoothing: smoothing ?? this.smoothing,
      exponent: exponent ?? this.exponent,
      preserveSmoothing: preserveSmoothing ?? this.preserveSmoothing,
    );
  }

  /// Linear interpolation between two corners of the same [curve]. When the
  /// curves differ a discrete switch at t = 0.5 is used (shapes of different
  /// families are not geometrically interpolable).
  static LisseCorner lerp(LisseCorner a, LisseCorner b, double t) {
    if (a.curve != b.curve) return t < 0.5 ? a : b;
    return LisseCorner(
      radius: a.radius + (b.radius - a.radius) * t,
      curve: a.curve,
      smoothing: a.smoothing + (b.smoothing - a.smoothing) * t,
      exponent: a.exponent + (b.exponent - a.exponent) * t,
      preserveSmoothing: t < 0.5 ? a.preserveSmoothing : b.preserveSmoothing,
    );
  }

  @override
  bool operator ==(Object other) =>
      other is LisseCorner &&
      other.radius == radius &&
      other.curve == curve &&
      other.smoothing == smoothing &&
      other.exponent == exponent &&
      other.preserveSmoothing == preserveSmoothing;

  @override
  int get hashCode =>
      Object.hash(radius, curve, smoothing, exponent, preserveSmoothing);
}

/// Per-corner configuration for a rectangle. Immutable: all fields are final.
class LisseCorners {
  final LisseCorner topLeft;
  final LisseCorner topRight;
  final LisseCorner bottomRight;
  final LisseCorner bottomLeft;

  const LisseCorners({
    required this.topLeft,
    required this.topRight,
    required this.bottomRight,
    required this.bottomLeft,
  });

  /// One config applied to all four corners.
  const LisseCorners.uniform(LisseCorner corner)
      : topLeft = corner,
        topRight = corner,
        bottomRight = corner,
        bottomLeft = corner;

  /// Uniform corners built from scalars.
  LisseCorners.all({
    required double radius,
    LisseCurve curve = LisseCurve.squircle,
    double smoothing = kDefaultSmoothing,
    double exponent = kDefaultExponent,
    bool preserveSmoothing = kDefaultPreserveSmoothing,
  }) : this.uniform(
          LisseCorner(
            radius: radius,
            curve: curve,
            smoothing: smoothing,
            exponent: exponent,
            preserveSmoothing: preserveSmoothing,
          ),
        );

  /// Per-corner; any corner left null is a sharp (radius 0) corner.
  LisseCorners.only({
    LisseCorner? topLeft,
    LisseCorner? topRight,
    LisseCorner? bottomRight,
    LisseCorner? bottomLeft,
  })  : topLeft = topLeft ?? LisseCorner.zero,
        topRight = topRight ?? LisseCorner.zero,
        bottomRight = bottomRight ?? LisseCorner.zero,
        bottomLeft = bottomLeft ?? LisseCorner.zero;

  bool get isAllZero =>
      topLeft.radius <= 0 &&
      topRight.radius <= 0 &&
      bottomRight.radius <= 0 &&
      bottomLeft.radius <= 0;

  LisseCorners copyWith({
    LisseCorner? topLeft,
    LisseCorner? topRight,
    LisseCorner? bottomRight,
    LisseCorner? bottomLeft,
  }) {
    return LisseCorners(
      topLeft: topLeft ?? this.topLeft,
      topRight: topRight ?? this.topRight,
      bottomRight: bottomRight ?? this.bottomRight,
      bottomLeft: bottomLeft ?? this.bottomLeft,
    );
  }

  /// Each corner radius reduced by [inset] (clamped at 0); other fields kept.
  /// A negative [inset] grows the radii (used for outside-aligned strokes).
  LisseCorners deflate(double inset) {
    LisseCorner d(LisseCorner k) {
      final double r = k.radius - inset;
      return k.copyWith(radius: r < 0 ? 0 : r);
    }

    return LisseCorners(
      topLeft: d(topLeft),
      topRight: d(topRight),
      bottomRight: d(bottomRight),
      bottomLeft: d(bottomLeft),
    );
  }

  /// Each corner radius multiplied by [t].
  LisseCorners scale(double t) {
    LisseCorner s(LisseCorner k) => k.copyWith(radius: k.radius * t);
    return LisseCorners(
      topLeft: s(topLeft),
      topRight: s(topRight),
      bottomRight: s(bottomRight),
      bottomLeft: s(bottomLeft),
    );
  }

  static LisseCorners lerp(LisseCorners a, LisseCorners b, double t) {
    return LisseCorners(
      topLeft: LisseCorner.lerp(a.topLeft, b.topLeft, t),
      topRight: LisseCorner.lerp(a.topRight, b.topRight, t),
      bottomRight: LisseCorner.lerp(a.bottomRight, b.bottomRight, t),
      bottomLeft: LisseCorner.lerp(a.bottomLeft, b.bottomLeft, t),
    );
  }

  @override
  bool operator ==(Object other) =>
      other is LisseCorners &&
      other.topLeft == topLeft &&
      other.topRight == topRight &&
      other.bottomRight == bottomRight &&
      other.bottomLeft == bottomLeft;

  @override
  int get hashCode => Object.hash(topLeft, topRight, bottomRight, bottomLeft);
}
