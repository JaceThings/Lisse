# @smooth-corners/react

React hook and component for smooth-cornered (squircle) elements, powered by [Figma's smoothing algorithm](https://www.figma.com/blog/desperately-seeking-squircles/).

[![npm](https://img.shields.io/npm/v/%40smooth-corners%2Freact)](https://www.npmjs.com/package/@smooth-corners/react)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE)

## Installation

```sh
npm install @smooth-corners/react
```

**Peer dependency:** `react >= 18.0.0`

## Which API Should I Use?

- **`SmoothCorners` component** -- Renders its own element with smooth corners applied. Handles effects and wrapper creation automatically. Use this when building new UI or when you want a drop-in replacement for a `<div>`.
- **`useSmoothCorners` hook** -- Applies smooth corners to an existing element via a ref. Use this when you already have an element and don't want to change your DOM structure.

## Quick Start

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

## `useSmoothCorners` Hook

Apply smooth corners to any element via a ref.

### Signature

```ts
function useSmoothCorners(
  ref: React.RefObject<HTMLElement | null>,
  options: SmoothCornerOptions,
  effectsOptions?: UseEffectsOptions,
): void;
```

### Basic Usage

```tsx
import { useRef } from "react";
import { useSmoothCorners } from "@smooth-corners/react";

function Card() {
  const ref = useRef<HTMLDivElement>(null);
  useSmoothCorners(ref, { radius: 20, smoothing: 0.6 });
  return <div ref={ref} style={{ background: "#fff", padding: 24 }}>Hello</div>;
}
```

### Per-Corner Configuration

```tsx
import { useRef } from "react";
import { useSmoothCorners } from "@smooth-corners/react";

function Card() {
  const ref = useRef<HTMLDivElement>(null);
  useSmoothCorners(ref, {
    topLeft: { radius: 32, smoothing: 0.8 },
    topRight: 16,
    bottomRight: 0,
    bottomLeft: { radius: 24, smoothing: 0.4, preserveSmoothing: false },
  });
  return <div ref={ref} style={{ background: "#f0f0f0", padding: 24 }}>Mixed corners</div>;
}
```

### With Effects

When using effects with the hook, you need to provide a wrapper ref for the SVG overlay:

```tsx
import { useRef } from "react";
import { useSmoothCorners } from "@smooth-corners/react";

function Card() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLDivElement>(null);

  useSmoothCorners(ref, { radius: 24, smoothing: 0.6 }, {
    wrapperRef,
    effects: {
      innerBorder: { width: 1, color: "#ffffff", opacity: 0.2 },
      shadow: { offsetX: 0, offsetY: 8, blur: 24, spread: 0, color: "#000000", opacity: 0.2 },
    },
  });

  return (
    <div ref={wrapperRef} style={{ position: "relative" }}>
      <div ref={ref} style={{ background: "#3b82f6", padding: 32, color: "#fff" }}>
        Card with effects
      </div>
    </div>
  );
}
```

### `UseEffectsOptions`

```ts
interface UseEffectsOptions {
  wrapperRef?: React.RefObject<HTMLElement | null>;
  effects?: EffectsConfig;
  autoEffects?: boolean; // Default: true
}
```

## `SmoothCorners` Component

A ready-to-use component that handles clip-path, resize observation, ref forwarding, and effects automatically.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `as` | `React.ElementType` | `"div"` | The HTML element or component to render |
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

All standard HTML attributes (e.g. `className`, `style`, `onClick`) are forwarded to the rendered element.

### Basic Usage

```tsx
import { SmoothCorners } from "@smooth-corners/react";

function Card() {
  return (
    <SmoothCorners radius={24} style={{ background: "#f8fafc", padding: 32 }}>
      <h2>Card Title</h2>
      <p>Card content goes here.</p>
    </SmoothCorners>
  );
}
```

### Custom Element

```tsx
<SmoothCorners as="section" radius={16} className="hero">
  <h1>Hero Section</h1>
</SmoothCorners>
```

### Per-Corner

```tsx
<SmoothCorners
  topLeft={{ radius: 40, smoothing: 0.8 }}
  topRight={20}
  bottomRight={0}
  bottomLeft={0}
  style={{ background: "#e2e8f0", padding: 24 }}
>
  Asymmetric corners
</SmoothCorners>
```

### All Effects

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

### Ref Forwarding

The component forwards refs to the underlying element:

```tsx
import { useRef } from "react";
import { SmoothCorners } from "@smooth-corners/react";

function Card() {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <SmoothCorners ref={ref} radius={20} style={{ background: "#fff", padding: 24 }}>
      Content
    </SmoothCorners>
  );
}
```

## Auto Effects (enabled by default)

smooth-corners clips your element with `clip-path`, which slices through CSS `border` and `box-shadow`. Normally that means you have to remove your CSS styles and rewrite them as SVG-based effect props -- extra work that's easy to forget.

**Auto effects removes that step.** On mount, the library automatically:

1. Reads the element's computed `border` and `box-shadow`
2. Converts them to equivalent SVG effects (`innerBorder`, `shadow`, `innerShadow`)
3. Strips the CSS properties so they don't get clipped
4. Restores the original CSS on unmount (cleanup)

This is enabled by default -- existing CSS borders and shadows just work.

```tsx
{/* The CSS border is automatically converted to an SVG inner border */}
<SmoothCorners radius={24} style={{ border: "2px solid red", padding: 24 }}>
  Content with auto border
</SmoothCorners>
```

### Explicit props win

If you pass effect props like `innerBorder` or `shadow`, they take priority over auto-extracted values per key:

```tsx
{/* Explicit innerBorder overrides the CSS border; CSS box-shadow is still auto-extracted */}
<SmoothCorners
  radius={24}
  style={{ border: "2px solid red", boxShadow: "0 4px 12px rgba(0,0,0,0.2)" }}
  innerBorder={{ width: 1, color: "#00ff00", opacity: 1 }}
>
  Content
</SmoothCorners>
```

### Disabling auto effects

With the component:

```tsx
<SmoothCorners radius={24} autoEffects={false}>
  Content
</SmoothCorners>
```

With the hook:

```tsx
useSmoothCorners(ref, { radius: 24 }, { autoEffects: false });
```

When disabled, CSS borders and shadows are left untouched and no automatic extraction occurs -- the original pre-autoEffects behavior.

### How CSS properties are mapped

| CSS property | SVG effect | Notes |
|---|---|---|
| `border` | `innerBorder` | Width, color, and opacity extracted from the top edge. Only `solid` borders. |
| `box-shadow` (outer) | `shadow` | First outer shadow only. |
| `box-shadow` (inset) | `innerShadow` | First inset shadow only. |

### Limitations

- **Uniform borders only** -- reads the top border and applies it uniformly. Mixed per-side borders use the top-edge values.
- **Solid borders only** -- `dashed`, `dotted`, `double`, etc. are not replicated. The CSS is still stripped.
- **First shadow only** -- multiple `box-shadow` layers: only the first outer and first inset are extracted. The rest are dropped.
- **No `outline`** -- CSS `outline` is not read or stripped.
- **One-time extraction** -- reads CSS once on mount. Dynamically changing border/shadow styles after mount won't update the SVG effects. Use explicit effect props for dynamic values.

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

## Server Components

The `SmoothCorners` component and `useSmoothCorners` hook use browser APIs (`ResizeObserver`, DOM manipulation). In Next.js App Router or other RSC environments, use them in Client Components:

```tsx
"use client";

import { SmoothCorners } from "@smooth-corners/react";

export function Card() {
  return (
    <SmoothCorners radius={20} style={{ background: "#fff", padding: 24 }}>
      Client-side squircle
    </SmoothCorners>
  );
}
```

For server-side path generation, use `@smooth-corners/core/path` instead.

## License

[MIT](../../LICENSE)
