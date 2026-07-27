---
"@lisse/core": patch
---

The shared ResizeObserver measures at flush time instead of caching each entry's `borderBoxSize`, so a size that went stale between the observer firing and the rAF flush can no longer produce a clip-path larger than the element (chopped corners while a shape morphed).
