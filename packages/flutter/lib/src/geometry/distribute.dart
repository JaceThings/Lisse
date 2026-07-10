import 'dart:math' as math;

/// One of the four corners.
enum Corner { topLeft, topRight, bottomLeft, bottomRight }

/// A corner after radius distribution with its available budget.
class NormalizedCorner {
  final double radius;
  final double roundingAndSmoothingBudget;
  const NormalizedCorner(this.radius, this.roundingAndSmoothingBudget);
}

class _Adjacent {
  final Corner corner;
  final String side; // top | bottom | left | right
  const _Adjacent(this.corner, this.side);
}

/// Each corner's two edge-sharing neighbours, with the shared side.
const Map<Corner, List<_Adjacent>> _adjacentsByCorner = {
  Corner.topLeft: [
    _Adjacent(Corner.topRight, 'top'),
    _Adjacent(Corner.bottomLeft, 'left'),
  ],
  Corner.topRight: [
    _Adjacent(Corner.topLeft, 'top'),
    _Adjacent(Corner.bottomRight, 'right'),
  ],
  Corner.bottomLeft: [
    _Adjacent(Corner.bottomRight, 'bottom'),
    _Adjacent(Corner.topLeft, 'left'),
  ],
  Corner.bottomRight: [
    _Adjacent(Corner.bottomLeft, 'bottom'),
    _Adjacent(Corner.topRight, 'right'),
  ],
};

/// Distribute available space among corners, normalizing radii so they don't
/// exceed the rectangle dimensions. Larger corners get priority.
Map<Corner, NormalizedCorner> distributeAndNormalize({
  required double topLeftCornerRadius,
  required double topRightCornerRadius,
  required double bottomRightCornerRadius,
  required double bottomLeftCornerRadius,
  required double width,
  required double height,
}) {
  final Map<Corner, double> budget = {
    Corner.topLeft: -1,
    Corner.topRight: -1,
    Corner.bottomLeft: -1,
    Corner.bottomRight: -1,
  };

  final Map<Corner, double> radii = {
    Corner.topLeft: topLeftCornerRadius,
    Corner.topRight: topRightCornerRadius,
    Corner.bottomLeft: bottomLeftCornerRadius,
    Corner.bottomRight: bottomRightCornerRadius,
  };

  // Let bigger corners choose first. Ties keep insertion order
  // (topLeft, topRight, bottomLeft, bottomRight) so allocation is
  // deterministic and matches the reference implementation's stable sort.
  const List<Corner> base = [
    Corner.topLeft,
    Corner.topRight,
    Corner.bottomLeft,
    Corner.bottomRight,
  ];
  final List<Corner> order = List<Corner>.from(base);
  order.sort((a, b) {
    final int cmp = radii[b]!.compareTo(radii[a]!);
    if (cmp != 0) return cmp;
    return base.indexOf(a).compareTo(base.indexOf(b));
  });

  for (final Corner corner in order) {
    final double radius = radii[corner]!;
    final List<_Adjacent> adjacents = _adjacentsByCorner[corner]!;

    double cornerBudget = double.infinity;
    for (final _Adjacent adjacent in adjacents) {
      final double adjacentCornerRadius = radii[adjacent.corner]!;
      double candidate;
      if (radius == 0 && adjacentCornerRadius == 0) {
        candidate = 0;
      } else {
        final double adjacentCornerBudget = budget[adjacent.corner]!;
        final double sideLength =
            (adjacent.side == 'top' || adjacent.side == 'bottom')
            ? width
            : height;
        if (adjacentCornerBudget >= 0) {
          candidate = sideLength - adjacentCornerBudget;
        } else {
          candidate = (radius / (radius + adjacentCornerRadius)) * sideLength;
        }
      }
      cornerBudget = math.min(cornerBudget, candidate);
    }

    budget[corner] = cornerBudget;
    radii[corner] = math.min(radius, cornerBudget);
  }

  return {
    for (final Corner c in Corner.values)
      c: NormalizedCorner(radii[c]!, budget[c]!),
  };
}
