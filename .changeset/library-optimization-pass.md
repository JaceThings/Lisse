---
"@lisse/core": minor
"@lisse/react": minor
"@lisse/vue": minor
"@lisse/svelte": patch
---

Library-wide performance pass and audit fixes.

- Core: allocation-free corner distribution with a uniform fast path, superellipse fit hoisted out of the per-orient loop, persistent LRU path cache that re-serializes on in-place options mutation, ResizeObserver border-box sizes threaded to callbacks (no more per-tick `getComputedStyle`), read/write-split rAF flush, single batched style read at mount.
- React/Vue: server-rendered markup now carries an inline `border-radius` fallback so corners are rounded before hydration; it's cleared once the clip-path lands and never fights the squircle. New core export `cornerOptionsToBorderRadius` backs it.
- React: shadows no longer vanish when `shadowStrategy` flips back to `"svg"`; non-hex shadow colors (oklch/lab) emit valid box-shadow chains with opacity composed via `color-mix`; `Slot` composes refs via memo so child refs aren't re-attached every render.
- Vue/Svelte: change guards skip path regeneration and effect writes when size and options are unchanged; Vue drops deep watchers for keyed ones.
- Published dist is now minified and tarballs no longer ship CJS sourcemaps (core unpacked size 140 kB → 86 kB).
