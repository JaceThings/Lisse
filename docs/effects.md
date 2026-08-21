# Effects

Lisse clips your element with `clip-path`, which slices through CSS borders and shadows. The library provides SVG-based replacements that follow the squircle shape perfectly.

## Built-in effects

All framework bindings support five effects rendered as SVG overlays:

| Effect | Description |
|---|---|
| `innerBorder` | Border drawn inside the squircle path (clipped to the shape) |
| `outerBorder` | Border drawn outside the squircle path (masked to the exterior) |
| `middleBorder` | Border centred on the squircle path (half inside, half outside) |
| `innerShadow` | Inset shadow inside the squircle |
| `shadow` | Drop shadow behind the squircle |

```tsx
<SmoothCorners
  corners={{ radius: 24 }}
  innerBorder={{ width: 1, color: "#ffffff", opacity: 0.2 }}
  outerBorder={{ width: 2, color: "#000000", opacity: 0.1 }}
  middleBorder={{ width: 1, color: "#ff0000", opacity: 0.5 }}
  innerShadow={{ offsetX: 0, offsetY: 2, blur: 4, spread: 0, color: "#000000", opacity: 0.15 }}
  shadow={{ offsetX: 0, offsetY: 8, blur: 24, spread: 0, color: "#000000", opacity: 0.2 }}
  style={{ background: "linear-gradient(135deg, #667eea, #764ba2)", padding: 32 }}
>
  <p style={{ color: "#fff" }}>Card with all effects</p>
</SmoothCorners>
```

## Multiple shadows

Both `shadow` and `innerShadow` accept a single `ShadowConfig` or an array of `ShadowConfig[]`. When auto-extracting from CSS, all `box-shadow` layers are extracted — not just the first.

```tsx
<SmoothCorners
  corners={{ radius: 24 }}
  shadow={[
    { offsetX: 0, offsetY: 2, blur: 4, spread: 0, color: "#000000", opacity: 0.1 },
    { offsetX: 0, offsetY: 8, blur: 24, spread: -4, color: "#000000", opacity: 0.2 },
  ]}
  innerShadow={[
    { offsetX: 0, offsetY: 1, blur: 2, spread: 0, color: "#000000", opacity: 0.1 },
    { offsetX: 0, offsetY: -1, blur: 2, spread: 0, color: "#ffffff", opacity: 0.05 },
  ]}
  style={{ background: "#fff", padding: 32 }}
>
  Card with layered shadows
</SmoothCorners>
```

CSS `box-shadow` with multiple layers is also extracted automatically:

```tsx
{/* Both shadow layers are extracted and rendered as SVG */}
<SmoothCorners
  corners={{ radius: 24 }}
  style={{
    background: "#fff",
    padding: 32,
    boxShadow: "0 2px 4px rgba(0,0,0,0.1), 0 8px 24px rgba(0,0,0,0.2)",
  }}
>
  Auto-extracted multiple shadows
</SmoothCorners>
```

## Border styles

All three border types (`innerBorder`, `outerBorder`, `middleBorder`) support style variants:

| Style | Description |
|---|---|
| `solid` | Default. Continuous stroke. |
| `dashed` | Dashed stroke. Customise with `dash` and `gap`. |
| `dotted` | Dotted stroke (round caps by default). Customise with `dash` and `gap`. |
| `double` | Two lines with a gap in the middle. Requires `width >= 3`. |
| `groove` | 3D grooved effect (darker shade on the outside). |
| `ridge` | 3D ridged effect (darker shade on the inside). |

```tsx
<SmoothCorners
  corners={{ radius: 24 }}
  innerBorder={{
    width: 4,
    color: "#3b82f6",
    opacity: 1,
    style: "dashed",
    dash: 12,     // dash length (default: width * 3)
    gap: 6,       // gap length (default: width * 2)
    lineCap: "round",  // "butt" | "round" | "square"
  }}
>
  Dashed border
</SmoothCorners>
```

