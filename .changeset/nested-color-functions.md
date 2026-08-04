---
"@lisse/core": patch
---

**Parse nested colour functions in `parseBoxShadow` as one colour.** Given authored CSS like `color-mix(in oklab, oklch(…) 60%, transparent) 2px 4px 6px 0px`, the matcher picked out the inner `oklch(…)` and left `60%` in the geometry, so every value shifted along by one — offsets became `60, 2, 4, 6` instead of `2, 4, 6, 0`, painted in the unmixed colour at full opacity. It now matches one level of nesting and keeps the wrapper whole, `color-mix()` and `light-dark()` included.

Computed styles are unaffected either way, since engines resolve those functions before serialising; this only reaches callers passing author-written CSS to the exported `parseBoxShadow` directly. The match stays linear.
