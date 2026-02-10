# @smooth-corners/core

Framework-agnostic squircle path generation based on [Figma's smoothing algorithm](https://www.figma.com/blog/desperately-seeking-squircles/). Generate smooth-cornered SVG paths, CSS clip-paths, and SVG effect overlays.

[![npm](https://img.shields.io/npm/v/%40smooth-corners%2Fcore)](https://www.npmjs.com/package/@smooth-corners/core)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE)
[![Bundle size](https://img.shields.io/bundlephobia/minzip/%40smooth-corners%2Fcore)](https://bundlephobia.com/package/@smooth-corners/core)

## Installation

```sh
npm install @smooth-corners/core
```

## API Reference

### `generatePath(width, height, options)`

Generate an SVG path `d` attribute string for a smooth-cornered rectangle.

```ts
import { generatePath } from "@smooth-corners/core";

const d = generatePath(300, 200, { radius: 24, smoothing: 0.6 });
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `width` | `number` | Rectangle width in pixels |
| `height` | `number` | Rectangle height in pixels |
| `options` | `SmoothCornerOptions` | Corner configuration (uniform or per-corner) |

**Returns:** `string` -- an SVG path `d` attribute.

### `generateClipPath(width, height, options)`

Generate a CSS `clip-path: path(...)` string. Same parameters as `generatePath`.

```ts
import { generateClipPath } from "@smooth-corners/core";

const clipPath = generateClipPath(300, 200, { radius: 24 });
element.style.clipPath = clipPath;
```

**Returns:** `string` -- a CSS `clip-path` value like `path("M 24 0 L 276 0 ...")`.

### `getPathParamsForCorner(params)`

Compute the bezier control point distances for a single corner.

```ts
import { getPathParamsForCorner } from "@smooth-corners/core";

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

**Returns:** `CornerPathParams` -- `{ a, b, c, d, p, cornerRadius, arcSectionLength }`.

### `distributeAndNormalize(rect)`

Distribute corner radii across a rectangle, proportionally reducing radii that overlap.

```ts
import { distributeAndNormalize } from "@smooth-corners/core";

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

**Returns:** `NormalizedCorners` -- each corner has `{ radius, roundingAndSmoothingBudget }`.

### `getSVGPathFromPathParams(input)`

Assemble a complete SVG path string from pre-computed corner parameters.

```ts
import { getSVGPathFromPathParams } from "@smooth-corners/core";

const path = getSVGPathFromPathParams({
  width: 200,
  height: 100,
  topLeftCornerParams: cornerParams,
  topRightCornerParams: cornerParams,
  bottomLeftCornerParams: cornerParams,
  bottomRightCornerParams: cornerParams,
});
```

**Returns:** `string` -- a complete SVG path `d` attribute.

### `toRadians(degrees)`

Convert degrees to radians.

```ts
import { toRadians } from "@smooth-corners/core";

const rad = toRadians(90); // 1.5707963...
```

### `rounded(template)`

Tagged template literal that rounds all interpolated numbers to 4 decimal places for cleaner SVG output.

```ts
import { rounded } from "@smooth-corners/core";

const x = 3.14159265;
const y = 2.71828182;
const segment = rounded`L ${x} ${y}`; // "L 3.1416 2.7183"
```

### `observeResize(el, callback)`

Observe an element's size changes using a shared `ResizeObserver`. Callbacks are batched with `requestAnimationFrame`.

```ts
import { observeResize } from "@smooth-corners/core";

const unsubscribe = observeResize(element, () => {
  // Element was resized, update clip-path
  const { width, height } = element.getBoundingClientRect();
  element.style.clipPath = generateClipPath(width, height, options);
});

// Later:
unsubscribe();
```

**Returns:** `() => void` -- an unsubscribe function.

### `createSvgEffects(anchor)`

Create an SVG overlay element for rendering inner/outer borders and inner shadows along a squircle path.

```ts
import { createSvgEffects } from "@smooth-corners/core";

const effects = createSvgEffects(wrapperElement);

effects.update(
  { radius: 24, smoothing: 0.6 },
  {
    innerBorder: { width: 1, color: "#fff", opacity: 0.2 },
    outerBorder: { width: 2, color: "#000", opacity: 0.1 },
    innerShadow: { offsetX: 0, offsetY: 2, blur: 4, spread: 0, color: "#000", opacity: 0.15 },
  },
  300,
  200,
);

// Cleanup:
effects.destroy();
```

**Returns:** `SvgEffectsHandle` -- `{ update(options, effects, width, height): void; destroy(): void }`.

### `extractAndStripEffects(el)`

Read CSS `border` and `box-shadow` from an element, strip them from inline styles, and return equivalent `EffectsConfig` values along with saved styles for restoration.

```ts
import { extractAndStripEffects } from "@smooth-corners/core";

const { effects, savedStyles } = extractAndStripEffects(element);
// effects: { innerBorder?, shadow?, innerShadow? }
// CSS border and box-shadow are now stripped from the element
```

**Returns:** `ExtractedEffects` -- `{ effects: EffectsConfig; savedStyles: { border: string; boxShadow: string } }`.

### `restoreStyles(el, saved)`

Restore previously saved inline `border` and `boxShadow` styles. If the saved value was an empty string, this removes the inline override and lets stylesheet rules reassert.

```ts
import { restoreStyles } from "@smooth-corners/core";

restoreStyles(element, savedStyles);
```

### `parseColor(raw)`

Parse an `rgb()` or `rgba()` color string (as returned by `getComputedStyle`) into hex and opacity.

```ts
import { parseColor } from "@smooth-corners/core";

const color = parseColor("rgba(255, 0, 0, 0.5)");
// { hex: "#ff0000", opacity: 0.5 }
```

**Returns:** `{ hex: string; opacity: number } | undefined`.

### `parseBorder(el)`

Read the computed border from an element and convert it to a `BorderConfig`. Returns `undefined` if the border is invisible (none/hidden, width 0, or transparent).

```ts
import { parseBorder } from "@smooth-corners/core";

const border = parseBorder(element);
// { width: 2, color: "#ff0000", opacity: 1 } or undefined
```

**Returns:** `BorderConfig | undefined`.

### `parseBoxShadow(raw)`

Parse a computed `box-shadow` string into outer shadow and inset shadow configs. Only the first outer and first inset shadow are extracted.

```ts
import { parseBoxShadow } from "@smooth-corners/core";

const { shadow, innerShadow } = parseBoxShadow(computedStyle.boxShadow);
```

**Returns:** `{ shadow?: ShadowConfig; innerShadow?: ShadowConfig }`.

### `createDropShadow(anchor)`

Create a path-based drop shadow rendered as an SVG element with gaussian blur.

```ts
import { createDropShadow } from "@smooth-corners/core";

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

**Returns:** `DropShadowHandle` -- `{ update(options, shadow, width, height): void; destroy(): void }`.

### `nextUid()`

Generate a monotonically increasing unique ID. Used internally for SVG element IDs.

```ts
import { nextUid } from "@smooth-corners/core";

const id = nextUid(); // 1, 2, 3, ...
```

### `hexToRgb(hex)`

Convert a hex color string to an `r, g, b` string for use in SVG filters.

```ts
import { hexToRgb } from "@smooth-corners/core";

const rgb = hexToRgb("#ff6600"); // "255, 102, 0"
```

### Constants

```ts
import {
  DEFAULT_SMOOTHING,         // 0.6
  DEFAULT_PRESERVE_SMOOTHING, // true
  DEFAULT_SHADOW,             // { offsetX: 0, offsetY: 0, blur: 0, spread: 0, color: "#000", opacity: 0 }
  SVG_NS,                    // "http://www.w3.org/2000/svg"
} from "@smooth-corners/core";
```

## Types Reference

### `SmoothCornerOptions`

```ts
type SmoothCornerOptions = UniformCornerOptions | PerCornerConfig;
```

### `UniformCornerOptions`

```ts
interface UniformCornerOptions {
  radius: number;
  smoothing?: number;          // Default: 0.6
  preserveSmoothing?: boolean; // Default: true
}
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
  smoothing?: number;          // Default: 0.6
  preserveSmoothing?: boolean; // Default: true
}
```

### `BorderConfig`

```ts
interface BorderConfig {
  width: number;
  color: string;
  opacity: number;
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
  innerShadow?: ShadowConfig;
  shadow?: ShadowConfig;
}
```

### `ExtractedEffects`

```ts
interface ExtractedEffects {
  effects: EffectsConfig;
  savedStyles: { border: string; boxShadow: string };
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
  update(options: SmoothCornerOptions, shadow: ShadowConfig, width: number, height: number): void;
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
import { generatePath, generateClipPath } from "@smooth-corners/core/path";
```

### Included

`generatePath`, `generateClipPath`, `getPathParamsForCorner`, `distributeAndNormalize`, `getSVGPathFromPathParams`, `toRadians`, `rounded`, `nextUid`, `hexToRgb`, `SVG_NS`, `DEFAULT_SHADOW`, `DEFAULT_SMOOTHING`, `DEFAULT_PRESERVE_SMOOTHING`

### Excluded

`createSvgEffects`, `createDropShadow`, `observeResize`, `extractAndStripEffects`, `restoreStyles`, `parseBorder`, `parseBoxShadow`, `parseColor` -- these depend on the DOM and are only available from the main entry point.

### When to use it

- Server-side rendering (Next.js, Nuxt, SvelteKit, Astro)
- Generating SVG files in Node.js scripts
- Edge runtime environments (Cloudflare Workers, Vercel Edge)
- Any context where `document` and `window` are not available

## Auto Effects

The `extractAndStripEffects` and `restoreStyles` functions power the "auto effects" feature used by all framework bindings. When applied to an element, they:

1. Read the element's computed CSS `border` and `box-shadow`
2. Convert them to equivalent `EffectsConfig` values (`innerBorder`, `shadow`, `innerShadow`)
3. Strip those CSS properties from the element's inline style (so they don't get clipped by `clip-path`)
4. Return the extracted effects and saved original styles for later restoration

This is used internally by `@smooth-corners/react`, `@smooth-corners/vue`, and `@smooth-corners/svelte` to make existing CSS borders and shadows "just work" without manual conversion. If you're using the core package directly, you can use these functions to implement the same behavior:

```ts
import { extractAndStripEffects, restoreStyles, createSvgEffects, createDropShadow } from "@smooth-corners/core";

const el = document.getElementById("card")!;
const wrapper = el.parentElement!;

// Extract and strip CSS effects
const { effects, savedStyles } = extractAndStripEffects(el);

// Use extracted effects with SVG overlay
const svgEffects = createSvgEffects(wrapper);
const shadow = createDropShadow(wrapper);

// ... apply effects ...

// Later, on cleanup:
svgEffects.destroy();
shadow.destroy();
restoreStyles(el, savedStyles); // CSS border and box-shadow are restored
```

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
- **One-time extraction** -- reads CSS once when called. Subsequent dynamic changes to border or shadow styles won't be reflected. Use explicit `EffectsConfig` values for dynamic effects.
- **`!important` rules** -- if a stylesheet sets `border` or `box-shadow` with `!important`, the inline style override cannot take precedence. The CSS property remains visible, gets clipped by the squircle path, and the SVG replacement also renders, producing doubled or broken visuals. Move the rule to a non-`!important` selector, or use `autoEffects: false` with explicit effect props.
- **CSS transitions** -- auto effects strips `border` and `box-shadow` via inline styles on mount. CSS transitions targeting these properties (e.g. `transition: border 0.3s`) will not animate while auto effects is active. To animate effects, use `autoEffects: false` and drive explicit effect props from state or an animation system.
- **No `border-image`** -- `border-image` is not detected or handled. If present, the border may be misread (the computed `borderTopStyle` may still report `solid`) and stripped, resulting in incorrect SVG effects.

## Examples

### Generate an SVG path

```ts
import { generatePath } from "@smooth-corners/core";

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
import { generateClipPath, observeResize } from "@smooth-corners/core";

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
import { createSvgEffects, createDropShadow, generateClipPath, observeResize } from "@smooth-corners/core";

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

## License

[MIT](../../LICENSE)