## Gradient borders

`BorderConfig.color` accepts either a hex string or a `GradientConfig` object, enabling gradient-coloured borders on any border type and any border style.

Gradient borders are **API-only** — they cannot be auto-extracted from CSS `border-image`.

Two gradient types are available:

- **`LinearGradientConfig`**: `{ type: "linear", angle?: number, stops: GradientStop[] }`. The `angle` is in CSS degrees (default `0`, bottom-to-top; `90` is left-to-right).
- **`RadialGradientConfig`**: `{ type: "radial", cx?: number, cy?: number, r?: number, stops: GradientStop[] }`. All values are relative (0 to 1), defaulting to `0.5`.

Each `GradientStop` is `{ offset: number, color: string, opacity?: number }` where `offset` ranges from 0 to 1.

For `groove` and `ridge` border styles, each stop's colour is automatically darkened (`RGB * 2/3`) to produce the 3D shading effect.

```tsx
<SmoothCorners
  corners={{ radius: 24 }}
  innerBorder={{
    width: 2,
    color: {
      type: "linear",
      angle: 135,
      stops: [
        { offset: 0, color: "#667eea" },
        { offset: 1, color: "#764ba2" },
      ],
    },
    opacity: 1,
  }}
  style={{ background: "#fff", padding: 32 }}
>
  Gradient border
</SmoothCorners>
```

Radial gradient example:

```tsx
<SmoothCorners
  corners={{ radius: 24 }}
  outerBorder={{
    width: 3,
    color: {
      type: "radial",
      cx: 0.5,
      cy: 0.5,
      r: 0.7,
      stops: [
        { offset: 0, color: "#ff6b6b" },
        { offset: 0.5, color: "#feca57", opacity: 0.8 },
        { offset: 1, color: "#48dbfb" },
      ],
    },
    opacity: 1,
    style: "dashed",
    dash: 8,
    gap: 4,
  }}
  style={{ background: "#1a1a2e", padding: 32, color: "#fff" }}
>
  Radial gradient dashed border
</SmoothCorners>
```

## Auto-effects

By default, Lisse automatically reads your CSS and converts it to SVG equivalents. On mount, the library:

1. Reads the element's computed `border` and `box-shadow`
2. Converts them to SVG effects (`innerBorder`, `shadow`, `innerShadow`)
3. Strips the CSS properties so they don't get clipped
4. Restores the original CSS on unmount

Elements with existing CSS borders and shadows just work:

```tsx
{/* CSS border is automatically converted to an SVG inner border */}
<SmoothCorners corners={{ radius: 24 }} style={{ border: "2px solid red" }}>
  Content
</SmoothCorners>
```

Explicit effect props take priority over auto-extracted values:

```tsx
{/* Explicit innerBorder wins over the CSS border */}
<SmoothCorners
  corners={{ radius: 24 }}
  style={{ border: "2px solid red" }}
  innerBorder={{ width: 1, color: "#00ff00", opacity: 1 }}
>
  Content
</SmoothCorners>
```

### Disabling auto-effects

Pass `autoEffects={false}` (React and Octane), `:auto-effects="false"` (Vue), or `autoEffects: false` (Svelte). When disabled, CSS borders and shadows are left untouched and no automatic extraction occurs.

### What gets extracted

| CSS property | SVG effect | Notes |
|---|---|---|
| `border` | `innerBorder` | Width, colour, opacity, and style (including `dashed`, `dotted`, `double`, `groove`, `ridge`) are extracted from the top edge. |
| `box-shadow` (outer) | `shadow` | All outer shadows (supports multiple). |
| `box-shadow` (inset) | `innerShadow` | All inset shadows (supports multiple). |

> `middleBorder` and `outerBorder` have no CSS equivalent and are only available as explicit props.

## Where the overlay is mounted

