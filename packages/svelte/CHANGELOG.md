# @lisse/svelte

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
