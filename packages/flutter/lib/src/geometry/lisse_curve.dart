/// Corner curve family. Default: [LisseCurve.squircle] (the Figma curve).
enum LisseCurve { arc, squircle, superellipse, clothoid }

/// Default superellipse exponent. Matches CSS `corner-shape: squircle`
/// (Lamé n = 4).
const double kDefaultExponent = 4;

/// Closest Figma-curve match to Apple's continuous corner.
const double kAppleSmoothing = 0.65;

/// Figma's labeled "iOS" preset (60%). Use for design-handoff parity.
const double kFigmaSmoothing = 0.6;

/// Default corner smoothing — same value as [kAppleSmoothing].
/// Use [kFigmaSmoothing] for Figma's 60% preset.
const double kDefaultSmoothing = 0.65;

/// Preserve smoothing when space is limited.
const bool kDefaultPreserveSmoothing = true;
