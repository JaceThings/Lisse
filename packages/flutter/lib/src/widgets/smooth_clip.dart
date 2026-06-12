import 'package:flutter/widgets.dart';

import '../border/lisse_border.dart';
import '../geometry/lisse_corner.dart';

/// Clips [child] to a Lisse smooth-cornered silhouette.
///
/// A thin wrapper over [ClipPath] + [ShapeBorderClipper]; reach for
/// [SmoothBox] when you also want a fill, border, or shadow.
class SmoothClip extends StatelessWidget {
  const SmoothClip({
    super.key,
    required this.corners,
    this.clipBehavior = Clip.antiAlias,
    this.child,
  });

  final LisseCorners corners;
  final Clip clipBehavior;
  final Widget? child;

  @override
  Widget build(BuildContext context) {
    return ClipPath(
      clipper: ShapeBorderClipper(shape: LisseBorder(corners: corners)),
      clipBehavior: clipBehavior,
      child: child,
    );
  }
}
