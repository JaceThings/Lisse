# @lisse/vue

## 0.6.3

### Patch Changes

- Updated dependencies [d2ebc30]
- Updated dependencies [1494a0c]
  - @lisse/core@0.6.3

## 0.6.2

### Patch Changes

- 7a5d7bd: Outer effects now work on an element that is itself the layout target, with no wrapper div.

  The SVG effects overlay was stretched over its anchor with `position: absolute; inset: 0`, which assumed the anchor's padding box was the clipped element's border box. It rarely was. Anchoring to the element itself nested the overlay inside its own `clip-path`, which clips the whole subtree, so an `outerBorder` was cut away entirely; anchoring to a shared parent put every overlay at the parent's origin, so a grid of buttons drew all its rings stacked on the first cell. Between them there was no way to get an outer border, focus ring included, without wrapping the element and giving up its place in the layout.

  The overlay is now sized and positioned over its own target inside the anchor, so the element keeps its position as a direct grid/flex item and its role as the keyboard-focus target. Placement stays exact through anchor borders and padding, scrolled anchors, ancestor `transform: scale()`, and fractional offsets, and it follows the element when a container reflows it without resizing it. An anchor ref pointing at the clipped element itself is now ignored in favour of its parent, since a nested overlay could never paint an outer border.

  Positioning the overlay needs the element's offset, and reading that inside the resize flush's write pass would force a synchronous relayout per element — 119 layouts became 36,000 across 300 elements in an early cut of this. The offset now rides along with the size the shared `ResizeObserver` already measures in its batched read pass, so layout work stays flat in the number of elements. `resize-storm` gained a case that renders actual effects (the existing one renders none, so it never ran this code) and asserts on the layout counter rather than frame timing, which is too hardware-dependent to catch it.

  Sharing one anchor between many elements also exposed an unref-counted `isolation: isolate`: the drop shadow saved and restored that style per handle, so the second handle on a container captured the first's `isolate` and wrote it back on teardown, stranding a stacking context. It is now ref-counted like `position`.

  `<SmoothCorners>` renders pixel-for-pixel as before whenever its wrapper starts where the element starts, which is the usual case. It is not purely additive there, though: the wrapper is a block `<div>` and `as="button"` renders an inline-block child, so under `text-align: center` — or anything else that offsets the element inside its wrapper — the effects overlay used to sit at the wrapper's corner while the element sat elsewhere. It now follows the element.

- Updated dependencies [7a5d7bd]
  - @lisse/core@0.6.2

## 0.6.1

### Patch Changes

- Updated dependencies [cf56f97]
  - @lisse/core@0.6.1

## 0.6.0

### Minor Changes

- e4820bb: Default corner smoothing is now `0.65` (`APPLE_SMOOTHING`) — the closest Figma-curve match to Apple's continuous corners. Figma's labeled "iOS" preset remains available as `FIGMA_SMOOTHING` (`0.6`).

  **Migration**

  - If you omitted `smoothing` and want the old look: set `smoothing: FIGMA_SMOOTHING` (or `0.6`).
  - If you already pass `smoothing: 0.6` explicitly, nothing changes.
  - Prefer the named constants over magic numbers going forward.

- b229eb0: Library-wide performance pass and audit fixes.

  - Core: allocation-free corner distribution with a uniform fast path, superellipse fit hoisted out of the per-orient loop, persistent LRU path cache that re-serializes on in-place options mutation, ResizeObserver border-box sizes threaded to callbacks (no more per-tick `getComputedStyle`), read/write-split rAF flush, single batched style read at mount.
  - React/Vue: server-rendered markup now carries an inline `border-radius` fallback so corners are rounded before hydration; it's cleared once the clip-path lands and never fights the squircle. New core export `cornerOptionsToBorderRadius` backs it.
  - React: shadows no longer vanish when `shadowStrategy` flips back to `"svg"`; non-hex shadow colors (oklch/lab) emit valid box-shadow chains with opacity composed via `color-mix`; `Slot` composes refs via memo so child refs aren't re-attached every render.
  - Vue/Svelte: change guards skip path regeneration and effect writes when size and options are unchanged; Vue drops deep watchers for keyed ones.
  - Published dist is now minified and tarballs no longer ship CJS sourcemaps (core unpacked size 140 kB → 86 kB).

### Patch Changes

- Updated dependencies [e4820bb]
- Updated dependencies [b229eb0]
  - @lisse/core@0.6.0

## 0.5.2

### Patch Changes

- Updated dependencies [29235af]
  - @lisse/core@0.5.2

## 0.5.0

### Patch Changes

- Updated dependencies [14aa5fe]
- Updated dependencies [14aa5fe]
  - @lisse/core@0.5.0

## 0.3.1

### Patch Changes

