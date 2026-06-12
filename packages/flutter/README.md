# Lisse for Flutter

Smooth-corner (squircle) rendering for Flutter. The same Figma squircle maths
Lisse ships for the web, as a native `ShapeBorder` — so clipping, borders and
shadows trace the curve for free.

Four corner curves: **arc** (the plain `border-radius` quarter-circle),
**squircle** (the Figma curve, with continuous smoothing), **superellipse**
(Lamé) and **clothoid** (curvature-continuous). Pure Dart, no platform
channels — it runs everywhere Flutter does, including web and desktop.

## Install

```yaml
dependencies:
  lisse: ^0.1.0
```

## Use it

The headline type is `LisseBorder`, an `OutlinedBorder`. Hand it to anything
that takes a shape and the rest follows:

```dart
Container(
  decoration: ShapeDecoration(
    shape: LisseBorder(corners: LisseCorners.all(radius: 24)),
    color: Colors.white,
    shadows: const [BoxShadow(blurRadius: 24, color: Colors.black26)],
  ),
);
```

The shadow traces the squircle, not a rounded rectangle — `ShapeDecoration`
paints it from the shape's outline. The same border works on `Material`,
`Card`, `ClipPath`, dialogs and bottom sheets.

### SmoothBox

`SmoothBox` wraps the common case — fill, shadow, border, clipped child — and
adds the effects Flutter has no native answer for:

```dart
SmoothBox(
  corners: LisseCorners.all(radius: 28),
  color: Colors.white,
  padding: const EdgeInsets.all(20),
  shadows: const [BoxShadow(blurRadius: 30, offset: Offset(0, 16), color: Color(0x1A000000))],
  child: const Text('Continuous corners'),
);
```

### Clip anything

```dart
SmoothClip(
  corners: LisseCorners.all(radius: 40),
  child: Image.asset('hero.jpg', fit: BoxFit.cover),
);
```

## Curves

```dart
LisseCorners.all(radius: 24, curve: LisseCurve.squircle, smoothing: 0.6);
LisseCorners.all(radius: 24, curve: LisseCurve.superellipse, exponent: 4);
```

| Curve | Knob | Notes |
|---|---|---|
| `arc` | — | Quarter circle; the CSS `border-radius` curve. |
| `squircle` | `smoothing` 0–1 | The Figma curve. Default. `smoothing: 0` is an arc. |
| `superellipse` | `exponent` ≥ 2 | Lamé. `4` matches CSS `corner-shape: squircle`. |
| `clothoid` | `smoothing` 0–1 | Curvature ramps linearly; G2 at every seam. |

Corners are per-corner. Give each its own radius, curve and smoothing:

```dart
LisseCorners.only(
  topLeft: const LisseCorner(radius: 12),
  topRight: const LisseCorner(radius: 44, smoothing: 0.6),
  bottomLeft: const LisseCorner(radius: 60, curve: LisseCurve.clothoid),
  // bottomRight defaults to sharp
);
```

## Effects

Fills, a single border and outer shadows ride on the native `ShapeDecoration`.
`SmoothBox` adds, custom-painted:

- **Inner shadows** — `innerShadows: [LisseInnerShadow(...)]`.
- **Concentric borders** — `borders: [LisseBorderLayer(width: 4, color: ...), ...]`, painted outer edge inward.
- **Styled borders** — `LisseBorderStyle.dashed | dotted | doubleLine | groove | ridge`.
- **Gradient fills and gradient borders** — native Flutter `Gradient` values.

## Animating

`LisseBorder` interpolates, so implicit animations just work:

```dart
AnimatedContainer(
  duration: const Duration(milliseconds: 300),
  decoration: ShapeDecoration(
    shape: LisseBorder(corners: LisseCorners.all(radius: expanded ? 48 : 12)),
    color: Colors.white,
  ),
);
```

Radius, smoothing and exponent tween between two borders of the same curve.

## Notes

- Corners are physical (`topLeft`, `topRight`, …) and don't flip under RTL.
- `LisseBorder` clips with `ShapeBorderClipper`, fills with `ShapeDecoration`,
  and draws ink within the shape on `Material`.
- The corner maths is memoised, so resize storms don't re-run it.

MIT © Jace Attard. Part of [Lisse](https://corne.rs).
