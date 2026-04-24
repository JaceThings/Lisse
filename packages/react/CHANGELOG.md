# @lisse/react

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
