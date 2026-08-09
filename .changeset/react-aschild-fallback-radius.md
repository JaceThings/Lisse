---
"@lisse/react": patch
---

Keep a `border-radius` set on an `asChild` child instead of clearing it as the SSR fallback. `SmoothCorners` only checked its own `style` prop, but `Slot` merges the child's style last, so a radius set on the child is the one that reaches the DOM and it was being removed once the clip-path landed.