Effects render into an SVG overlay that is **never** a child of the clipped
element: `clip-path` clips an element's entire subtree, so an `outerBorder` —
which paints outside the squircle — would be cut away. The overlay is instead
appended to an anchor and absolutely positioned over your element.

The anchor is the element's parent by default, so outer effects work on an
element that is itself the layout target, with no wrapper in the way:

```tsx
// The <button> stays the direct grid item and keyboard-focus target.
const ref = useRef<HTMLButtonElement>(null);
useSmoothCorners(ref, { radius: 18 }, {
  effects: { outerBorder: { width: 3, color: "#3b82f6", opacity: 1 } },
});
```

Several elements may share one parent — each overlay is positioned over its own
element. Things worth knowing:

| | Effect |
|---|---|
| A `static` anchor | Gets `position: relative` (ref-counted, restored on unmount). |
| An anchor with `overflow: hidden`/`auto` | Clips outer effects at its edges, like any other child. Anchor to an ancestor outside the scroll container, or add padding. |
| `:last-child` on the anchor | Will match the overlay. Overlays are appended last, so `:first-child` and `:nth-child(n)` for your own elements are unaffected. |
| Pointing the wrapper option at the clipped element itself | Ignored — the parent is used instead, because a nested overlay could not paint an outer border. |

The overlay follows the element whenever the element or the anchor resizes. In
React it additionally re-checks on every commit, so a state change that only
realigns the container is caught too; the Vue composable and the Svelte action
re-check on a config change, not on an unrelated parent re-render.

A move driven by none of those — pure CSS realignment with no size change and no
update, e.g. a `:hover` rule flipping the container's `justify-content` — has
nothing to observe and stays put until the next resize or update.

### Limitations

| CSS feature | What happens |
|---|---|
| Per-side borders | Only the top border is read. All four sides are stripped. |
| `inset`, `outset` border styles | Rendered as solid. |
| `border-image` | Not detected. Use gradient borders via the API instead. |
| `outline` | Not read or stripped. |

- **`groove` / `ridge` shading**: the dark shade is computed as `RGB * 2/3`, matching Firefox's algorithm.
- **Gradient border auto-extraction**: gradient borders are API-only. CSS `border-image` is not detected or extracted.
- **`double` border minimum width**: requires `border-width >= 3px` because the double style needs space for two lines and a gap. Below 3px, the border falls back to solid.
- **`outline`**: not extracted because CSS outlines don't follow `border-radius` in all browsers, and the squircle shape would make standard outlines look incorrect.
- **CSS transitions**: stripped properties (`border`, `box-shadow`) will not animate because they are removed from the element and replaced with SVG. Use `autoEffects: false` and drive explicit effect props instead.
- **Wrapper div (React/Vue)**: the `<SmoothCorners>` component injects a wrapper `<div>` with `position: relative` for SVG overlay positioning. Use the hook/composable/action approach for full layout control — it adds no wrapper, and outer effects work there too (see below).
- **`border-image`**: not detected because CSS `border-image` syntax is complex (angle units, colour spaces, slice semantics). Use gradient borders via the explicit `BorderConfig.color` API instead.
- **`!important` rules**: cannot be overridden because the library strips effects via inline styles, and `!important` stylesheet rules take precedence over inline styles. Move the rule to a non-`!important` selector, or use `autoEffects: false`.
- **Per-side borders**: only the top border is read during auto-extraction because `getComputedStyle` returns per-side values (`borderTopWidth`, `borderTopColor`, etc.) and the SVG overlay renders a single uniform border around the entire squircle. If you need different colours per side, use explicit effect props.
- **One-time extraction (mount-time snapshot)**: CSS effects are read once on mount because continuously polling `getComputedStyle` would hurt performance, and a `MutationObserver` on the host element can't see ancestor class changes or CSS variable updates that affect computed style. **Re-mount the element to re-extract** after a theme switch or token change. An imperative `refresh()` API for in-place re-extraction is planned for v0.4. Until then, use explicit effect props for dynamic values.
