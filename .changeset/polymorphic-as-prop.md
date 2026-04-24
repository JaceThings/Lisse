---
"@lisse/react": minor
"@lisse/vue": minor
---

Polymorphic `as` prop is now generically typed. In React, attributes are inferred from the element passed to `as` (e.g. `<SmoothCorners as="a" href="/x">` typechecks). In Vue, `as` is narrowed to known HTML/SVG tag names. The `SmoothCornersProps` type is now generic (`SmoothCornersProps<E>`) — consumers extending the type need to pass an element type parameter.
