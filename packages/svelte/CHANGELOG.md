# @lisse/svelte

## 0.3.1

### Patch Changes

- a37f53e: Four singleton findings from a multi-reviewer audit:

  - Svelte action `destroy` now resets the internal `didAcquire` flag alongside clearing the captured anchor. Previously a second `destroy()` (HMR, reactive cycles) could call `releasePosition` on an anchor it no longer owned.
  - `@lisse/core` `getPathParamsForCorner` short-circuits to a zero struct when `cornerRadius <= 0`. Removes a latent `NaN` field when per-corner configs mix zero radii with `preserveSmoothing: false`; output paths were already safe via a draw-side guard, but the intermediate struct is now safe too.
  - `@lisse/core` `createDropShadow` sets `color-interpolation-filters="sRGB"` on its filter element, matching `svg-effects.ts`. Removes a blur-tint inconsistency across user agents.
  - Drop-shadow handle is created lazily across the React, Vue, and Svelte adapters, and skipped entirely for consumers using only border effects. Saves two DOM nodes and one `isolation:isolate` mutation per instance.

- Updated dependencies [d2d78ba]
- Updated dependencies [069b036]
- Updated dependencies [60745a2]
- Updated dependencies [a37f53e]
  - @lisse/core@0.3.1

## 0.3.0

### Patch Changes

- Updated dependencies [6d8cd18]
  - @lisse/core@0.3.0

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
