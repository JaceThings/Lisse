<div align="center">

<!-- Visual: Project logo (recommended ~150x150 PNG). Place at /assets/logo.png -->

# smooth-corners

Figma-quality squircle smoothing for the web. Generate smooth-cornered SVG paths and clip-paths with per-corner control, inner/outer borders, and shadows.

[![npm: @smooth-corners/core](https://img.shields.io/npm/v/%40smooth-corners%2Fcore?label=%40smooth-corners%2Fcore)](https://www.npmjs.com/package/@smooth-corners/core)
[![npm: @smooth-corners/react](https://img.shields.io/npm/v/%40smooth-corners%2Freact?label=%40smooth-corners%2Freact)](https://www.npmjs.com/package/@smooth-corners/react)
[![npm: @smooth-corners/vue](https://img.shields.io/npm/v/%40smooth-corners%2Fvue?label=%40smooth-corners%2Fvue)](https://www.npmjs.com/package/@smooth-corners/vue)
[![npm: @smooth-corners/svelte](https://img.shields.io/npm/v/%40smooth-corners%2Fsvelte?label=%40smooth-corners%2Fsvelte)](https://www.npmjs.com/package/@smooth-corners/svelte)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/JaceThings/smooth-corners/ci.yml?branch=main&label=CI)](https://github.com/JaceThings/smooth-corners/actions)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](https://www.typescriptlang.org/)
[![Bundle size](https://img.shields.io/bundlephobia/minzip/%40smooth-corners%2Fcore)](https://bundlephobia.com/package/@smooth-corners/core)

</div>

<!-- Visual: Hero image - side-by-side comparison of standard CSS border-radius vs smooth-corners squircle applied to a card. Show the difference clearly. Recommended ~800px wide. Place at /assets/hero.png -->

## What is this?

Standard CSS `border-radius` produces circular arcs at the corners of an element. Designers (and Apple, and Figma) prefer **squircles** -- corners where the curvature transitions smoothly into the straight edges, creating a more organic, polished shape.

smooth-corners implements [Figma's corner smoothing algorithm](https://www.figma.com/blog/desperately-seeking-squircles/) in JavaScript. It generates SVG paths and CSS `clip-path` values that you can apply to any element, with first-class bindings for React, Vue, and Svelte.

## Features

- Pixel-perfect reproduction of Figma's squircle algorithm
- Per-corner radius and smoothing control
- Built-in effects: inner border, outer border, inner shadow, drop shadow
- Framework bindings for React, Vue, and Svelte
- Lightweight core with zero dependencies
- DOM-free `/path` subpath export for SSR and edge runtimes
- TypeScript-first with full type coverage
- Auto-updates on element resize via shared `ResizeObserver`
- Tree-shakeable ESM and CJS builds

## Which API Should I Use?

Each framework binding offers two ways to apply smooth corners:

| | Component | Hook / Composable / Action |
|---|---|---|
| **What it does** | Renders its own element with smooth corners applied | Applies smooth corners to an existing element you already have |
| **When to use** | Building new UI from scratch, or when you want a drop-in replacement for a `<div>` | You already have an element and want to add smooth corners without changing your DOM structure |
| **Effects** | Handled automatically (wrapper div is created for you) | You manage the wrapper element yourself (React/Vue) or ensure the parent has `position: relative` (Svelte) |

If you are starting fresh, the component is simpler. If you are adding smooth corners to existing elements, use the hook/composable/action.

## Quick Start

### React

```sh
npm install @smooth-corners/react
```

**Component:**

```tsx
import { SmoothCorners } from "@smooth-corners/react";

function Card() {
  return (
    <SmoothCorners radius={20} smoothing={0.6} style={{ background: "#fff", padding: 24 }}>
      <h2>Hello, squircle</h2>
    </SmoothCorners>
  );
}
```

**Hook:**

```tsx
import { useRef } from "react";
import { useSmoothCorners } from "@smooth-corners/react";

function Card() {
  const ref = useRef<HTMLDivElement>(null);
  useSmoothCorners(ref, { radius: 20, smoothing: 0.6 });
  return <div ref={ref} style={{ background: "#fff", padding: 24 }}>Hello</div>;
}
```

### Vue

```sh
npm install @smooth-corners/vue
```

**Composable:**

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

**Component:**

```vue
<script setup>
import { SmoothCorners } from "@smooth-corners/vue";
</script>

<template>
  <SmoothCorners :radius="20" :smoothing="0.6" style="background: #fff; padding: 24px">
    <h2>Hello, squircle</h2>
  </SmoothCorners>
</template>
```

### Svelte

```sh
npm install @smooth-corners/svelte
```

```svelte
<script>
  import { smoothCorners } from "@smooth-corners/svelte";
</script>

<div use:smoothCorners={{ radius: 20, smoothing: 0.6 }} style="background: #fff; padding: 24px">
  Hello, squircle
</div>
```

### Vanilla JS / Core

```sh
npm install @smooth-corners/core
```

```ts
import { generatePath, generateClipPath } from "@smooth-corners/core";

const path = generatePath(200, 200, { radius: 40, smoothing: 0.6 });
// Use in an <svg> element: <path d={path} />

const clipPath = generateClipPath(200, 200, { radius: 40 });
element.style.clipPath = clipPath;
```

<!-- Visual: Grid of 4 cards showing the library used in React, Vue, Svelte, and vanilla JS. Each card has the smooth-corners effect applied. Place at /assets/framework-examples.png -->

## Per-Corner Configuration

Every binding accepts per-corner overrides. Each corner can be a number (radius only, using default smoothing) or a full `CornerConfig` object:

```ts
const options = {
  topLeft: { radius: 40, smoothing: 0.8 },
  topRight: 20,
  bottomRight: { radius: 30, smoothing: 0.4, preserveSmoothing: false },
  bottomLeft: 0,
};
```

When adjacent corners compete for space, larger radii are given priority and smaller corners are reduced proportionally.

<!-- Visual: Single squircle with different radius values per corner, annotated with the radius value at each corner. Place at /assets/per-corner.png -->

## Effects

### Auto Effects (enabled by default)

smooth-corners clips your element with `clip-path`, which slices through CSS `border` and `box-shadow`. Normally that means you have to remove your CSS styles and rewrite them as the library's SVG-based effect props -- extra work that's easy to forget.

**Auto effects removes that step.** On mount, the library automatically:

1. Reads the element's computed `border` and `box-shadow`
2. Converts them to equivalent SVG effects (`innerBorder`, `shadow`, `innerShadow`)
3. Strips the CSS properties so they don't get clipped
4. Restores the original CSS on unmount

This is enabled by default -- elements with existing CSS borders and shadows just work.

```tsx
{/* CSS border is automatically converted to an SVG inner border */}
<SmoothCorners radius={24} style={{ border: "2px solid red" }}>
  Content
</SmoothCorners>
```

If you pass explicit effect props, they take priority over auto-extracted values:

```tsx
{/* Explicit innerBorder wins over the CSS border */}
<SmoothCorners
  radius={24}
  style={{ border: "2px solid red" }}
  innerBorder={{ width: 1, color: "#00ff00", opacity: 1 }}
>
  Content
</SmoothCorners>
```

#### Disabling auto effects

Pass `autoEffects={false}` (React), `:auto-effects="false"` (Vue), or `autoEffects: false` (Svelte config mode). When disabled, CSS borders and shadows are left untouched and no automatic extraction occurs -- the original pre-autoEffects behavior.

#### How CSS properties are mapped

| CSS property | SVG effect | Notes |
|---|---|---|
| `border` | `innerBorder` | Width, color, and opacity are extracted from the top edge. Only `solid` borders are supported. |
| `box-shadow` (outer) | `shadow` | First outer shadow only. |
| `box-shadow` (inset) | `innerShadow` | First inset shadow only. |

#### Limitations

- **Uniform borders only** -- reads the top border (`borderTopWidth`, `borderTopColor`, `borderTopStyle`) and applies it as a uniform SVG stroke. All four CSS border sides are stripped regardless -- sides that differ from the top are lost, not preserved.
- **Solid borders only** -- `dashed`, `dotted`, `double`, `groove`, `ridge` etc. are not replicated as SVG effects. The CSS is still stripped, so the element won't have a visible border.
- **First shadow only** -- if you have multiple `box-shadow` layers, only the first outer and first inset are extracted. All shadow layers are stripped from the element, so additional layers beyond the first outer and first inset disappear entirely.
- **No `outline` support** -- CSS `outline` is not read or stripped.
- **One-time extraction** -- auto effects reads CSS once on mount. If border or shadow styles change dynamically after mount, the SVG effects won't update to match. Use explicit effect props for dynamic values.
- **`!important` rules** -- if a stylesheet sets `border` or `box-shadow` with `!important`, the inline style override cannot take precedence. The CSS property remains visible, gets clipped by the squircle path, and the SVG replacement also renders, producing doubled or broken visuals. Move the rule to a non-`!important` selector, or use `autoEffects: false` with explicit effect props.
- **CSS transitions** -- auto effects strips `border` and `box-shadow` via inline styles on mount. CSS transitions targeting these properties (e.g. `transition: border 0.3s`) will not animate while auto effects is active. To animate effects, use `autoEffects: false` and drive explicit effect props from state or an animation system.
- **No `border-image`** -- `border-image` is not detected or handled. If present, the border may be misread (the computed `borderTopStyle` may still report `solid`) and stripped, resulting in incorrect SVG effects.
- **Wrapper div (React/Vue component only)** -- the `<SmoothCorners>` component injects a wrapper `<div>` for SVG overlay positioning. This can affect CSS child selectors and flex/grid layouts. Use the hook or composable API to avoid the wrapper.

### CSS properties and clip-path

smooth-corners works by applying a CSS `clip-path` to your element. This clips the element's entire visual box -- including any CSS `border`, `box-shadow`, or `outline` you have set. With `autoEffects` enabled (the default), CSS borders and box-shadows are automatically converted to SVG equivalents. You can also use the library's built-in effect props directly.

All framework bindings support four built-in effects that are rendered as SVG overlays:

| Effect | Description |
|--------|-------------|
| `innerBorder` | A border drawn inside the squircle path |
| `outerBorder` | A border drawn outside the squircle path |
| `innerShadow` | An inset shadow inside the squircle |
| `shadow` | A drop shadow behind the squircle |

```tsx
<SmoothCorners
  radius={24}
  innerBorder={{ width: 1, color: "#ffffff", opacity: 0.2 }}
  outerBorder={{ width: 2, color: "#000000", opacity: 0.1 }}
  innerShadow={{ offsetX: 0, offsetY: 2, blur: 4, spread: 0, color: "#000000", opacity: 0.15 }}
  shadow={{ offsetX: 0, offsetY: 8, blur: 24, spread: 0, color: "#000000", opacity: 0.2 }}
  style={{ background: "linear-gradient(135deg, #667eea, #764ba2)", padding: 32 }}
>
  <p style={{ color: "#fff" }}>Card with all effects</p>
</SmoothCorners>
```

<!-- Visual: 2x2 grid showing each effect type: inner border, outer border, inner shadow, drop shadow. Each on a squircle card. Place at /assets/effects-grid.png -->

## SSR / Path-Only Import

The core package provides a `/path` subpath export that excludes all DOM-dependent code. Use it in server-side rendering, Node.js scripts, or edge runtimes:

```ts
// DOM-free import - safe for SSR, Node.js, edge runtimes
import { generatePath } from "@smooth-corners/core/path";
```

The `/path` export includes `generatePath`, `generateClipPath`, `getPathParamsForCorner`, `distributeAndNormalize`, `getSVGPathFromPathParams`, `toRadians`, `rounded`, `nextUid`, `hexToRgb`, `SVG_NS`, and `DEFAULT_SHADOW`. It excludes `createSvgEffects`, `createDropShadow`, and `observeResize`.

## Packages

| Package | Description | Docs |
|---------|-------------|------|
| [`@smooth-corners/core`](https://www.npmjs.com/package/@smooth-corners/core) | Framework-agnostic path generation and effects | [README](./packages/core/README.md) |
| [`@smooth-corners/react`](https://www.npmjs.com/package/@smooth-corners/react) | React hook and component | [README](./packages/react/README.md) |
| [`@smooth-corners/vue`](https://www.npmjs.com/package/@smooth-corners/vue) | Vue composable and component | [README](./packages/vue/README.md) |
| [`@smooth-corners/svelte`](https://www.npmjs.com/package/@smooth-corners/svelte) | Svelte action | [README](./packages/svelte/README.md) |

## How It Works

The algorithm is based on [Figma's blog post on squircles](https://www.figma.com/blog/desperately-seeking-squircles/) and produces the same smooth corners you see in Figma's design tool.

A standard `border-radius` arc is a quarter circle -- the curvature jumps abruptly from zero (along the straight edge) to a fixed value (along the arc). A squircle uses a series of bezier curves that ease into and out of the corner, distributing curvature smoothly across a longer segment of the edge.

The `smoothing` parameter (0 to 1) controls how far the curvature extends along the edges. At `smoothing: 0` the output is identical to a standard `border-radius`. At `smoothing: 1` the curvature occupies the maximum possible edge length.

When `preserveSmoothing` is `true` (the default), the algorithm maintains the requested smoothing value even if it means reducing the effective corner radius. When `false`, the radius is preserved and smoothing is reduced to fit.

<!-- Visual: Diagram showing a smooth corner's bezier control points (a, b, c, d, p) versus a standard circular arc. Reference Figma's blog post illustration style. Place at /assets/corner-anatomy.png -->

## API Reference

| Function / Export | Package | Description |
|-------------------|---------|-------------|
| `generatePath(width, height, options)` | `core` | Generate an SVG path `d` string |
| `generateClipPath(width, height, options)` | `core` | Generate a CSS `clip-path: path(...)` string |
| `getPathParamsForCorner(params)` | `core` | Compute bezier control points for a single corner |
| `distributeAndNormalize(rect)` | `core` | Distribute radii across a rectangle, resolving overlaps |
| `getSVGPathFromPathParams(input)` | `core` | Assemble a full SVG path from corner parameters |
| `createSvgEffects(anchor)` | `core` | Create an SVG overlay for borders and inner shadows |
| `createDropShadow(anchor)` | `core` | Create a path-based drop shadow |
| `extractAndStripEffects(el)` | `core` | Extract CSS border/shadow and convert to SVG effects |
| `restoreStyles(el, saved)` | `core` | Restore stripped CSS border/shadow styles |
| `observeResize(el, callback)` | `core` | Observe element resize with a shared `ResizeObserver` |
| `useSmoothCorners(ref, options, effects?)` | `react` | React hook for applying smooth corners |
| `SmoothCorners` | `react` | React component with built-in effects |
| `useSmoothCorners(target, options, effects?)` | `vue` | Vue composable for applying smooth corners |
| `SmoothCorners` | `vue` | Vue component with built-in effects |
| `smoothCorners(node, input)` | `svelte` | Svelte action for applying smooth corners |

See individual package READMEs for full API details.

## License

[MIT](./LICENSE)

---

<div align="center">

Built by [Jace](https://ja.mt)

[X](https://ja.mt/x) | [Bluesky](https://ja.mt/bsky) | [Instagram](https://ja.mt/ig) | [Threads](https://ja.mt/threads)

</div>
