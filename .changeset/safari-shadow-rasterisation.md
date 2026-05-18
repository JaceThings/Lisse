---
"@lisse/core": patch
---

Safari-only mitigation for an SVG drop-shadow rasterisation bug where shadows on sub-pixel boundaries rendered with visible hairline edges or sheared on scroll. If you ship to Safari users, shadows now sit on the device-pixel grid and stay crisp during transform and scroll-linked motion. Chromium output is byte-identical to the previous release.

- Every shadow filter is now `filterUnits="userSpaceOnUse"` with a tight per-update pixel region (`pad = ceil(3 * blur + |spread| + 1)`), so WebKit gets a deterministic region that does not re-round on sub-pixel anchors.
- A WebKit-gated per-handle rAF loop snaps the library-owned SVG element to the nearest device-pixel grid via `svg.style.transform`. The consumer anchor is never mutated, so this stacks with consumer transforms and never triggers a ResizeObserver feedback cycle.
- A DPR `matchMedia` listener handles Retina ↔ non-Retina display moves and is now strict-mode-safe across `destroy()`.
- Ring layers (`blur=0`, `spread>0`) render as a stroke on the original silhouette instead of an enlarged fill, so antialiasing is uniform across WebKit Core Graphics and Skia.