- 069b036: Fixes surfaced by a multi-reviewer audit (three of four reviewers agreed):

  - Vue `useSmoothCorners` now subscribes to `observeResize` once per element, routing both clip-path sync and effects sync through a single callback. Previously each resize fired two callbacks with two `getBoundingClientRect` reads per instance; measured savings at 500 instances are meaningful.
  - `@lisse/core` SVG overlay and drop-shadow handles now memoise `generatePath` per dispatch, keyed on `(width, height, spread, options)`. Inner-shadow pools with multiple spreads no longer re-run the distribute + per-corner math once per shadow.
  - Minor: tightened `as const` placement in the gradient helpers so TypeScript narrows the full ternary, not just the right-hand string.

- a37f53e: Four singleton findings from a multi-reviewer audit:

  - Svelte action `destroy` now resets the internal `didAcquire` flag alongside clearing the captured anchor. Previously a second `destroy()` (HMR, reactive cycles) could call `releasePosition` on an anchor it no longer owned.
  - `@lisse/core` `getPathParamsForCorner` short-circuits to a zero struct when `cornerRadius <= 0`. Removes a latent `NaN` field when per-corner configs mix zero radii with `preserveSmoothing: false`; output paths were already safe via a draw-side guard, but the intermediate struct is now safe too.
  - `@lisse/core` `createDropShadow` sets `color-interpolation-filters="sRGB"` on its filter element, matching `svg-effects.ts`. Removes a blur-tint inconsistency across user agents.
  - Drop-shadow handle is created lazily across the React, Vue, and Svelte adapters, and skipped entirely for consumers using only border effects. Saves two DOM nodes and one `isolation:isolate` mutation per instance.

## 0.3.0

### Minor Changes

- 6d8cd18: Vue `Slot` now respects `event.preventDefault()` when composing event handlers, matching the React `Slot`. The parent handler is skipped if the child handler called `preventDefault()`. Previously Vue's `cloneVNode(vnode, attrs)` concatenated listeners into an array that always ran both; there was no way for the child to opt out of the parent handler. Error messages are also now per-case (zero children / multiple / text-only / comment-only) instead of a single generic `"exactly one element child"`.

## 0.2.0

### Minor Changes

- e80bc5d: Add `asChild` prop and a tiny internal `Slot` component. With `asChild`, SmoothCorners merges itself onto its single child instead of rendering its own element. This avoids wrapper hell when applying smooth corners to existing elements like custom buttons or links.

  ```tsx
  <SmoothCorners asChild corners={{ radius: 20 }}>
    <MyButton>Click me</MyButton>
  </SmoothCorners>
  ```

  The `Slot` component is exported for advanced composition. No new runtime dependencies.

- 8822587: **Breaking**: corner options are now passed via a single `corners` prop / config field instead of being spread on the component or action.

  ```diff
  -<SmoothCorners radius={20} smoothing={0.6} />
  +<SmoothCorners corners={{ radius: 20, smoothing: 0.6 }} />

  -<SmoothCorners topLeft={20} topRight={30} />
  +<SmoothCorners corners={{ topLeft: 20, topRight: 30 }} />

  -use:smoothCorners={{ radius: 20, smoothing: 0.6 }}
  +use:smoothCorners={{ corners: { radius: 20, smoothing: 0.6 } }}
  ```

  This eliminates the discriminated-union type assertion in the React component and aligns the React/Vue/Svelte APIs around a single shape.

- 8a72be9: Expose `data-slot="smooth-corners"` and `data-state="pending" | "ready"` on the managed element. `data-state` flips to `"ready"` after the first successful clip-path application. This lets consumers target SmoothCorners elements globally and mask any first-frame flicker:

  ```css
  [data-slot="smooth-corners"][data-state="pending"] {
    opacity: 0;
  }
  [data-slot="smooth-corners"][data-state="ready"] {
    opacity: 1;
    transition: opacity 100ms;
  }
  ```

- 80a52aa: Polymorphic `as` prop is now generically typed. In React, attributes are inferred from the element passed to `as` (e.g. `<SmoothCorners as="a" href="/x">` typechecks). In Vue, `as` is narrowed to known HTML/SVG tag names. The `SmoothCornersProps` type is now generic (`SmoothCornersProps<E>`) — consumers extending the type need to pass an element type parameter.

### Patch Changes

- 038166d: Three bug fixes surfaced during code review of the v0.2.0 component refactor:

  - `<SmoothCorners>` now forwards consumer attributes (`class`, `style`, event listeners, `aria-*`, `data-*`) to the inner clipped element rather than the wrapper `div` that appears when effects are present. Previously Vue's default `inheritAttrs` behaviour landed these attributes on the wrapper, so styling the clipped element required either `asChild` or a descendant selector.

  - The clip-path save/restore path now captures the managed element at setup time and restores onto the same element at cleanup. Previously the composable read `unref(target)` again at cleanup, so reassigning the target ref to a different element between setup and cleanup could apply the saved clip-path to the wrong element.

  - `Slot` now recursively flattens `Fragment` vnodes and rejects text vnodes explicitly. Previously a single-element child wrapped in a `<template>` was filtered out entirely, and a text-only child was accepted but could not carry attributes or a ref.

## 0.1.0

### Minor Changes

- Initial public release of `@lisse/vue`: a `<SmoothCorners>` component and `useSmoothCorners` composable that render squircle clip paths with optional SVG effects, built on `@lisse/core`.
