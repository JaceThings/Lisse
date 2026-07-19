/// Smooth-corner (squircle) rendering for Flutter.
///
/// The headline type is [LisseBorder] — an [OutlinedBorder] you can hand to
/// any Flutter API that takes a shape (`ShapeDecoration`, `Material`, `Card`,
/// `ClipPath`), so clipping, borders and shadows trace the squircle natively.
/// [SmoothBox] is a convenience widget on top of it.
library;

export 'src/geometry/lisse_curve.dart' show LisseCurve;
export 'src/geometry/lisse_corner.dart' show LisseCorner, LisseCorners;
export 'src/geometry/lisse_path.dart' show debugPathData;
export 'src/geometry/corner_cache.dart' show clearCurveCache;

export 'src/border/lisse_border.dart' show LisseBorder;
export 'src/ui_path.dart' show lissePath;

export 'src/effects/lisse_effects.dart'
    show LisseInnerShadow, LisseBorderLayer, LisseBorderStyle;
export 'src/widgets/smooth_box.dart' show SmoothBox;
