# API reference

| Function / Export | Package | Description |
|---|---|---|
| `generatePath(width, height, options)` | `core` | Generate an SVG path `d` string |
| `generateClipPath(width, height, options)` | `core` | Generate a CSS `clip-path: path(...)` string |
| `getPathParamsForCorner(params)` | `core` | Compute bezier control points for a single corner |
| `distributeAndNormalize(rect)` | `core` | Distribute radii across a rectangle, resolving overlaps |
| `createSvgEffects(anchor)` | `core` | Create an SVG overlay for borders and inner shadows |
| `createDropShadow(anchor)` | `core` | Create a path-based drop shadow |
| `extractAndStripEffects(el)` | `core` | Extract CSS border/shadow and convert to SVG effects |
| `restoreStyles(el, saved)` | `core` | Restore stripped CSS border/shadow styles |
| `observeResize(el, callback)` | `core` | Observe element resize with a shared `ResizeObserver` |
| `observeAnchor(anchor, target)` | `core` | Re-measure `target` whenever `anchor` resizes |
| `getCurveBuilder(curve)` | `core` | Dispatch to one of the four curve builders |
| `CURVE_TYPES` | `core` | Array of `'arc' \| 'squircle' \| 'superellipse' \| 'clothoid'` |
| `clearCurveCache()` | `core` | Reset the internal LRU cache (tests / SSR-per-request) |
| `useSmoothCorners(ref, options, effects?)` | `react` | React hook for applying smooth corners |
| `SmoothCorners` | `react` | React component with built-in effects |
| `Slot`, `SlotPropsFor` | `react` | Polymorphic slot helper used by `asChild` |
| `useSmoothCorners(ref, options, effects?)` | `octane` | Octane hook for applying smooth corners |
| `SmoothCorners` | `octane` | Octane component with built-in effects |
| `Slot`, `SlotPropsFor` | `octane` | Polymorphic slot helper used by `asChild` |
| `useSmoothCorners(target, options, effects?)` | `vue` | Vue composable for applying smooth corners |
| `SmoothCorners` | `vue` | Vue component with built-in effects |
| `smoothCorners(node, input)` | `svelte` | Svelte action for applying smooth corners |

See individual package READMEs for framework-specific details:

- [`@lisse/core`](../packages/core/README.md)
- [`@lisse/react`](../packages/react/README.md)
- [`@lisse/vue`](../packages/vue/README.md)
- [`@lisse/svelte`](../packages/svelte/README.md)
- [`@lisse/octane`](../packages/octane/README.md)
