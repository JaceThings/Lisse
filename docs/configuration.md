# Configuration

## Which API to use

Each framework binding offers two ways to apply smooth corners.

|  | Component | Hook / Composable / Action |
|---|---|---|
| **What it does** | Renders its own element with smooth corners applied | Applies smooth corners to an existing element you already have |
| **When to use** | Building new UI from scratch, or when you want a drop-in replacement for a `<div>` | You already have an element and want to add smooth corners without changing your DOM structure |
| **Effects** | Handled automatically (wrapper div is created for you) | You manage the wrapper element yourself (React/Vue) or ensure the parent has `position: relative` (Svelte) |

If you're starting fresh, the component is simpler. If you're adding smooth corners to existing elements, use the hook/composable/action.

## Per-corner configuration

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

## Smoothing presets

Default smoothing is `0.65` (`APPLE_SMOOTHING`) — the closest match to Apple's continuous corners on the Figma curve. Figma's labeled "iOS" preset is `0.6` (`FIGMA_SMOOTHING`):

```ts
import { APPLE_SMOOTHING, FIGMA_SMOOTHING } from "@lisse/core";

generatePath(200, 200, { radius: 24 }); // default = Apple
generatePath(200, 200, { radius: 24, smoothing: FIGMA_SMOOTHING }); // Figma handoff
```

## Vue

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

Component form:

```vue
<script setup>
import { SmoothCorners } from "@lisse/vue";
</script>

<template>
  <SmoothCorners :corners="{ radius: 20, smoothing: 0.6 }" style="background: #fff; padding: 24px">
    <h2>Hello, squircle</h2>
  </SmoothCorners>
</template>
```

`SmoothCorners` accepts an `asChild` boolean that clones the single default slot child instead of rendering its own element. Template refs (`ref="x"`) on `<SmoothCorners>` expose `{ el, wrapper }`.

## Svelte

```svelte
<script>
  import { smoothCorners } from "@lisse/svelte";
</script>

<div use:smoothCorners={{ corners: { radius: 20, smoothing: 0.6 } }} style="background: #fff; padding: 24px">
  Hello, squircle
</div>
```

## Vanilla / `@lisse/core`

```ts
import { generatePath, generateClipPath } from "@lisse/core";

const path = generatePath(200, 200, { radius: 40, smoothing: 0.6 });
// Use in an <svg> element: <path d={path} />

const clipPath = generateClipPath(200, 200, { radius: 40 });
element.style.clipPath = clipPath;
```

## Polymorphic React `as` and `asChild`

```tsx
// Render any HTML element (attributes are typed against `as`).
<SmoothCorners as="a" href="/x" corners={{ radius: 12 }}>Link</SmoothCorners>

// Or merge SmoothCorners onto your own element / component without extra wrappers.
<SmoothCorners asChild corners={{ radius: 12 }}>
  <MyButton onClick={handle}>Click</MyButton>
</SmoothCorners>
```
