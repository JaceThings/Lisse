# @lisse/core

## 0.7.0

### Minor Changes

- 6792031: **Mounting a squircled element now costs 2 `getComputedStyle` reads instead of 4-5.** The reads were spread across auto-extraction, the commit-time sync, and the resize flush, and several of them re-measured a size that had already been read in the same frame.

  - `extractAndStripEffects` returns the element's border box as `size`, taken from the declaration it already reads, so the first sync after an extraction does not read again. The border box survives the strip: `border-box` sizing is unchanged by border removal, and `content-box` padding compensation adds back exactly the widths removed.
  - The resize flush takes one declaration per element and derives the size from it, and skips a `ResizeObserver` notification whose reported box matches what the last flush measured. The flush still measures live rather than trusting `borderBoxSize`, which is a frame stale by flush time.
  - New `observeAnchor(anchor, target)` replaces the hand-rolled `observeResize(anchor, () => requestMeasure(target))` in all three adapters and skips the anchor's first dispatch, which lands in the flush that already measured the target.
  - `getLayoutSize(el, cs?)` accepts a pre-read declaration, matching `parseBorder`. `MeasuredSize` is exported.

## 0.6.3

### Patch Changes

- d2ebc30: **Parse nested colour functions in `parseBoxShadow` as one colour.** Given authored CSS like `color-mix(in oklab, oklch(…) 60%, transparent) 2px 4px 6px 0px`, the matcher picked out the inner `oklch(…)` and left `60%` in the geometry, so every value shifted along by one — offsets became `60, 2, 4, 6` instead of `2, 4, 6, 0`, painted in the unmixed colour at full opacity. It now matches one level of nesting and keeps the wrapper whole, `color-mix()` and `light-dark()` included.

  Computed styles are unaffected either way, since engines resolve those functions before serialising; this only reaches callers passing author-written CSS to the exported `parseBoxShadow` directly. The match stays linear.

- 1494a0c: **Keep borders painted in wide-gamut colors.** `parseBorder` read the computed border color through `parseColor`, which only decodes `rgb()`/`rgba()`, and gave up when that came back undefined. Tailwind v4 emits every color as `oklch()`, so on a Tailwind v4 site the border was never converted to an SVG ring, and the original square-cornered CSS border stayed on the element for `clip-path` to cut away at each corner. Straight edges looked right, corners thinned out to a sliver.

  Borders now use the same fallback outer shadows have had: colors outside sRGB — `oklch()`, `lab()`, `color()` — are carried through as their raw CSS string instead of being clipped into hex, so the stroke keeps the gamut the browser paints the element with. Alpha stays embedded in that string rather than being applied twice.

  Groove and ridge borders in those colors also no longer render black: `darkenHex` read channels off the string and got `NaN`, and now falls back to `color-mix` for anything that isn't hex.

  Separately, the colour-function matcher behind `parseBoxShadow` ran in quadratic time on a long unclosed `color(` run, since its argument class allowed a nested `(`. Excluding it makes the match linear without changing what any real computed value parses to.

## 0.6.2

### Patch Changes

- 7a5d7bd: Outer effects now work on an element that is itself the layout target, with no wrapper div.

  The SVG effects overlay was stretched over its anchor with `position: absolute; inset: 0`, which assumed the anchor's padding box was the clipped element's border box. It rarely was. Anchoring to the element itself nested the overlay inside its own `clip-path`, which clips the whole subtree, so an `outerBorder` was cut away entirely; anchoring to a shared parent put every overlay at the parent's origin, so a grid of buttons drew all its rings stacked on the first cell. Between them there was no way to get an outer border, focus ring included, without wrapping the element and giving up its place in the layout.

  The overlay is now sized and positioned over its own target inside the anchor, so the element keeps its position as a direct grid/flex item and its role as the keyboard-focus target. Placement stays exact through anchor borders and padding, scrolled anchors, ancestor `transform: scale()`, and fractional offsets, and it follows the element when a container reflows it without resizing it. An anchor ref pointing at the clipped element itself is now ignored in favour of its parent, since a nested overlay could never paint an outer border.

  Positioning the overlay needs the element's offset, and reading that inside the resize flush's write pass would force a synchronous relayout per element — 119 layouts became 36,000 across 300 elements in an early cut of this. The offset now rides along with the size the shared `ResizeObserver` already measures in its batched read pass, so layout work stays flat in the number of elements. `resize-storm` gained a case that renders actual effects (the existing one renders none, so it never ran this code) and asserts on the layout counter rather than frame timing, which is too hardware-dependent to catch it.

  Sharing one anchor between many elements also exposed an unref-counted `isolation: isolate`: the drop shadow saved and restored that style per handle, so the second handle on a container captured the first's `isolate` and wrote it back on teardown, stranding a stacking context. It is now ref-counted like `position`.

  `<SmoothCorners>` renders pixel-for-pixel as before whenever its wrapper starts where the element starts, which is the usual case. It is not purely additive there, though: the wrapper is a block `<div>` and `as="button"` renders an inline-block child, so under `text-align: center` — or anything else that offsets the element inside its wrapper — the effects overlay used to sit at the wrapper's corner while the element sat elsewhere. It now follows the element.

