import '../builder.dart';
import '../lisse_curve.dart';
import 'arc.dart';
import 'clothoid.dart';
import 'squircle.dart';
import 'superellipse.dart';

/// Single source of truth for which builder runs per curve type.
CurveBuilder getCurveBuilder(LisseCurve type) {
  switch (type) {
    case LisseCurve.arc:
      return buildArc;
    case LisseCurve.squircle:
      return buildSquircle;
    case LisseCurve.superellipse:
      return buildSuperellipse;
    case LisseCurve.clothoid:
      return buildClothoid;
  }
}
