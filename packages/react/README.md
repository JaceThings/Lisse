# @lisse/react

React hook and component for smooth-cornered (squircle) elements, powered by [Figma's smoothing algorithm](https://www.figma.com/blog/desperately-seeking-squircles/).

[![npm](https://img.shields.io/npm/v/%40lisse%2Freact)](https://www.npmjs.com/package/@lisse/react)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/JaceThings/Lisse/blob/main/LICENSE)

## Installation

```sh
npm install @lisse/react
```

**Peer dependency:** `react >= 18.0.0`

## Which API Should I Use?

- **`SmoothCorners` component** -- Renders its own element with smooth corners applied. Handles effects and wrapper creation automatically. Use this when building new UI or when you want a drop-in replacement for a `<div>`.
- **`useSmoothCorners` hook** -- Applies smooth corners to an existing element via a ref. Use this when you already have an element and don't want to change your DOM structure.

## Quick Start

```tsx
import { SmoothCorners } from "@lisse/react";

function Card() {
  return (
    <SmoothCorners corners={{ radius: 20, smoothing: 0.6 }} style={{ background: "#fff", padding: 24 }}>
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
import { useSmoothCorners } from "@lisse/react";

function Card() {
  const ref = useRef<HTMLDivElement>(null);
  useSmoothCorners(ref, { radius: 20, smoothing: 0.6 });
  return <div ref={ref} style={{ background: "#fff", padding: 24 }}>Hello</div>;
}
```

### Per-Corner Configuration

```tsx
import { useRef } from "react";
import { useSmoothCorners } from "@lisse/react";

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
import { useSmoothCorners } from "@lisse/react";

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
| `as` | `React.ElementType` | `"div"` | The HTML element or component to render. Other props are typed against this element. |
| `asChild` | `boolean` | `false` | If `true`, clone the single child element and merge SmoothCorners onto it instead of rendering its own element. Mutually exclusive with `as`. |
| `corners` | `SmoothCornerOptions` | -- | Corner configuration: uniform `{ radius, smoothing, preserveSmoothing? }` or per-corner `{ topLeft, topRight, bottomRight, bottomLeft }`. Each corner is a number or `CornerConfig`. |
| `innerBorder` | `BorderConfig` | -- | Inner border effect |
| `outerBorder` | `BorderConfig` | -- | Outer border effect |
| `middleBorder` | `BorderConfig` | -- | Middle border effect (centred on shape edge) |
| `innerShadow` | `ShadowConfig \| ShadowConfig[]` | -- | Inner shadow effect (single or multiple) |
| `shadow` | `ShadowConfig \| ShadowConfig[]` | -- | Drop shadow effect (single or multiple) |
| `autoEffects` | `boolean` | `true` | Automatically extract CSS border and box-shadow as SVG effects |

All other HTML attributes (e.g. `className`, `style`, `onClick`, `href` when `as="a"`) are forwarded to the rendered element and typed against the chosen element.

### Styling Hooks

The rendered (or cloned) element gets `data-slot="smooth-corners"` and `data-state="pending" | "ready"` attributes. The `data-state` flips to `"ready"` after the first successful clip-path application — useful for masking the first paint:

```css
[data-slot="smooth-corners"][data-state="pending"] { opacity: 0; }
[data-slot="smooth-corners"][data-state="ready"]   { opacity: 1; transition: opacity 100ms; }
```

### `asChild`

When you don't want SmoothCorners to render its own element, pass `asChild` and a single child:

```tsx
import { SmoothCorners } from "@lisse/react";

function Cta({ children }: { children: React.ReactNode }) {
  return (
    <SmoothCorners asChild corners={{ radius: 12 }} className="shadow">
      <a href="/signup" className="cta">{children}</a>
    </SmoothCorners>
  );
}
```

The child receives the internal ref. Class names merge (parent first, child second). Event handlers compose (child handler runs first, then parent's). When using `asChild`, the `as` prop is ignored.

#### Standalone `Slot`

`Slot` is exported for advanced composition. It is generic over the element type it will merge onto, so you can opt into element-specific attributes by passing a type parameter:

```tsx
import { Slot } from "@lisse/react";

<Slot<"a"> href="/x" className="underline">
  <a>link</a>
</Slot>;

<Slot<"button"> type="submit" onClick={handleClick}>
  <button>submit</button>
</Slot>;
```

Without a type parameter, `Slot` accepts the common `HTMLAttributes<HTMLElement>` surface via the `SlotProps` type. Use `SlotPropsFor<E>` (re-exported alongside `SlotProps`) to compose element-specific shapes yourself.

At runtime every prop is forwarded to the cloned child regardless of type. The generic parameter is a type-level hint only.

### Basic Usage

```tsx
import { SmoothCorners } from "@lisse/react";

function Card() {
  return (
    <SmoothCorners corners={{ radius: 24 }} style={{ background: "#f8fafc", padding: 32 }}>
      <h2>Card Title</h2>
      <p>Card content goes here.</p>
    </SmoothCorners>
  );
}
```

### Custom Element

```tsx
<SmoothCorners as="section" corners={{ radius: 16 }} className="hero">
  <h1>Hero Section</h1>
</SmoothCorners>

{/* Element-specific attributes are typed against `as` */}
<SmoothCorners as="a" href="/signup" corners={{ radius: 12 }}>
  Sign up
</SmoothCorners>
```

### Per-Corner

```tsx
<SmoothCorners
  corners={{
    topLeft: { radius: 40, smoothing: 0.8 },
    topRight: 20,
    bottomRight: 0,
    bottomLeft: 0,
  }}
  style={{ background: "#e2e8f0", padding: 24 }}
>
  Asymmetric corners
</SmoothCorners>
```

### All Effects

```tsx
<SmoothCorners
  corners={{ radius: 24 }}
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
import { SmoothCorners } from "@lisse/react";

function Card() {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <SmoothCorners ref={ref} corners={{ radius: 20 }} style={{ background: "#fff", padding: 24 }}>
      Content
    </SmoothCorners>
  );
}
```

## Auto Effects (enabled by default)

Lisse clips your element with `clip-path`, which slices through CSS `border` and `box-shadow`. Normally that means you have to remove your CSS styles and rewrite them as SVG-based effect props -- extra work that's easy to forget.

**Auto effects removes that step.** On mount, the library automatically:

1. Reads the element's computed `border` and `box-shadow`
2. Converts them to equivalent SVG effects (`innerBorder`, `shadow`, `innerShadow`)
3. Strips the CSS properties so they don't get clipped
4. Restores the original CSS on unmount (cleanup)

This is enabled by default -- existing CSS borders and shadows just work.

```tsx
{/* The CSS border is automatically converted to an SVG inner border */}
<SmoothCorners corners={{ radius: 24 }} style={{ border: "2px solid red", padding: 24 }}>
  Content with auto border
</SmoothCorners>
```

### Explicit props win

If you pass effect props like `innerBorder` or `shadow`, they take priority over auto-extracted values per key:

```tsx
{/* Explicit innerBorder overrides the CSS border; CSS box-shadow is still auto-extracted */}
<SmoothCorners
  corners={{ radius: 24 }}
  style={{ border: "2px solid red", boxShadow: "0 4px 12px rgba(0,0,0,0.2)" }}
  innerBorder={{ width: 1, color: "#00ff00", opacity: 1 }}
>
  Content
</SmoothCorners>
```

### Disabling auto effects

With the component:

```tsx
<SmoothCorners corners={{ radius: 24 }} autoEffects={false}>
  Content
</SmoothCorners>
```

With the hook:

```tsx
useSmoothCorners(ref, { radius: 24 }, { autoEffects: false });
```

When disabled, CSS borders and shadows are left untouched and no automatic extraction occurs -- the original pre-autoEffects behaviour.

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
| Per-side borders | Only the top border is read. All four sides are stripped -- differing sides are lost. |
| `dashed`, `dotted`, `double`, `groove`, `ridge` | Supported. Extracted from CSS and rendered as SVG equivalents. |
| `inset`, `outset` border styles | Not replicated. Rendered as solid. |
| Multiple `box-shadow` layers | All shadow layers are extracted and rendered. Each outer shadow becomes a `shadow` entry and each inset shadow becomes an `innerShadow` entry. |
| `border-image` | Not detected. May be misread as a solid border and stripped incorrectly. |
| Gradient borders via CSS | CSS gradient borders (e.g. `border-image`) cannot be auto-extracted because `getComputedStyle` does not expose gradient data as structured values. Use the `GradientConfig` type on `BorderConfig.color` instead. |
| `outline` | Not read or stripped. Outlines are painted outside the border box and are not part of `clip-path`, so they remain visible but follow the rectangular bounding box rather than the squircle shape. |

**Behavioral notes:**

- **One-time extraction** -- CSS is read once on mount. Use explicit effect props for dynamic values.
- **`!important` rules** -- inline style overrides can't beat `!important`. The CSS property stays visible (clipped) alongside the SVG replacement, producing doubled visuals. Move the rule to a non-`!important` selector, or use `autoEffects: false`.
- **CSS transitions** -- `border` and `box-shadow` are stripped via inline styles, so CSS transitions on those properties won't animate. Use `autoEffects: false` and drive explicit effect props from an animation system instead.
- **`double` minimum width** -- `double` borders require at least 3px `border-width` to render as double. Thinner double borders fall back to solid.
- **`groove` / `ridge` approximation** -- the dark shade is computed as `RGB × 2/3` (matching Firefox). The shading is uniform around the squircle (no per-side light direction as CSS does on rectangles), which may differ slightly from browser CSS rendering.
- **Wrapper div** -- The `SmoothCorners` component always renders a wrapper `<div>` with `position: relative` around the inner element for SVG overlay positioning. This can affect flex/grid layouts and CSS child selectors (`:first-child`, `>`). Use the `useSmoothCorners` hook to avoid the wrapper -- you provide your own element and control the layout.

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
| `type` | `"linear"` | Discriminant -- must be `"linear"` |
| `angle` | `number` | Angle in degrees (CSS convention). Default: `0` (bottom to top) |
| `stops` | `GradientStop[]` | Array of color stops |

### `RadialGradientConfig`

| Property | Type | Description |
|----------|------|-------------|
| `type` | `"radial"` | Discriminant -- must be `"radial"` |
| `cx` | `number` | Horizontal center (0-1 relative). Default: `0.5` |
| `cy` | `number` | Vertical center (0-1 relative). Default: `0.5` |
| `r` | `number` | Radius (0-1 relative). Default: `0.5` |
| `stops` | `GradientStop[]` | Array of color stops |

### `GradientConfig`

```ts
type GradientConfig = LinearGradientConfig | RadialGradientConfig;
```

A union of `LinearGradientConfig` and `RadialGradientConfig`. Use the `type` discriminant to select between them.

## Examples

### Multiple Shadows

Pass an array of `ShadowConfig` objects to render layered shadows:

```tsx
import { useRef } from "react";
import { useSmoothCorners } from "@lisse/react";

function ElevatedCard() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLDivElement>(null);

  useSmoothCorners(ref, { radius: 24, smoothing: 0.6 }, {
    wrapperRef,
    effects: {
      shadow: [
        { offsetX: 0, offsetY: 1, blur: 3, spread: 0, color: "#000000", opacity: 0.12 },
        { offsetX: 0, offsetY: 8, blur: 24, spread: -4, color: "#000000", opacity: 0.15 },
      ],
    },
  });

  return (
    <div ref={wrapperRef} style={{ position: "relative" }}>
      <div ref={ref} style={{ background: "#fff", padding: 32 }}>
        Layered shadow
      </div>
    </div>
  );
}
```

Or with the component:

```tsx
<SmoothCorners
  corners={{ radius: 24 }}
  shadow={[
    { offsetX: 0, offsetY: 1, blur: 3, spread: 0, color: "#000000", opacity: 0.12 },
    { offsetX: 0, offsetY: 8, blur: 24, spread: -4, color: "#000000", opacity: 0.15 },
  ]}
  style={{ background: "#fff", padding: 32 }}
>
  Layered shadow
</SmoothCorners>
```

### Gradient Border

Use a `GradientConfig` for the border `color` to render a gradient stroke:

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

## Server Components

The `SmoothCorners` component and `useSmoothCorners` hook use browser APIs (`ResizeObserver`, DOM manipulation). In Next.js App Router or other RSC environments, use them in Client Components:

```tsx
"use client";

import { SmoothCorners } from "@lisse/react";

export function Card() {
  return (
    <SmoothCorners corners={{ radius: 20 }} style={{ background: "#fff", padding: 24 }}>
      Client-side squircle
    </SmoothCorners>
  );
}
```

For server-side path generation, use `@lisse/core/path` instead.

## License

[MIT](https://github.com/JaceThings/Lisse/blob/main/LICENSE)
