# @lisse/core

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
