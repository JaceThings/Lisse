/// Corner curve family. Default: [LisseCurve.squircle] (the Figma curve).
enum LisseCurve { arc, squircle, superellipse, clothoid }

/// Default superellipse exponent. Matches CSS `corner-shape: squircle`
/// (Lamé n = 4).
const double kDefaultExponent = 4;

/// Default Figma squircle smoothing.
const double kDefaultSmoothing = 0.6;

/// Preserve smoothing when space is limited.
const bool kDefaultPreserveSmoothing = true;
