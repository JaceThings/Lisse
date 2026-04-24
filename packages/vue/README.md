# @lisse/vue

Vue composable and component for smooth-cornered (squircle) elements, powered by [Figma's smoothing algorithm](https://www.figma.com/blog/desperately-seeking-squircles/).

[![npm](https://img.shields.io/npm/v/%40lisse%2Fvue)](https://www.npmjs.com/package/@lisse/vue)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/JaceThings/Lisse/blob/main/LICENSE)

## Installation

```sh
npm install @lisse/vue
```

**Peer dependency:** `vue >= 3.3.0`

## Which API Should I Use?

- **`SmoothCorners` component** -- Renders its own element with smooth corners applied. Handles effects and wrapper creation automatically. Use this when building new UI or when you want a drop-in replacement for a `<div>`.
- **`useSmoothCorners` composable** -- Applies smooth corners to an existing element via a template ref. Use this when you already have an element and don't want to change your DOM structure.

## Quick Start

```vue
<script setup>
import { ref } from "vue";
import { useSmoothCorners } from "@lisse/vue";

const el = ref(null);
useSmoothCorners(el, { radius: 20, smoothing: 0.6 });
</script>

<template>
  <div ref="el" style="background: #fff; padding: 24px">Hello, squircle</div>
</template>
```

## `useSmoothCorners` Composable

Apply smooth corners to any element via a template ref. Options can be reactive.

### Signature

```ts
function useSmoothCorners(
  target: Ref<HTMLElement | null>,
  options: MaybeRef<SmoothCornerOptions>,
  effectsOptions?: UseEffectsOptions,
): void;
```

### Basic Usage

```vue
<script setup>
import { ref } from "vue";
import { useSmoothCorners } from "@lisse/vue";

const el = ref(null);
useSmoothCorners(el, { radius: 24, smoothing: 0.6 });
</script>

<template>
  <div ref="el" style="background: #f8fafc; padding: 32px">
    <h2>Card Title</h2>
    <p>Card content goes here.</p>
  </div>
</template>
```

### Reactive Options

Pass a `ref` or `computed` as the options argument to reactively update the corners:

```vue
<script setup>
import { ref } from "vue";
import { useSmoothCorners } from "@lisse/vue";

const el = ref(null);
const radius = ref(20);
useSmoothCorners(el, ref({ radius: radius.value, smoothing: 0.6 }));
</script>

<template>
  <input type="range" min="0" max="60" v-model.number="radius" />
  <div ref="el" style="background: #3b82f6; padding: 24px; color: #fff">
    Radius: {{ radius }}
  </div>
</template>
```

Or with `computed`:

```vue
<script setup>
import { ref, computed } from "vue";
import { useSmoothCorners } from "@lisse/vue";

const el = ref(null);
const radius = ref(20);
const options = computed(() => ({ radius: radius.value, smoothing: 0.6 }));
useSmoothCorners(el, options);
</script>

<template>
  <input type="range" min="0" max="60" v-model.number="radius" />
  <div ref="el" style="background: #3b82f6; padding: 24px; color: #fff">
    Radius: {{ radius }}
  </div>
</template>
```

### With Effects

When using effects with the composable, provide a wrapper ref for the SVG overlay:

```vue
<script setup>
import { ref } from "vue";
import { useSmoothCorners } from "@lisse/vue";

const wrapper = ref(null);
const el = ref(null);

useSmoothCorners(el, { radius: 24, smoothing: 0.6 }, {
  wrapper,
  effects: {
    innerBorder: { width: 1, color: "#ffffff", opacity: 0.2 },
    shadow: { offsetX: 0, offsetY: 8, blur: 24, spread: 0, color: "#000000", opacity: 0.2 },
  },
});
</script>

<template>
  <div ref="wrapper" style="position: relative">
    <div ref="el" style="background: #3b82f6; padding: 32px; color: #fff">
      Card with effects
    </div>
  </div>
</template>
```

### `UseEffectsOptions`

```ts
interface UseEffectsOptions {
  wrapper?: Ref<HTMLElement | null>;
  effects?: MaybeRef<EffectsConfig>;
  autoEffects?: MaybeRef<boolean>; // Default: true
}
```

## `SmoothCorners` Component

A ready-to-use component that handles clip-path, resize observation, and effects automatically.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `as` | `keyof HTMLElementTagNameMap \| keyof SVGElementTagNameMap` | `"div"` | The HTML element tag to render |
| `asChild` | `boolean` | `false` | If `true`, clone the single default-slot child and apply SmoothCorners to it instead of rendering its own element. |
| `corners` | `SmoothCornerOptions` | -- | Corner configuration: `{ radius, smoothing?, preserveSmoothing? }` or `{ topLeft, topRight, bottomRight, bottomLeft }`. |
| `innerBorder` | `BorderConfig` | -- | Inner border effect |
| `outerBorder` | `BorderConfig` | -- | Outer border effect |
| `middleBorder` | `BorderConfig` | -- | Middle border effect (centered on shape edge) |
| `innerShadow` | `ShadowConfig \| ShadowConfig[]` | -- | Inner shadow effect (single or array) |
| `shadow` | `ShadowConfig \| ShadowConfig[]` | -- | Drop shadow effect (single or array) |
| `autoEffects` | `boolean` | `true` | Automatically extract CSS border and box-shadow as SVG effects |

All other attributes and event listeners are forwarded to the rendered element.

The component exposes `el` and `wrapper` template refs via `defineExpose`, e.g.:

```vue
<script setup>
import { ref, onMounted } from "vue";
import { SmoothCorners } from "@lisse/vue";

const card = ref(null);
onMounted(() => console.log(card.value.el)); // the inner element
</script>

<template>
  <SmoothCorners ref="card" :corners="{ radius: 16 }">Hello</SmoothCorners>
</template>
```

### Styling Hooks

The rendered (or cloned) element gets `data-slot="smooth-corners"` and `data-state="pending" | "ready"`. The state flips to `"ready"` after the first clip-path application:

```css
[data-slot="smooth-corners"][data-state="pending"] { opacity: 0; }
```

### `asChild`

Pass `asChild` with a single default-slot child to apply SmoothCorners onto that element instead of rendering a `<div>`:

```vue
<template>
  <SmoothCorners as-child :corners="{ radius: 12 }" class="shadow">
    <a href="/signup" class="cta">Sign up</a>
  </SmoothCorners>
</template>
```

Class names and other attrs merge onto the child. When using `asChild`, the `as` prop is ignored.

### Basic Usage

```vue
<script setup>
import { SmoothCorners } from "@lisse/vue";
</script>

<template>
  <SmoothCorners :corners="{ radius: 24 }" style="background: #f8fafc; padding: 32px">
    <h2>Card Title</h2>
    <p>Card content goes here.</p>
  </SmoothCorners>
</template>
```

### Custom Element

```vue
<template>
  <SmoothCorners as="section" :corners="{ radius: 16 }" class="hero">
    <h1>Hero Section</h1>
  </SmoothCorners>
</template>
```

### Per-Corner

```vue
<template>
  <SmoothCorners
    :corners="{
      topLeft: { radius: 40, smoothing: 0.8 },
      topRight: 20,
      bottomRight: 0,
      bottomLeft: 0,
    }"
    style="background: #e2e8f0; padding: 24px"
  >
    Asymmetric corners
  </SmoothCorners>
</template>
```

### All Effects

```vue
<template>
  <SmoothCorners
    :corners="{ radius: 24 }"
    :inner-border="{ width: 1, color: '#ffffff', opacity: 0.2 }"
    :outer-border="{ width: 2, color: '#000000', opacity: 0.1 }"
    :inner-shadow="{ offsetX: 0, offsetY: 2, blur: 4, spread: 0, color: '#000000', opacity: 0.15 }"
    :shadow="{ offsetX: 0, offsetY: 8, blur: 24, spread: 0, color: '#000000', opacity: 0.2 }"
    style="background: linear-gradient(135deg, #667eea, #764ba2); padding: 32px"
  >
    <p style="color: #fff">Card with all effects</p>
  </SmoothCorners>
</template>
```

### Multiple Shadows

Pass an array to `shadow` or `innerShadow` to layer multiple shadows:

```vue
<template>
  <SmoothCorners
    :corners="{ radius: 24 }"
    :shadow="[
      { offsetX: 0, offsetY: 2, blur: 4, spread: 0, color: '#000000', opacity: 0.1 },
      { offsetX: 0, offsetY: 8, blur: 24, spread: -4, color: '#000000', opacity: 0.15 },
      { offsetX: 0, offsetY: 20, blur: 48, spread: -8, color: '#000000', opacity: 0.1 },
    ]"
    style="background: #fff; padding: 32px"
  >
    Layered drop shadows
  </SmoothCorners>
</template>
```

With the composable:

```vue
<script setup>
import { ref } from "vue";
import { useSmoothCorners } from "@lisse/vue";

const wrapper = ref(null);
const el = ref(null);

useSmoothCorners(el, { radius: 24, smoothing: 0.6 }, {
  wrapper,
  effects: {
    shadow: [
      { offsetX: 0, offsetY: 2, blur: 4, spread: 0, color: "#000000", opacity: 0.1 },
      { offsetX: 0, offsetY: 12, blur: 32, spread: -4, color: "#000000", opacity: 0.2 },
    ],
  },
});
</script>

<template>
  <div ref="wrapper" style="position: relative">
    <div ref="el" style="background: #fff; padding: 32px">
      Layered shadows via composable
    </div>
  </div>
</template>
```

### Gradient Border

Pass a `GradientConfig` object as the border `color` to render a gradient border:

```vue
<template>
  <SmoothCorners
    :corners="{ radius: 24 }"
    :inner-border="{
      width: 2,
      color: {
        type: 'linear',
        angle: 135,
        stops: [
          { offset: 0, color: '#667eea' },
          { offset: 1, color: '#764ba2' },
        ],
      },
      opacity: 1,
    }"
    style="background: #fff; padding: 32px"
  >
    Gradient border
  </SmoothCorners>
</template>
```

## Auto Effects (enabled by default)

Lisse clips your element with `clip-path`, which slices through CSS `border` and `box-shadow`. Normally that means you have to remove your CSS styles and rewrite them as SVG-based effect props -- extra work that's easy to forget.

**Auto effects removes that step.** On mount, the library automatically:

1. Reads the element's computed `border` and `box-shadow`
2. Converts them to equivalent SVG effects (`innerBorder`, `shadow`, `innerShadow`)
3. Strips the CSS properties so they don't get clipped
4. Restores the original CSS on unmount (cleanup)

This is enabled by default -- existing CSS borders and shadows just work.

```vue
<!-- The CSS border is automatically converted to an SVG inner border -->
<template>
  <SmoothCorners :corners="{ radius: 24 }" style="border: 2px solid red; padding: 24px">
    Content with auto border
  </SmoothCorners>
</template>
```

### Explicit props win

If you pass effect props like `inner-border` or `shadow`, they take priority over auto-extracted values per key:

```vue
<!-- Explicit inner-border overrides the CSS border; CSS box-shadow is still auto-extracted -->
<template>
  <SmoothCorners
    :corners="{ radius: 24 }"
    style="border: 2px solid red; box-shadow: 0 4px 12px rgba(0,0,0,0.2)"
    :inner-border="{ width: 1, color: '#00ff00', opacity: 1 }"
  >
    Content
  </SmoothCorners>
</template>
```

### Disabling auto effects

With the component:

```vue
<template>
  <SmoothCorners :corners="{ radius: 24 }" :auto-effects="false">
    Content
  </SmoothCorners>
</template>
```

With the composable:

```ts
useSmoothCorners(el, { radius: 24 }, { autoEffects: false });
```

When disabled, CSS borders and shadows are left untouched and no automatic extraction occurs -- the original pre-autoEffects behavior.

### How CSS properties are mapped

| CSS property | SVG effect | Notes |
|---|---|---|
| `border` | `innerBorder` | Width, color, opacity, and style extracted from the top edge. |
| `box-shadow` (outer) | `shadow` | All outer shadows (supports multiple). |
| `box-shadow` (inset) | `innerShadow` | All inset shadows (supports multiple). |

### Limitations

**Partial CSS conversion:**

| CSS feature | What happens |
|---|---|
| Per-side borders | Only the top border is read. `getComputedStyle` returns per-side values but a squircle path has no distinct sides, so all four sides are stripped and only the top edge values are used. |
| `dashed`, `dotted`, `double`, `groove`, `ridge` | Supported. Extracted from CSS and rendered as SVG equivalents. |
| `inset`, `outset` border styles | Not replicated -- rendered as solid. These styles rely on rectangular per-side shading that has no meaningful squircle equivalent. |
| Multiple `box-shadow` layers | All shadow layers are extracted and rendered. Each outer shadow becomes a `shadow` entry and each inset shadow becomes an `innerShadow` entry. |
| `border-image` | Not detected. `getComputedStyle` does not expose `border-image` in a way that can be reliably parsed, so it may be misread as a solid border and stripped incorrectly. |
| Gradient borders (CSS) | CSS gradient borders (`border-image`) cannot be auto-extracted. Use the `innerBorder` or `outerBorder` prop with a `GradientConfig` color instead. |
| `outline` | Not read or stripped. `outline` is not clipped by `clip-path`, so it continues to render as a rectangle around the squircle. |

**Behavioral notes:**

- **One-time extraction** -- CSS is read once on mount. Use explicit effect props for dynamic values.
- **`!important` rules** -- inline style overrides can't beat `!important`. The CSS property stays visible (clipped) alongside the SVG replacement, producing doubled visuals. Move the rule to a non-`!important` selector, or use `autoEffects: false`.
- **CSS transitions** -- `border` and `box-shadow` are stripped via inline styles, so CSS transitions on those properties won't animate. Use `autoEffects: false` and drive explicit effect props from an animation system instead.
- **`double` minimum width** -- `double` borders require at least 3px `border-width` to render as double. Thinner double borders fall back to solid.
- **`groove` / `ridge` approximation** -- the dark shade is computed as `RGB × 2/3` (matching Firefox). The shading is uniform around the squircle (no per-side light direction as CSS does on rectangles), which may differ slightly from browser CSS rendering.
- **Wrapper div** -- The `SmoothCorners` component renders a wrapper `<div>` with `position: relative` when effects are active (either via explicit props or `autoEffects`). When no effects are needed, the wrapper is omitted. This can affect flex/grid layouts and CSS child selectors. Use the `useSmoothCorners` composable to avoid the wrapper.

## CSS Borders and Shadows

Lisse works by applying a CSS `clip-path` to the element. This means CSS `border`, `box-shadow`, and `outline` get clipped and will look broken at the corners. With `autoEffects` enabled (the default), CSS borders and box-shadows are automatically converted to SVG equivalents. You can also use the library's `innerBorder`, `outerBorder`, `innerShadow`, and `shadow` props directly -- these render as SVG overlays that correctly follow the squircle path.

## Effects Configuration

### `BorderConfig`

| Property | Type | Description |
|----------|------|-------------|
| `width` | `number` | Border width in pixels |
| `color` | `string \| GradientConfig` | Border color -- a hex string or a gradient configuration |
| `opacity` | `number` | Border opacity (0-1) |
| `style` | `BorderStyle` | Border style: `"solid"`, `"dashed"`, `"dotted"`, `"double"`, `"groove"`, or `"ridge"`. Default: `"solid"` |
| `dash` | `number` | Custom dash length for dashed/dotted styles |
| `gap` | `number` | Custom gap length for dashed/dotted styles |
| `lineCap` | `"butt" \| "round" \| "square"` | Line cap for dashed/dotted strokes. Default: `"butt"` for dashed, `"round"` for dotted |

### `ShadowConfig`

| Property | Type | Description |
|----------|------|-------------|
| `offsetX` | `number` | Horizontal offset in pixels |
| `offsetY` | `number` | Vertical offset in pixels |
| `blur` | `number` | Blur radius in pixels |
| `spread` | `number` | Spread distance in pixels |
| `color` | `string` | Shadow color (hex) |
| `opacity` | `number` | Shadow opacity (0-1) |

### `GradientStop`

| Property | Type | Description |
|----------|------|-------------|
| `offset` | `number` | Position within the gradient (0 to 1) |
| `color` | `string` | Stop color (hex) |
| `opacity` | `number` | Stop opacity (0-1). Default: `1` |

### `LinearGradientConfig`

| Property | Type | Description |
|----------|------|-------------|
| `type` | `"linear"` | Discriminator -- must be `"linear"` |
| `angle` | `number` | Angle in degrees (CSS convention). Default: `0` (bottom to top) |
| `stops` | `GradientStop[]` | Array of color stops |

### `RadialGradientConfig`

| Property | Type | Description |
|----------|------|-------------|
| `type` | `"radial"` | Discriminator -- must be `"radial"` |
| `cx` | `number` | Horizontal center (0-1 relative). Default: `0.5` |
| `cy` | `number` | Vertical center (0-1 relative). Default: `0.5` |
| `r` | `number` | Radius (0-1 relative). Default: `0.5` |
| `stops` | `GradientStop[]` | Array of color stops |

### `GradientConfig`

```ts
type GradientConfig = LinearGradientConfig | RadialGradientConfig;
```

A union of `LinearGradientConfig` and `RadialGradientConfig`. Pass either to `BorderConfig.color` to render a gradient border.

## SSR

The composable and component use browser APIs (`ResizeObserver`, DOM manipulation). In Nuxt or other SSR frameworks, they are safe to use in components that only render on the client. For server-side path generation, use `@lisse/core/path`:

```ts
import { generatePath } from "@lisse/core/path";
```

## License

[MIT](https://github.com/JaceThings/Lisse/blob/main/LICENSE)
