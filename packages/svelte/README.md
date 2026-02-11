yes # @smooth-corners/svelte

Svelte action for smooth-cornered (squircle) elements, powered by [Figma's smoothing algorithm](https://www.figma.com/blog/desperately-seeking-squircles/).

[![npm](https://img.shields.io/npm/v/%40smooth-corners%2Fsvelte)](https://www.npmjs.com/package/@smooth-corners/svelte)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE)

## Installation

```sh
npm install @smooth-corners/svelte
```

No peer dependencies required.

## Quick Start

```svelte
<script>
  import { smoothCorners } from "@smooth-corners/svelte";
</script>

<div use:smoothCorners={{ radius: 20, smoothing: 0.6 }} style="background: #fff; padding: 24px">
  Hello, squircle
</div>
```

## `smoothCorners` Action

The action accepts two input formats: simple mode (corner options only) or config mode (corners + effects).

### Simple Mode

Pass `SmoothCornerOptions` directly when you only need the clip-path:

```svelte
<script>
  import { smoothCorners } from "@smooth-corners/svelte";
</script>

<!-- Uniform radius -->
<div use:smoothCorners={{ radius: 24, smoothing: 0.6 }}>
  Content
</div>

<!-- Per-corner -->
<div use:smoothCorners={{ topLeft: 32, topRight: 16, bottomRight: 8, bottomLeft: 0 }}>
  Content
</div>
```

### Config Mode

Pass a `SmoothCornersConfig` object when you need effects:

```svelte
<script>
  import { smoothCorners } from "@smooth-corners/svelte";
</script>

<div use:smoothCorners={{
  corners: { radius: 24, smoothing: 0.6 },
  effects: {
    innerBorder: { width: 1, color: "#ffffff", opacity: 0.2 },
    shadow: { offsetX: 0, offsetY: 8, blur: 24, spread: 0, color: "#000000", opacity: 0.2 },
  },
}}>
  Content
</div>
```

### Reactive Updates

The action responds to parameter changes automatically. Use reactive declarations to update options:

```svelte
<script>
  import { smoothCorners } from "@smooth-corners/svelte";

  let radius = $state(20);
</script>

<input type="range" min="0" max="60" bind:value={radius} />
<div use:smoothCorners={{ radius, smoothing: 0.6 }} style="background: #3b82f6; padding: 24px; color: #fff">
  Radius: {radius}
</div>
```

### Per-Corner Configuration

```svelte
<script>
  import { smoothCorners } from "@smooth-corners/svelte";
</script>

<div use:smoothCorners={{
  topLeft: { radius: 40, smoothing: 0.8 },
  topRight: 20,
  bottomRight: { radius: 30, smoothing: 0.4, preserveSmoothing: false },
  bottomLeft: 0,
}}>
  Different corners
</div>
```

## Auto Effects (enabled by default)

smooth-corners clips your element with `clip-path`, which slices through CSS `border` and `box-shadow`. Normally that means you have to remove your CSS styles and rewrite them as SVG-based effect config -- extra work that's easy to forget.

**Auto effects removes that step.** When the action initializes, the library automatically:

1. Reads the element's computed `border` and `box-shadow`
2. Converts them to equivalent SVG effects (`innerBorder`, `shadow`, `innerShadow`)
3. Strips the CSS properties so they don't get clipped
4. Sets `position: relative` on the parent element if needed
5. Restores the original CSS and parent position on destroy

This is enabled by default in both simple mode and config mode -- existing CSS borders and shadows just work.

```svelte
<!-- The CSS border is automatically converted to an SVG inner border -->
<div
  use:smoothCorners={{ radius: 24 }}
  style="border: 2px solid red; padding: 24px"
>
  Content with auto border
</div>
```

### Explicit effects win

If you pass effects in config mode, they take priority over auto-extracted values per key:

```svelte
<!-- Explicit innerBorder overrides the CSS border; CSS box-shadow is still auto-extracted -->
<div
  use:smoothCorners={{
    corners: { radius: 24 },
    effects: { innerBorder: { width: 1, color: '#00ff00', opacity: 1 } },
  }}
  style="border: 2px solid red; box-shadow: 0 4px 12px rgba(0,0,0,0.2)"
>
  Content
</div>
```

### Disabling auto effects

Use config mode and set `autoEffects: false`:

```svelte
<div use:smoothCorners={{ corners: { radius: 24 }, autoEffects: false }}>
  Content
</div>
```

When disabled, CSS borders and shadows are left untouched and no automatic extraction occurs -- the original pre-autoEffects behavior. You will need to ensure the parent has `position: relative` yourself if using manual effects.

Note: in simple mode (passing `SmoothCornerOptions` directly), `autoEffects` is always `true` and cannot be disabled. Switch to config mode to control it.

### How CSS properties are mapped

| CSS property | SVG effect | Notes |
|---|---|---|
| `border` | `innerBorder` | Width, color, opacity, and style extracted from the top edge. |
| `box-shadow` (outer) | `shadow` | First outer shadow only. |
| `box-shadow` (inset) | `innerShadow` | First inset shadow only. |

### Limitations

**Partial CSS conversion:**

| CSS feature | What happens |
|---|---|
| Per-side borders | Only the top border is read. All four sides are stripped -- differing sides are lost. |
| `dashed`, `dotted`, `double`, `groove`, `ridge` | Supported. Extracted from CSS and rendered as SVG equivalents. |
| `inset`, `outset` border styles | Not replicated. Rendered as solid. |
| Multiple `box-shadow` layers | Only the first outer and first inset shadow are kept. All layers are stripped. |
| `border-image` | Not detected. May be misread as a solid border and stripped incorrectly. |
| `outline` | Not read or stripped. |

**Behavioral notes:**

- **One-time extraction** -- CSS is read once on init (not re-evaluated on `update()`). Use explicit effects in config mode for dynamic values.
- **`!important` rules** -- inline style overrides can't beat `!important`. The CSS property stays visible (clipped) alongside the SVG replacement, producing doubled visuals. Move the rule to a non-`!important` selector, or use `autoEffects: false`.
- **CSS transitions** -- `border` and `box-shadow` are stripped via inline styles, so CSS transitions on those properties won't animate. Use `autoEffects: false` and drive explicit effect props from an animation system instead.
- **`double` minimum width** -- `double` borders require at least 3px `border-width` to render as double. Thinner double borders fall back to solid.
- **`groove` / `ridge` approximation** -- the dark shade is computed as `RGB × 2/3` (matching Firefox). The shading is uniform around the squircle (no per-side light direction as CSS does on rectangles), which may differ slightly from browser CSS rendering.

## CSS Borders and Shadows

smooth-corners works by applying a CSS `clip-path` to the element. This means CSS `border`, `box-shadow`, and `outline` get clipped and will look broken at the corners. With `autoEffects` enabled (the default), CSS borders and box-shadows are automatically converted to SVG equivalents. You can also use the library's `innerBorder`, `outerBorder`, `innerShadow`, and `shadow` effect config directly -- these render as SVG overlays that correctly follow the squircle path.

## Effects

Effects are rendered as SVG overlays. When using effects, the parent element must have `position: relative` for correct overlay positioning.

```svelte
<script>
  import { smoothCorners } from "@smooth-corners/svelte";
</script>

<div style="position: relative">
  <div use:smoothCorners={{
    corners: { radius: 24, smoothing: 0.6 },
    effects: {
      innerBorder: { width: 1, color: "#ffffff", opacity: 0.3 },
      outerBorder: { width: 2, color: "#000000", opacity: 0.1 },
      innerShadow: { offsetX: 0, offsetY: 2, blur: 4, spread: 0, color: "#000000", opacity: 0.15 },
      shadow: { offsetX: 0, offsetY: 8, blur: 24, spread: 0, color: "#000000", opacity: 0.2 },
    },
  }} style="background: linear-gradient(135deg, #667eea, #764ba2); padding: 32px; color: #fff">
    Card with all effects
  </div>
</div>
```

### Effect Types

**`BorderConfig`**

| Property | Type | Description |
|----------|------|-------------|
| `width` | `number` | Border width in pixels |
| `color` | `string` | Border color (hex) |
| `opacity` | `number` | Border opacity (0-1) |

**`ShadowConfig`**

| Property | Type | Description |
|----------|------|-------------|
| `offsetX` | `number` | Horizontal offset in pixels |
| `offsetY` | `number` | Vertical offset in pixels |
| `blur` | `number` | Blur radius in pixels |
| `spread` | `number` | Spread distance in pixels |
| `color` | `string` | Shadow color (hex) |
| `opacity` | `number` | Shadow opacity (0-1) |

## Types

### `SmoothCornersAction`

```ts
interface SmoothCornersAction {
  update(options: SmoothCornerOptions | SmoothCornersConfig): void;
  destroy(): void;
}
```

### `SmoothCornersConfig`

```ts
interface SmoothCornersConfig {
  corners: SmoothCornerOptions;
  effects?: EffectsConfig;
  autoEffects?: boolean; // Default: true
}
```

The action also re-exports all core types: `SmoothCornerOptions`, `UniformCornerOptions`, `PerCornerConfig`, `CornerConfig`, `BorderConfig`, `ShadowConfig`, `EffectsConfig`.

## License

[MIT](../../LICENSE)
