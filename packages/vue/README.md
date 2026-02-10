# @smooth-corners/vue

Vue composable and component for smooth-cornered (squircle) elements, powered by [Figma's smoothing algorithm](https://www.figma.com/blog/desperately-seeking-squircles/).

[![npm](https://img.shields.io/npm/v/%40smooth-corners%2Fvue)](https://www.npmjs.com/package/@smooth-corners/vue)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE)

## Installation

```sh
npm install @smooth-corners/vue
```

**Peer dependency:** `vue >= 3.3.0`

## Which API Should I Use?

- **`SmoothCorners` component** -- Renders its own element with smooth corners applied. Handles effects and wrapper creation automatically. Use this when building new UI or when you want a drop-in replacement for a `<div>`.
- **`useSmoothCorners` composable** -- Applies smooth corners to an existing element via a template ref. Use this when you already have an element and don't want to change your DOM structure.

## Quick Start

```vue
<script setup>
import { ref } from "vue";
import { useSmoothCorners } from "@smooth-corners/vue";

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
import { useSmoothCorners } from "@smooth-corners/vue";

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
import { useSmoothCorners } from "@smooth-corners/vue";

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
import { useSmoothCorners } from "@smooth-corners/vue";

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
import { useSmoothCorners } from "@smooth-corners/vue";

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
| `as` | `string` | `"div"` | The HTML element tag to render |
| `radius` | `number` | -- | Uniform corner radius (use this or per-corner props) |
| `smoothing` | `number` | `0.6` | Corner smoothing factor (0-1) |
| `preserveSmoothing` | `boolean` | `true` | Preserve smoothing at the cost of radius when space is limited |
| `topLeft` | `number \| CornerConfig` | -- | Top-left corner override |
| `topRight` | `number \| CornerConfig` | -- | Top-right corner override |
| `bottomRight` | `number \| CornerConfig` | -- | Bottom-right corner override |
| `bottomLeft` | `number \| CornerConfig` | -- | Bottom-left corner override |
| `innerBorder` | `BorderConfig` | -- | Inner border effect |
| `outerBorder` | `BorderConfig` | -- | Outer border effect |
| `innerShadow` | `ShadowConfig` | -- | Inner shadow effect |
| `shadow` | `ShadowConfig` | -- | Drop shadow effect |
| `autoEffects` | `boolean` | `true` | Automatically extract CSS border and box-shadow as SVG effects |

All other attributes and event listeners are forwarded to the rendered element.

### Basic Usage

```vue
<script setup>
import { SmoothCorners } from "@smooth-corners/vue";
</script>

<template>
  <SmoothCorners :radius="24" style="background: #f8fafc; padding: 32px">
    <h2>Card Title</h2>
    <p>Card content goes here.</p>
  </SmoothCorners>
</template>
```

### Custom Element

```vue
<template>
  <SmoothCorners as="section" :radius="16" class="hero">
    <h1>Hero Section</h1>
  </SmoothCorners>
</template>
```

### Per-Corner

```vue
<template>
  <SmoothCorners
    :top-left="{ radius: 40, smoothing: 0.8 }"
    :top-right="20"
    :bottom-right="0"
    :bottom-left="0"
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
    :radius="24"
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

## Auto Effects (enabled by default)

smooth-corners clips your element with `clip-path`, which slices through CSS `border` and `box-shadow`. Normally that means you have to remove your CSS styles and rewrite them as SVG-based effect props -- extra work that's easy to forget.

**Auto effects removes that step.** On mount, the library automatically:

1. Reads the element's computed `border` and `box-shadow`
2. Converts them to equivalent SVG effects (`innerBorder`, `shadow`, `innerShadow`)
3. Strips the CSS properties so they don't get clipped
4. Restores the original CSS on unmount (cleanup)

This is enabled by default -- existing CSS borders and shadows just work.

```vue
<!-- The CSS border is automatically converted to an SVG inner border -->
<template>
  <SmoothCorners :radius="24" style="border: 2px solid red; padding: 24px">
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
    :radius="24"
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
  <SmoothCorners :radius="24" :auto-effects="false">
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
| `border` | `innerBorder` | Width, color, and opacity extracted from the top edge. Only `solid` borders. |
| `box-shadow` (outer) | `shadow` | First outer shadow only. |
| `box-shadow` (inset) | `innerShadow` | First inset shadow only. |

### Limitations

- **Uniform borders only** -- reads the top border (`borderTopWidth`, `borderTopColor`, `borderTopStyle`) and applies it as a uniform SVG stroke. All four CSS border sides are stripped regardless -- sides that differ from the top are lost, not preserved.
- **Solid borders only** -- `dashed`, `dotted`, `double`, etc. are not replicated. The CSS is still stripped.
- **First shadow only** -- if you have multiple `box-shadow` layers, only the first outer and first inset are extracted. All shadow layers are stripped from the element, so additional layers beyond the first outer and first inset disappear entirely.
- **No `outline`** -- CSS `outline` is not read or stripped.
- **One-time extraction** -- reads CSS once on mount. Dynamically changing border/shadow styles after mount won't update the SVG effects. Use explicit effect props for dynamic values.
- **`!important` rules** -- if a stylesheet sets `border` or `box-shadow` with `!important`, the inline style override cannot take precedence. The CSS property remains visible, gets clipped by the squircle path, and the SVG replacement also renders, producing doubled or broken visuals. Move the rule to a non-`!important` selector, or use `autoEffects: false` with explicit effect props.
- **CSS transitions** -- auto effects strips `border` and `box-shadow` via inline styles on mount. CSS transitions targeting these properties (e.g. `transition: border 0.3s`) will not animate while auto effects is active. To animate effects, use `autoEffects: false` and drive explicit effect props from state or an animation system.
- **No `border-image`** -- `border-image` is not detected or handled. If present, the border may be misread (the computed `borderTopStyle` may still report `solid`) and stripped, resulting in incorrect SVG effects.
- **Wrapper div** -- the `<SmoothCorners>` component injects a wrapper `<div style="position:relative">` around the element when auto effects is enabled (the default) or when explicit effect props are provided. This extra DOM node can break CSS child selectors (`>`), flex/grid item sizing, and pseudo-selectors like `:first-child`. To avoid the wrapper, use the `useSmoothCorners` composable directly and manage the parent positioning yourself, or pass `autoEffects={false}` when no effects are needed.

## CSS Borders and Shadows

smooth-corners works by applying a CSS `clip-path` to the element. This means CSS `border`, `box-shadow`, and `outline` get clipped and will look broken at the corners. With `autoEffects` enabled (the default), CSS borders and box-shadows are automatically converted to SVG equivalents. You can also use the library's `innerBorder`, `outerBorder`, `innerShadow`, and `shadow` props directly -- these render as SVG overlays that correctly follow the squircle path.

## Effects Configuration

### `BorderConfig`

| Property | Type | Description |
|----------|------|-------------|
| `width` | `number` | Border width in pixels |
| `color` | `string` | Border color (hex) |
| `opacity` | `number` | Border opacity (0-1) |

### `ShadowConfig`

| Property | Type | Description |
|----------|------|-------------|
| `offsetX` | `number` | Horizontal offset in pixels |
| `offsetY` | `number` | Vertical offset in pixels |
| `blur` | `number` | Blur radius in pixels |
| `spread` | `number` | Spread distance in pixels |
| `color` | `string` | Shadow color (hex) |
| `opacity` | `number` | Shadow opacity (0-1) |

## SSR

The composable and component use browser APIs (`ResizeObserver`, DOM manipulation). In Nuxt or other SSR frameworks, they are safe to use in components that only render on the client. For server-side path generation, use `@smooth-corners/core/path`:

```ts
import { generatePath } from "@smooth-corners/core/path";
```

## License

[MIT](../../LICENSE)
