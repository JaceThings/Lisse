# @lisse/react

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

- f9aabec: `composeRefs` preserves React 19 callback-ref cleanup return values so teardown from composed refs actually runs.
- Updated dependencies [e4820bb]
- Updated dependencies [b229eb0]
  - @lisse/core@0.6.0

## 0.5.2

### Patch Changes

- Updated dependencies [29235af]
  - @lisse/core@0.5.2

## 0.5.1

### Patch Changes

- 594f418: Re-clip at commit time when a render changes the element's size. Previously a size change only reached the clip through the resize observer, which delivers a frame late; animations that drive width or height through React painted a stale clip for a frame (visible as flattened corners mid-animation on WebKit under load). The hook now syncs on every commit, with a size and options snapshot keeping idle renders at a single computed-style read.

## 0.5.0

### Minor Changes

- 14aa5fe: Removed internal helpers from the public API: `getSVGPathFromPathParams`
  (deprecated), `toRadians`, `rounded`, `nextUid`, `hexToRgb`, and `SVG_NS`
  from `@lisse/core`, and the `SlotProps` type from `@lisse/react` (use
  `SlotPropsFor<E>`). None were consumed by the framework packages; path
  generation flows through `generatePath`.

### Patch Changes

- Updated dependencies [14aa5fe]
- Updated dependencies [14aa5fe]
  - @lisse/core@0.5.0

## 0.3.2

### Patch Changes

- 5c137a4: Adds `shadowStrategy?: "svg" | "box-shadow"` to `<SmoothCorners>`. Default is `"svg"`, so existing apps are unchanged.

  If you want to opt into CSS `box-shadow` rendering — e.g. to bypass the SVG filter pipeline entirely on shadow-heavy pages — pass `shadowStrategy="box-shadow"`. React then renders a sibling absolutely-positioned div behind the clipped element carrying the shadow chain, and core skips creating the SVG drop-shadow handle altogether (no rAF loop, no extra `<svg>`, no `isolation:isolate` mutation).

  `autoEffects` works the same way under the new strategy: any CSS `box-shadow` Lisse extracts from the consumer element is routed into the sibling div instead of the SVG handle, so the shadow doesn't disappear when you flip the strategy. The explicit `shadow` prop takes precedence over the extracted chain.

  Trade-off: the `"box-shadow"` silhouette is a rounded rectangle, not a squircle, so corners with high smoothing will look slightly less continuous than the SVG path. The `ShadowStrategy` type is exported from `@lisse/react`.

## 0.3.1

### Patch Changes

- d2d78ba: Fixes surfaced by a multi-reviewer audit of the 0.3.0 codebase (all four reviewers agreed):

  - `observeResize.flush` now snapshots the callback `Set` before iterating, so a callback that unsubscribes a sibling no longer skips the sibling's dispatch and cannot disconnect the shared `ResizeObserver` mid-flush.
  - React `useSmoothCorners` drops the useless `JSON.stringify` `useMemo` wrappers. The memo deps were identity-based, so the memo never hit when callers passed fresh option literals each render. Same number of string builds, one fewer memo cell per render.
  - React `useSmoothCorners` now hoists the anchor-acquire + SVG-handle-creation sequence into a single `ensureHandles` helper shared across the three `useIsoLayoutEffect` blocks. Prevents future refactors from accidentally introducing a double-`acquirePosition`.
  - `@lisse/core` collapses four helper functions (`isUniform`, `resolveCorner`, `fillDefaults`, `resolveOptions`) into two (`withDefaults`, `resolve`). Behaviour identical; 40+ lines shorter.

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

### Minor Changes

- 4868d3a: Add `SlotPropsFor<E>` and make `Slot` generic over the element type it will merge onto. Consumers who need element-specific attributes (`href`, `type`, `name`, ...) can now opt into them via a type parameter:

  ```tsx
  <Slot<"a"> href="/x">
    <a>link</a>
  </Slot>;

  <Slot<"button"> type="submit">
    <button>submit</button>
  </Slot>;
  ```

  The existing `SlotProps` type is unchanged, so non-parameterised usage continues to work. Runtime behaviour is unchanged: every prop is forwarded to the cloned child regardless of type. The generic parameter is a type-level hint only.

- c94438f: `Slot` now respects `event.preventDefault()` when composing event handlers: the parent handler is skipped if the child handler called `preventDefault()` on the event. Matches Radix's Slot semantics and gives a child a way to opt out of the composed behaviour. Existing usages where the child does not call `preventDefault()` are unchanged. Both handlers still fire in order (child first, parent second).

### Patch Changes

- 4868d3a: Perf: toggling an effect prop (`innerBorder`, `outerBorder`, `middleBorder`, `innerShadow`, `shadow`) on and off no longer tears down and rebuilds the SVG overlay. Handles are created lazily on first use and destroyed only when the component unmounts, matching the Vue composable's behaviour. This eliminates a round trip through `createSvgEffects`, `createDropShadow`, `acquirePosition`, `releasePosition`, and `extractAndStripEffects` for consumers that flip effects dynamically.
- c94438f: `Slot` error messages are now specific to the actual failure:

  - Zero children: `"received none"`.
  - Multiple children: includes the received count.
  - Non-element child: includes the received `typeof` (string, number, ...).
  - Fragment child: tells the user to unwrap the Fragment so Slot can merge props onto a real element.

  The previous single message (`"expects exactly one child"`) covered all four cases without distinguishing them. Behaviour is otherwise unchanged.

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

## 0.1.0

### Minor Changes

- Initial public release of `@lisse/react`: a `<SmoothCorners>` component that renders squircle clip paths with optional inner and outer SVG effects, built on `@lisse/core`.
