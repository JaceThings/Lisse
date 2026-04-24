---
"@lisse/core": patch
"@lisse/react": patch
---

Four safety and correctness fixes surfaced by a multi-reviewer audit (two of four reviewers flagged each; all four are high-severity):

- React `Slot` now reads the child's `ref` from `props.ref` (React 19) with fallback to the element's own `.ref` (React 18). Previously React 19 emitted a deprecation `console.error` and the child's ref could be silently dropped.
- `@lisse/core` `extractAndStripEffects` no longer wipes `el.style.border` / `el.style.boxShadow` when parsing failed. Borders with `currentcolor`, `oklch()`, named colours, or `border-image` are now left intact rather than silently removed with no SVG replacement.
- `@lisse/core` `releasePosition` is now a no-op when called without a matching `acquirePosition`. Previously it cleared `anchor.style.position`, which could stomp a user's own inline `position`.
- `@lisse/core` `createDropShadow` now saves and restores `anchor.style.isolation` instead of leaking `isolation: isolate` onto every anchor the library ever touches.
