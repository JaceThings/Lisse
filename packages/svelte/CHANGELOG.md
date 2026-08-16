# @lisse/svelte

## 0.7.0

### Minor Changes

- 6792031: **Mounting a squircled element now costs 2 `getComputedStyle` reads instead of 4-5.** The reads were spread across auto-extraction, the commit-time sync, and the resize flush, and several of them re-measured a size that had already been read in the same frame.

  - `extractAndStripEffects` returns the element's border box as `size`, taken from the declaration it already reads, so the first sync after an extraction does not read again. The border box survives the strip: `border-box` sizing is unchanged by border removal, and `content-box` padding compensation adds back exactly the widths removed.
  - The resize flush takes one declaration per element and derives the size from it, and skips a `ResizeObserver` notification whose reported box matches what the last flush measured. The flush still measures live rather than trusting `borderBoxSize`, which is a frame stale by flush time.
  - New `observeAnchor(anchor, target)` replaces the hand-rolled `observeResize(anchor, () => requestMeasure(target))` in all three adapters and skips the anchor's first dispatch, which lands in the flush that already measured the target.
  - `getLayoutSize(el, cs?)` accepts a pre-read declaration, matching `parseBorder`. `MeasuredSize` is exported.

### Patch Changes

- Updated dependencies [6792031]
  - @lisse/core@0.7.0

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

### Patch Changes

- b229eb0: Library-wide performance pass and audit fixes.

  - Core: allocation-free corner distribution with a uniform fast path, superellipse fit hoisted out of the per-orient loop, persistent LRU path cache that re-serializes on in-place options mutation, ResizeObserver border-box sizes threaded to callbacks (no more per-tick `getComputedStyle`), read/write-split rAF flush, single batched style read at mount.
  - React/Vue: server-rendered markup now carries an inline `border-radius` fallback so corners are rounded before hydration; it's cleared once the clip-path lands and never fights the squircle. New core export `cornerOptionsToBorderRadius` backs it.
  - React: shadows no longer vanish when `shadowStrategy` flips back to `"svg"`; non-hex shadow colors (oklch/lab) emit valid box-shadow chains with opacity composed via `color-mix`; `Slot` composes refs via memo so child refs aren't re-attached every render.
  - Vue/Svelte: change guards skip path regeneration and effect writes when size and options are unchanged; Vue drops deep watchers for keyed ones.
  - Published dist is now minified and tarballs no longer ship CJS sourcemaps (core unpacked size 140 kB → 86 kB).

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

- a37f53e: Four singleton findings from a multi-reviewer audit:

  - Svelte action `destroy` now resets the internal `didAcquire` flag alongside clearing the captured anchor. Previously a second `destroy()` (HMR, reactive cycles) could call `releasePosition` on an anchor it no longer owned.
  - `@lisse/core` `getPathParamsForCorner` short-circuits to a zero struct when `cornerRadius <= 0`. Removes a latent `NaN` field when per-corner configs mix zero radii with `preserveSmoothing: false`; output paths were already safe via a draw-side guard, but the intermediate struct is now safe too.
  - `@lisse/core` `createDropShadow` sets `color-interpolation-filters="sRGB"` on its filter element, matching `svg-effects.ts`. Removes a blur-tint inconsistency across user agents.
  - Drop-shadow handle is created lazily across the React, Vue, and Svelte adapters, and skipped entirely for consumers using only border effects. Saves two DOM nodes and one `isolation:isolate` mutation per instance.

## 0.2.0

### Minor Changes

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

### Patch Changes

- f1cdedc: `autoEffects` is now reactive: calling the Svelte action's `update()` with a different `autoEffects` value starts or stops CSS extraction accordingly. Toggling from `true` to `false` restores the original inline `border` and `box-shadow`; toggling from `false` to `true` re-extracts them. Previously `autoEffects` was read once at mount and every subsequent `update()` ignored it. This aligns Svelte's behaviour with the Vue composable, where `autoEffects` has always been reactive.

## 0.1.0

### Minor Changes

- Initial public release of `@lisse/svelte`: a `<SmoothCorners>` component and `smoothCorners` action that render squircle clip paths with optional SVG effects, built on `@lisse/core`.
