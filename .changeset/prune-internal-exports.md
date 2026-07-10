---
"@lisse/core": minor
"@lisse/react": minor
---

Removed internal helpers from the public API: `getSVGPathFromPathParams`
(deprecated), `toRadians`, `rounded`, `nextUid`, `hexToRgb`, and `SVG_NS`
from `@lisse/core`, and the `SlotProps` type from `@lisse/react` (use
`SlotPropsFor<E>`). None were consumed by the framework packages; path
generation flows through `generatePath`.
