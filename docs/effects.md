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

`BorderConfig.color` is a hex string.

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

Pass `autoEffects={false}` (React), `:auto-effects="false"` (Vue), or `autoEffects: false` (Svelte). When disabled, CSS borders and shadows are left untouched and no automatic extraction occurs.

### What gets extracted

| CSS property | SVG effect | Notes |
|---|---|---|
| `border` | `innerBorder` | Width, colour, opacity, and style (`solid`, `dashed`, `dotted`) are extracted from the top edge. |
| `box-shadow` (outer) | `shadow` | All outer shadows (supports multiple). |
| `box-shadow` (inset) | `innerShadow` | All inset shadows (supports multiple). |

> `middleBorder` and `outerBorder` have no CSS equivalent and are only available as explicit props.

### Limitations

| CSS feature | What happens |
|---|---|
| Per-side borders | Only the top border is read. All four sides are stripped. |
| `double`, `groove`, `ridge` | Not supported. Rendered as solid. |
| `inset`, `outset` border styles | Rendered as solid. |
| `border-image` | Not detected. |
| Gradient borders via CSS | Not supported. |
| `outline` | Not read or stripped. |

- **CSS transitions**: stripped properties (`border`, `box-shadow`) will not animate because they are removed from the element and replaced with SVG. Use `autoEffects: false` and drive explicit effect props instead.
- **Wrapper div (React/Vue)**: the `<SmoothCorners>` component injects a wrapper `<div>` with `position: relative` for SVG overlay positioning. Use the hook/composable/action approach for full layout control.
- **`border-image`**: not detected because CSS `border-image` syntax is complex (angle units, colour spaces, slice semantics).
- **`!important` rules**: cannot be overridden because the library strips effects via inline styles, and `!important` stylesheet rules take precedence over inline styles. Move the rule to a non-`!important` selector, or use `autoEffects: false`.
- **Per-side borders**: only the top border is read during auto-extraction because `getComputedStyle` returns per-side values (`borderTopWidth`, `borderTopColor`, etc.) and the SVG overlay renders a single uniform border around the entire squircle. If you need different colours per side, use explicit effect props.
- **One-time extraction (mount-time snapshot)**: CSS effects are read once on mount because continuously polling `getComputedStyle` would hurt performance, and a `MutationObserver` on the host element can't see ancestor class changes or CSS variable updates that affect computed style. **Re-mount the element to re-extract** after a theme switch or token change. An imperative `refresh()` API for in-place re-extraction is planned for v0.4. Until then, use explicit effect props for dynamic values.
