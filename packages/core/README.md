# @lisse/core

Framework-agnostic squircle path generation based on [Figma's smoothing algorithm](https://www.figma.com/blog/desperately-seeking-squircles/). Generate smooth-cornered SVG paths, CSS clip-paths, and SVG effect overlays.

> See [Gotchas](https://github.com/JaceThings/Lisse#gotchas) in the root README for `clip-path` interaction notes (focus outlines, overflow, scrollbars).

[![npm](https://img.shields.io/npm/v/%40lisse%2Fcore)](https://www.npmjs.com/package/@lisse/core)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/JaceThings/Lisse/blob/main/LICENSE)

## Installation

```sh
npm install @lisse/core
```

## API Reference

### `generatePath(width, height, options)`

Generate an SVG path `d` attribute string for a smooth-cornered rectangle.

```ts
import { generatePath } from "@lisse/core";

const d = generatePath(300, 200, { radius: 24, smoothing: 0.6 });
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `width` | `number` | Rectangle width in pixels |
| `height` | `number` | Rectangle height in pixels |
| `options` | `SmoothCornerOptions` | Corner configuration (uniform or per-corner) |

**Returns:** `string`. The SVG path `d` attribute.

### `generateClipPath(width, height, options)`

Generate a CSS `clip-path: path(...)` string. Same parameters as `generatePath`.

```ts
import { generateClipPath } from "@lisse/core";

const clipPath = generateClipPath(300, 200, { radius: 24 });
element.style.clipPath = clipPath;
```

**Returns:** `string`. A CSS `clip-path` value like `path("M 24 0 L 276 0 ...")`.

### `getPathParamsForCorner(params)`

Compute the bezier control point distances for a single corner.

```ts
import { getPathParamsForCorner } from "@lisse/core";

const params = getPathParamsForCorner({
  cornerRadius: 24,
  cornerSmoothing: 0.6,
  preserveSmoothing: true,
  roundingAndSmoothingBudget: 150,
});
// Returns: { a, b, c, d, p, cornerRadius, arcSectionLength }
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `params.cornerRadius` | `number` | The corner radius |
| `params.cornerSmoothing` | `number` | Smoothing factor (0-1) |
| `params.preserveSmoothing` | `boolean` | Whether to preserve smoothing at the cost of radius |
| `params.roundingAndSmoothingBudget` | `number` | Available edge length for this corner |

**Returns:** `CornerPathParams` with the shape `{ a, b, c, d, p, cornerRadius, arcSectionLength }`.

### `distributeAndNormalize(rect)`

Distribute corner radii across a rectangle, proportionally reducing radii that overlap.

```ts
import { distributeAndNormalize } from "@lisse/core";

const corners = distributeAndNormalize({
  topLeftCornerRadius: 40,
  topRightCornerRadius: 40,
  bottomRightCornerRadius: 20,
  bottomLeftCornerRadius: 20,
  width: 200,
  height: 100,
});
// Returns: { topLeft, topRight, bottomLeft, bottomRight }
// Each: { radius, roundingAndSmoothingBudget }
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `rect.topLeftCornerRadius` | `number` | Top-left radius |
| `rect.topRightCornerRadius` | `number` | Top-right radius |
| `rect.bottomRightCornerRadius` | `number` | Bottom-right radius |
| `rect.bottomLeftCornerRadius` | `number` | Bottom-left radius |
| `rect.width` | `number` | Rectangle width |
| `rect.height` | `number` | Rectangle height |

**Returns:** `NormalizedCorners`. Each corner has `{ radius, roundingAndSmoothingBudget }`.

### `observeResize(el, callback)`

Observe an element's size changes using a shared `ResizeObserver`. Callbacks are batched with `requestAnimationFrame`.

```ts
import { observeResize } from "@lisse/core";

const unsubscribe = observeResize(element, () => {
  // Element was resized, update clip-path
  const { width, height } = element.getBoundingClientRect();
  element.style.clipPath = generateClipPath(width, height, options);
});

// Later:
unsubscribe();
```

**Returns:** `() => void`. An unsubscribe function.

### `createSvgEffects(anchor)`

Create an SVG overlay element for rendering inner/outer borders and inner shadows along a squircle path.

```ts
import { createSvgEffects } from "@lisse/core";

const effects = createSvgEffects(wrapperElement);

effects.update(
  { radius: 24, smoothing: 0.6 },
  {
    innerBorder: { width: 1, color: "#fff", opacity: 0.2 },
    outerBorder: { width: 2, color: "#000", opacity: 0.1 },
    middleBorder: { width: 1, color: "#888", opacity: 0.5 },
    innerShadow: [
      { offsetX: 0, offsetY: 2, blur: 4, spread: 0, color: "#000", opacity: 0.15 },
    ],
    shadow: [
      { offsetX: 0, offsetY: 4, blur: 12, spread: 0, color: "#000", opacity: 0.1 },
    ],
  },
  300,
  200,
);

// Cleanup:
effects.destroy();
```

**Returns:** `SvgEffectsHandle` with the shape `{ update(options, effects, width, height): void; destroy(): void }`.

### `extractAndStripEffects(el)`

Read CSS `border` and `box-shadow` from an element, strip them from inline styles, and return equivalent `EffectsConfig` values along with saved styles for restoration.

```ts
import { extractAndStripEffects } from "@lisse/core";

const { effects, savedStyles } = extractAndStripEffects(element);
// effects: { innerBorder?, shadow?, innerShadow? }
// CSS border and box-shadow are now stripped from the element
```

**Returns:** `ExtractedEffects` with the shape `{ effects: EffectsConfig; savedStyles: { border: string; boxShadow: string } }`.

### `restoreStyles(el, saved)`

Restore previously saved inline `border` and `boxShadow` styles. If the saved value was an empty string, this removes the inline override and lets stylesheet rules reassert.

```ts
import { restoreStyles } from "@lisse/core";

restoreStyles(element, savedStyles);
```

### `parseColor(raw)`

Parse an `rgb()` or `rgba()` color string (as returned by `getComputedStyle`) into hex and opacity.

```ts
import { parseColor } from "@lisse/core";

const color = parseColor("rgba(255, 0, 0, 0.5)");
// { hex: "#ff0000", opacity: 0.5 }
```

**Returns:** `{ hex: string; opacity: number } | undefined`.

### `parseBorder(el)`

Read the computed border from an element and convert it to a `BorderConfig`. Returns `undefined` if the border is invisible (none/hidden, width 0, or transparent).

```ts
import { parseBorder } from "@lisse/core";

const border = parseBorder(element);
// { width: 2, color: "#ff0000", opacity: 1 } or undefined
```

**Returns:** `BorderConfig | undefined`.

### `parseBoxShadow(raw)`

Parse a computed `box-shadow` string into arrays of outer and inset shadow configs. All shadow layers are extracted and rendered, preserving CSS order.

```ts
import { parseBoxShadow } from "@lisse/core";

const { shadow, innerShadow } = parseBoxShadow(computedStyle.boxShadow);
// shadow: ShadowConfig[] | undefined
// innerShadow: ShadowConfig[] | undefined
```

**Returns:** `{ shadow?: ShadowConfig[]; innerShadow?: ShadowConfig[] }`.

### `createDropShadow(anchor)`

Create a path-based drop shadow rendered as an SVG element with gaussian blur.

```ts
import { createDropShadow } from "@lisse/core";

const shadow = createDropShadow(wrapperElement);

shadow.update(
  { radius: 24, smoothing: 0.6 },
  { offsetX: 0, offsetY: 8, blur: 24, spread: 0, color: "#000", opacity: 0.2 },
  300,
  200,
);

// Cleanup:
shadow.destroy();
```

**Returns:** `DropShadowHandle` with the shape `{ update(options, shadow | shadows[], width, height): void; destroy(): void }`. Accepts a single `ShadowConfig` or an array.

### Constants

```ts
import {
  DEFAULT_SMOOTHING,          // 0.6
  DEFAULT_PRESERVE_SMOOTHING, // true
} from "@lisse/core";
```

## Types Reference

### `SmoothCornerOptions`

Uniform corners use `CornerConfig` directly. Per-corner configs use `PerCornerConfig`:

```ts
type SmoothCornerOptions = CornerConfig | PerCornerConfig;
```

### `PerCornerConfig`

```ts
interface PerCornerConfig {
  topLeft?: CornerConfig | number;
  topRight?: CornerConfig | number;
  bottomRight?: CornerConfig | number;
  bottomLeft?: CornerConfig | number;
}
```

### `CornerConfig`

```ts
interface CornerConfig {
  radius: number;
  curve?: CurveType;           // Default: 'squircle'
  smoothing?: number;          // Default: 0.6
  exponent?: number;           // superellipse only. Default: 4
  preserveSmoothing?: boolean; // Default: true
}
```

### `BorderStyle`

```ts
type BorderStyle = "solid" | "dashed" | "dotted";
```

### `BorderConfig`

```ts
interface BorderConfig {
  width: number;
  color: string;
  opacity: number;
  style?: BorderStyle;
  dash?: number;
  gap?: number;
  lineCap?: "butt" | "round" | "square";
}
```

### `ShadowConfig`

```ts
interface ShadowConfig {
  offsetX: number;
  offsetY: number;
  blur: number;
  spread: number;
  color: string;
  opacity: number;
}
```

### `EffectsConfig`

```ts
interface EffectsConfig {
  innerBorder?: BorderConfig;
  outerBorder?: BorderConfig;
  middleBorder?: BorderConfig;
  innerShadow?: ShadowConfig | ShadowConfig[];
  shadow?: ShadowConfig | ShadowConfig[];
}
```

### `ExtractedEffects`

```ts
interface ExtractedEffects {
  effects: EffectsConfig;
  savedStyles: {
    border: string;
    boxShadow: string;
    paddingTop: string;
    paddingRight: string;
    paddingBottom: string;
    paddingLeft: string;
  };
}
```

### `SvgEffectsHandle`

```ts
interface SvgEffectsHandle {
  update(options: SmoothCornerOptions, effects: EffectsConfig, width: number, height: number): void;
  destroy(): void;
}
```

### `DropShadowHandle`

```ts
interface DropShadowHandle {
  update(options: SmoothCornerOptions, shadow: ShadowConfig | ShadowConfig[], width: number, height: number): void;
  destroy(): void;
}
```

### `CornerPathParams`

```ts
interface CornerPathParams {
  a: number;
  b: number;
  c: number;
  d: number;
  p: number;
  cornerRadius: number;
  arcSectionLength: number;
}
```

### `CornerParams`

```ts
interface CornerParams {
  cornerRadius: number;
  cornerSmoothing: number;
  preserveSmoothing: boolean;
  roundingAndSmoothingBudget: number;
}
```

### `NormalizedCorner` / `NormalizedCorners`

```ts
interface NormalizedCorner {
  radius: number;
  roundingAndSmoothingBudget: number;
}

interface NormalizedCorners {
  topLeft: NormalizedCorner;
  topRight: NormalizedCorner;
  bottomLeft: NormalizedCorner;
  bottomRight: NormalizedCorner;
}
```

## `/path` Subpath Export

The `/path` subpath provides a DOM-free subset of the core API, safe for SSR, Node.js, and edge runtimes.

```ts
import { generatePath, generateClipPath } from "@lisse/core/path";
```

### Included

`generatePath`, `generateClipPath`, `getPathParamsForCorner`, `distributeAndNormalize`, `DEFAULT_SMOOTHING`, `DEFAULT_PRESERVE_SMOOTHING`

### Excluded

`createSvgEffects`, `createDropShadow`, `observeResize`, `parseBorder`, `parseBoxShadow`, `parseColor`. These depend on the DOM and are only available from the main entry point.

### When to use it

- Server-side rendering (Next.js, Nuxt, SvelteKit, Astro)
- Generating SVG files in Node.js scripts
- Edge runtime environments (Cloudflare Workers, Vercel Edge)
- Any context where `document` and `window` are not available

## Auto Effects

Framework bindings use `createSmoothCornersController`, which reads computed CSS once on mount, converts borders and box-shadows to SVG equivalents, strips the CSS properties, and restores them on unmount. Pass explicit `EffectsConfig` props to override auto-extracted values per key, or set `autoEffects: false` to disable extraction.

### How CSS properties are mapped

| CSS property | SVG effect | Notes |
|---|---|---|
| `border` | `innerBorder` | Width, color, opacity, and style extracted from the top edge. |
| `box-shadow` (outer) | `shadow` | All outer shadows (supports multiple). |
| `box-shadow` (inset) | `innerShadow` | All inset shadows (supports multiple). |

### Limitations

**Partial CSS conversion:**

| CSS feature | What happens | Why |
|---|---|---|
| Per-side borders | Only the top border is read. All four sides are stripped; differing sides are lost. | The SVG overlay renders a uniform border along a single squircle path; per-side variation is not possible. |
| `dashed`, `dotted` | Supported. Extracted from CSS and rendered as SVG equivalents. |  |
| `double`, `groove`, `ridge` | Not supported. Rendered as solid. |  |
| `inset`, `outset` border styles | Not replicated. Rendered as solid. |  |
| `border-image` | Not detected. May be misread as a solid border and stripped incorrectly. | `border-image` syntax is too complex to reliably parse from `getComputedStyle`. |
| `outline` | Not read or stripped. | `outline` does not follow `border-radius` consistently across browsers, so extraction would be unreliable. |
| Gradient borders | Not supported. | CSS gradient borders use `border-image`, which cannot be reliably parsed. |

**Behavioral notes:**

- **Wrapper div**: the SVG overlay is inserted into a wrapper element, which can affect `flex` and `grid` layouts. Account for the wrapper when styling parent containers.
- **One-time extraction**: reads CSS once when called. Subsequent dynamic changes won't be reflected. Continuous `getComputedStyle` polling would be expensive, so use explicit `EffectsConfig` values for dynamic effects.
- **CSS transitions**: stripped properties (`border`, `box-shadow`) are replaced with SVG equivalents that are not animatable via CSS transitions. Use `autoEffects: false` and drive explicit effect props from an animation system instead.
- **`!important` rules**: inline style stripping can't override `!important` stylesheet rules. The CSS property stays visible (clipped) alongside the SVG replacement, producing doubled visuals. Move the rule to a non-`!important` selector, or use `autoEffects: false`.

## Examples

### Generate an SVG path

```ts
import { generatePath } from "@lisse/core";

const d = generatePath(400, 300, {
  topLeft: { radius: 32, smoothing: 0.8 },
  topRight: 16,
  bottomRight: { radius: 24, smoothing: 0.4, preserveSmoothing: false },
  bottomLeft: 0,
});

const svg = `<svg width="400" height="300"><path d="${d}" fill="#3b82f6" /></svg>`;
```

### Apply clip-path to a DOM element

```ts
import { generateClipPath, observeResize } from "@lisse/core";

const el = document.getElementById("card")!;
const options = { radius: 24, smoothing: 0.6 };

function applyClipPath() {
  const { width, height } = el.getBoundingClientRect();
  el.style.clipPath = generateClipPath(width, height, options);
}

applyClipPath();
const unsubscribe = observeResize(el, applyClipPath);
```

### Create effects overlay

```ts
import { createSvgEffects, createDropShadow, generateClipPath, observeResize } from "@lisse/core";

const wrapper = document.getElementById("card-wrapper")!;
const card = document.getElementById("card")!;
const options = { radius: 24, smoothing: 0.6 };

const effects = createSvgEffects(wrapper);
const shadow = createDropShadow(wrapper);

function update() {
  const { width, height } = card.getBoundingClientRect();
  card.style.clipPath = generateClipPath(width, height, options);
  effects.update(options, { innerBorder: { width: 1, color: "#fff", opacity: 0.2 } }, width, height);
  shadow.update(options, { offsetX: 0, offsetY: 4, blur: 16, spread: 0, color: "#000", opacity: 0.15 }, width, height);
}

update();
const unsubscribe = observeResize(card, update);
```

### Multiple outer shadows

```ts
import { createDropShadow } from "@lisse/core";

const shadow = createDropShadow(wrapperElement);

shadow.update(
  { radius: 24, smoothing: 0.6 },
  [
    { offsetX: 0, offsetY: 2, blur: 4, spread: 0, color: "#000", opacity: 0.1 },
    { offsetX: 0, offsetY: 8, blur: 24, spread: -4, color: "#000", opacity: 0.15 },
    { offsetX: 0, offsetY: 20, blur: 48, spread: -8, color: "#000", opacity: 0.1 },
  ],
  300,
  200,
);
```

### Multiple inner shadows

```ts
import { createSvgEffects } from "@lisse/core";

const effects = createSvgEffects(wrapperElement);

effects.update(
  { radius: 24, smoothing: 0.6 },
  {
    innerShadow: [
      { offsetX: 0, offsetY: 1, blur: 2, spread: 0, color: "#000", opacity: 0.1 },
      { offsetX: 0, offsetY: 4, blur: 8, spread: 0, color: "#000", opacity: 0.08 },
    ],
  },
  300,
  200,
);
```

Shadows are rendered in CSS order: the first shadow in the array is topmost (closest to the element). Each shadow gets its own SVG filter and path element.

## License

[MIT](https://github.com/JaceThings/Lisse/blob/main/LICENSE)
