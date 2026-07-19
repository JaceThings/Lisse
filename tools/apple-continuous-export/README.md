# Apple continuous-corner export

Apple exposes **no smoothing parameter**. Continuous corners are a fixed
shape for a given corner radius (`RoundedRectangle(..., style: .continuous)`
/ `UIBezierPath(roundedRect:cornerRadius:)` on iOS).

These scripts dump that shape as SVG so you can compare it to Lisse/Figma.

## SwiftUI (live Apple API)

```bash
swift tools/apple-continuous-export/ExportSwiftUIContinuous.swift
# → /tmp/lisse-issue-103/swiftui-continuous-400-100.svg
```

Defaults: 400×400 box, radius 100 (25% — the geometry from
[issue #103](https://github.com/JaceThings/Lisse/issues/103)).

## Rosenfeld constants (iOS UIBezierPath reverse-engineer)

```bash
swift tools/apple-continuous-export/ExportRosenfeld.swift 400 100 /tmp/out.svg
```

Same shoulder extent (`p/R = 1.528665`). Differs from live SwiftUI by
≲ 0.25 px at R=100.

## Findings (issue #103 geometry)

Against SwiftUI `.continuous` at 400×400 R=100, Lisse/Figma squircle
Hausdorff error:

| smoothing | error |
|-----------|-------|
| 0.60 (`FIGMA_SMOOTHING`) | ~0.58 px |
| 0.65 (`APPLE_SMOOTHING`, library default) | ~0.52 px |
| ~0.636 (numeric best fit) | ~0.51 px |

Residual ≈ 0.5 px cannot reach zero — different constructions. Lisse
defaults to `APPLE_SMOOTHING` (0.65); pass `FIGMA_SMOOTHING` for Figma's
labeled 60% preset.
