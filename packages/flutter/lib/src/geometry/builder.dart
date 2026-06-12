import 'orient.dart';
import 'path_sink.dart';

/// Post-distribute input to a single corner builder. [cornerRadius] is
/// already clamped to the rectangle; [roundingAndSmoothingBudget] is how
/// much of the adjacent edge this corner may consume.
class CurveBuilderInput {
  final double cornerRadius;
  final double smoothing;
  final double exponent;
  final bool preserveSmoothing;
  final double roundingAndSmoothingBudget;

  const CurveBuilderInput({
    required this.cornerRadius,
    required this.smoothing,
    required this.exponent,
    required this.preserveSmoothing,
    required this.roundingAndSmoothingBudget,
  });
}

/// Writes the corner's relative segments into [sink], entering at the
/// current pen position and exiting at the opposite tangency point, rotated
/// for [orient].
typedef CornerEmit = void Function(PathSink sink, Orient orient);

/// Output of a corner builder: [p] is the tangency distance from the sharp
/// vertex (where the curve starts along each adjacent edge); [emit] draws
/// the segment.
class CornerOutput {
  /// Tangency distance from the sharp vertex.
  final double p;
  final CornerEmit emit;

  const CornerOutput(this.p, this.emit);
}

void _noopEmit(PathSink sink, Orient orient) {}

/// Shared zero-radius output. Builders short-circuit to this when the
/// (post-budget-clamp) corner footprint is non-positive.
const CornerOutput emptyCornerOutput = CornerOutput(0, _noopEmit);

typedef CurveBuilder = CornerOutput Function(CurveBuilderInput input);
