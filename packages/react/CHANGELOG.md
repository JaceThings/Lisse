# @lisse/react

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

  The existing `SlotProps` type is unchanged, so non-parameterised usage continues to work. Runtime behaviour is unchanged -- every prop is forwarded to the cloned child regardless of type. The generic parameter is a type-level hint only.

- c94438f: `Slot` now respects `event.preventDefault()` when composing event handlers: the parent handler is skipped if the child handler called `preventDefault()` on the event. Matches Radix's Slot semantics and gives a child a way to opt out of the composed behaviour. Existing usages where the child does not call `preventDefault()` are unchanged -- both handlers still fire in order (child first, parent second).

### Patch Changes

- 4868d3a: Perf: toggling an effect prop (`innerBorder`, `outerBorder`, `middleBorder`, `innerShadow`, `shadow`) on and off no longer tears down and rebuilds the SVG overlay. Handles are created lazily on first use and destroyed only when the component unmounts, matching the Vue composable's behaviour. This eliminates a round trip through `createSvgEffects`, `createDropShadow`, `acquirePosition`, `releasePosition`, and `extractAndStripEffects` for consumers that flip effects dynamically.
- c94438f: `Slot` error messages are now specific to the actual failure:

  - Zero children: `"received none"`.
  - Multiple children: includes the received count.
  - Non-element child: includes the received `typeof` (string, number, ...).
  - Fragment child: tells the user to unwrap the Fragment so Slot can merge props onto a real element.

  The previous single message (`"expects exactly one child"`) covered all four cases without distinguishing them. Behaviour is otherwise unchanged.

- Updated dependencies [6d8cd18]
  - @lisse/core@0.3.0

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
