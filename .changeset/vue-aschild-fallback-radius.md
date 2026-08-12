---
"@lisse/vue": patch
---

Keep a consumer's `border-radius` out of the SSR fallback in two more places. `SmoothCorners` only recognised a `border-radius` shorthand on its own attrs, so the fallback overrode a radius set on an `asChild` child — including in server markup, where the child's value never reached the DOM at all — and briefly cleared a per-corner longhand such as `border-top-left-radius` when the clip-path landed.
