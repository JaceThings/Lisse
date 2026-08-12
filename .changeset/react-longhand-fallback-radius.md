---
"@lisse/react": patch
---

Keep a per-corner `border-radius` longhand out of the SSR fallback teardown. Only the `borderRadius` shorthand counted as consumer-supplied, so a `borderTopLeftRadius` armed the fallback anyway — and clearing the shorthand once the clip-path landed erased the longhand with it.