## 0.6.1

### Patch Changes

- cf56f97: The shared ResizeObserver measures at flush time instead of caching each entry's `borderBoxSize`, so a size that went stale between the observer firing and the rAF flush can no longer produce a clip-path larger than the element (chopped corners while a shape morphed).

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

## 0.5.2

### Patch Changes

- 29235af: getLayoutSize no longer parses percentage computed sizes as pixels. Width and height don't apply to non-replaced inline elements, so getComputedStyle returns the computed value verbatim there ("100%", "auto"); parseFloat("100%") fabricated a 100px box and produced wildly oversized clips (a crescent-shaped avatar on Reddit was a 100x100 clip on a 32px element). Only px values are trusted now; anything else falls back to offsetWidth/offsetHeight, which measure inline fragments correctly.

## 0.5.0

### Minor Changes

- 14aa5fe: Removed internal helpers from the public API: `getSVGPathFromPathParams`
  (deprecated), `toRadians`, `rounded`, `nextUid`, `hexToRgb`, and `SVG_NS`
  from `@lisse/core`, and the `SlotProps` type from `@lisse/react` (use
  `SlotPropsFor<E>`). None were consumed by the framework packages; path
  generation flows through `generatePath`.
- 14aa5fe: Capsule smoothing: squircle shapes whose radius consumes the short axis now
  render visibly smoothed caps, and sizes between the classic squircle and the
  capsule interpolate per edge, so resizing through the capsule limit is
  continuous instead of popping. Output outside that transition band is
  byte-identical to before; shapes inside it change deliberately (peak
  difference ≈1% of the corner radius at the default smoothing).

## 0.4.0

### Minor Changes

