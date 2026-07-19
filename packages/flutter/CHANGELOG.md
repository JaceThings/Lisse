# Changelog

## Unreleased

- Default smoothing is now `0.65` (`kAppleSmoothing`). Figma's labeled
  "iOS" preset is `kFigmaSmoothing` (`0.6`). Matches `@lisse/core`.

## 0.2.0

- Smooth capsules: full-radius pills and circles now render as true smoothed
  capsules — the Figma shoulder on the flat-edge side only, so the cap midline
  stays circular — with a continuous rectangle→capsule blend near the
  threshold (no pop while resizing across it). Matches `@lisse/core` 0.5.0.

## 0.1.1

- Shorten the package description to pub.dev's 180-character limit (no code
  changes).

## 0.1.0

Initial release.

- `LisseBorder`, an `OutlinedBorder` for smooth-cornered rectangles, so clip,
  border and shadow trace the curve through the framework.
- Four curve families: `arc`, `squircle` (Figma, continuous smoothing),
  `superellipse` (Lamé) and `clothoid`.
- Per-corner configuration via `LisseCorners` / `LisseCorner`.
- `SmoothBox` and `SmoothClip` widgets.
- Effects: outer shadows, inner shadows, concentric borders, styled borders
  (`dashed`, `dotted`, `doubleLine`, `groove`, `ridge`) and gradient
  fills/borders.
- `lerp` support for implicit animation; memoised corner geometry.
- Pure Dart — every Flutter target, no platform channels.