- 671a3f3: Add a `curve` option to `CornerConfig`. Existing consumers keep byte-identical output; the option opts into one of four corner constructions.

  ```ts
  import { generatePath } from "@lisse/core";

  const d = generatePath(200, 200, {
    radius: 40,
    curve: "clothoid", // 'arc' | 'squircle' (default) | 'superellipse' | 'clothoid'
    smoothing: 0.6,
  });
  ```

  - `arc` — quarter circle (CSS `border-radius`).
  - `squircle` — cubic shoulders + central arc, the Lisse / Figma curve. **Default.**
  - `superellipse` — `|x/R|^n + |y/R|^n = 1`. Set `exponent` (default `4`, matching CSS `corner-shape: squircle`).
  - `clothoid` — Euler-spiral blend from straight edge to central arc. G2 everywhere.

  Per-corner mixing works: `{ topLeft: { radius: 40, curve: "clothoid" }, topRight: { radius: 40, curve: "arc" }, ... }`. Drop shadows, inner shadows, and borders track the requested curve — no per-effect changes required.

  Math reference: [docs/curves.md](https://github.com/JaceThings/Lisse/blob/main/docs/curves.md). Try the curves in the [playground](https://corne.rs/playground).

  **Note for downstream snapshot tests:** the rendered geometry is unchanged for `curve: 'squircle'` (the default) — same curve segments, same vertices. Two cosmetic format changes in this release affect every path string and will surface in snapshot diffs:

  1. Skeleton `M` / `L` coordinates now round to 4 decimals (e.g. `M 64 0` → `M 64.0000 0`), matching the precision the curve segments already used. This makes output bit-stable across Node / browser engines (`Math.sin`/`Math.cos` can vary by 1 ULP between V8 builds).
  2. Per-corner curve mixing emits the chosen curve's path segment instead of always the squircle's.

  If you snapshot Lisse output, expect a one-time diff. The visual rendering is unchanged.

## 0.3.2

### Patch Changes

- fd05b4a: Fix horizontal viewport overflow on narrow anchors. The drop-shadow `<svg>` was created without explicit `width`/`height` attributes, so browsers fell back to the SVG replaced-element default of `300×150` CSS px. CSS `position: absolute; inset: 0` does not override an SVG's intrinsic size, so on anchors narrower than 300 px (e.g. toggle pills around 110 px on mobile) the shadow SVG forced 200+ px of horizontal scroll even though its visible shadow rendered correctly. The SVG now sets `width="100%"` and `height="100%"` so it stretches to fill the anchor regardless of intrinsic size.
- 5c137a4: Safari-only mitigation for an SVG drop-shadow rasterisation bug where shadows on sub-pixel boundaries rendered with visible hairline edges or sheared on scroll. If you ship to Safari users, shadows now sit on the device-pixel grid and stay crisp during transform and scroll-linked motion. Chromium output is byte-identical to the previous release.

  - Every shadow filter is now `filterUnits="userSpaceOnUse"` with a tight per-update pixel region (`pad = ceil(3 * blur + |spread| + 1)`), so WebKit gets a deterministic region that does not re-round on sub-pixel anchors.
  - A WebKit-gated per-handle rAF loop snaps the library-owned SVG element to the nearest device-pixel grid via `svg.style.transform`. The consumer anchor is never mutated, so this stacks with consumer transforms and never triggers a ResizeObserver feedback cycle.
  - A DPR `matchMedia` listener handles Retina ↔ non-Retina display moves and is now strict-mode-safe across `destroy()`.
  - Ring layers (`blur=0`, `spread>0`) render as a stroke on the original silhouette instead of an enlarged fill, so antialiasing is uniform across WebKit Core Graphics and Skia.

## 0.3.1

### Patch Changes

- d2d78ba: Fixes surfaced by a multi-reviewer audit of the 0.3.0 codebase (all four reviewers agreed):

  - `observeResize.flush` now snapshots the callback `Set` before iterating, so a callback that unsubscribes a sibling no longer skips the sibling's dispatch and cannot disconnect the shared `ResizeObserver` mid-flush.
  - React `useSmoothCorners` drops the useless `JSON.stringify` `useMemo` wrappers. The memo deps were identity-based, so the memo never hit when callers passed fresh option literals each render. Same number of string builds, one fewer memo cell per render.
  - React `useSmoothCorners` now hoists the anchor-acquire + SVG-handle-creation sequence into a single `ensureHandles` helper shared across the three `useIsoLayoutEffect` blocks. Prevents future refactors from accidentally introducing a double-`acquirePosition`.
  - `@lisse/core` collapses four helper functions (`isUniform`, `resolveCorner`, `fillDefaults`, `resolveOptions`) into two (`withDefaults`, `resolve`). Behaviour identical; 40+ lines shorter.

- 069b036: Fixes surfaced by a multi-reviewer audit (three of four reviewers agreed):

  - Vue `useSmoothCorners` now subscribes to `observeResize` once per element, routing both clip-path sync and effects sync through a single callback. Previously each resize fired two callbacks with two `getBoundingClientRect` reads per instance; measured savings at 500 instances are meaningful.
  - `@lisse/core` SVG overlay and drop-shadow handles now memoise `generatePath` per dispatch, keyed on `(width, height, spread, options)`. Inner-shadow pools with multiple spreads no longer re-run the distribute + per-corner math once per shadow.
  - Minor: tightened `as const` placement in the gradient helpers so TypeScript narrows the full ternary, not just the right-hand string.

- 60745a2: Four safety and correctness fixes surfaced by a multi-reviewer audit (two of four reviewers flagged each; all four are high-severity):

  - React `Slot` now reads the child's `ref` from `props.ref` (React 19) with fallback to the element's own `.ref` (React 18). Previously React 19 emitted a deprecation `console.error` and the child's ref could be silently dropped.
  - `@lisse/core` `extractAndStripEffects` no longer wipes `el.style.border` / `el.style.boxShadow` when parsing failed. Borders with `currentcolor`, `oklch()`, named colours, or `border-image` are now left intact rather than silently removed with no SVG replacement.
  - `@lisse/core` `releasePosition` is now a no-op when called without a matching `acquirePosition`. Previously it cleared `anchor.style.position`, which could stomp a user's own inline `position`.
  - `@lisse/core` `createDropShadow` now saves and restores `anchor.style.isolation` instead of leaking `isolation: isolate` onto every anchor the library ever touches.

- a37f53e: Four singleton findings from a multi-reviewer audit:

  - Svelte action `destroy` now resets the internal `didAcquire` flag alongside clearing the captured anchor. Previously a second `destroy()` (HMR, reactive cycles) could call `releasePosition` on an anchor it no longer owned.
  - `@lisse/core` `getPathParamsForCorner` short-circuits to a zero struct when `cornerRadius <= 0`. Removes a latent `NaN` field when per-corner configs mix zero radii with `preserveSmoothing: false`; output paths were already safe via a draw-side guard, but the intermediate struct is now safe too.
  - `@lisse/core` `createDropShadow` sets `color-interpolation-filters="sRGB"` on its filter element, matching `svg-effects.ts`. Removes a blur-tint inconsistency across user agents.
  - Drop-shadow handle is created lazily across the React, Vue, and Svelte adapters, and skipped entirely for consumers using only border effects. Saves two DOM nodes and one `isolation:isolate` mutation per instance.

## 0.3.0

### Patch Changes

- 6d8cd18: Fill in JSDoc on the public utility exports (`toRadians`, `rounded`, `adjacentsByCorner`, `acquirePosition`, `releasePosition`, `getSVGPathFromPathParams`). IDE hover now shows a one- or two-sentence description for each instead of an empty tooltip. No runtime changes.

## 0.1.0

### Minor Changes

- Initial public release of `@lisse/core`: framework-agnostic utilities for computing squircle clip paths and SVG effect overlays, shared by the React, Vue, and Svelte adapters.
