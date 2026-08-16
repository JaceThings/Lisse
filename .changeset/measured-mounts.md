---
"@lisse/core": minor
"@lisse/react": minor
"@lisse/vue": minor
"@lisse/svelte": minor
---

**Mounting a squircled element now costs 2 `getComputedStyle` reads instead of 4-5.** The reads were spread across auto-extraction, the commit-time sync, and the resize flush, and several of them re-measured a size that had already been read in the same frame.

- `extractAndStripEffects` returns the element's border box as `size`, taken from the declaration it already reads, so the first sync after an extraction does not read again. The border box survives the strip: `border-box` sizing is unchanged by border removal, and `content-box` padding compensation adds back exactly the widths removed.
- The resize flush takes one declaration per element and derives the size from it, and skips a `ResizeObserver` notification whose reported box matches what the last flush measured. The flush still measures live rather than trusting `borderBoxSize`, which is a frame stale by flush time.
- New `observeAnchor(anchor, target)` replaces the hand-rolled `observeResize(anchor, () => requestMeasure(target))` in all three adapters and skips the anchor's first dispatch, which lands in the flush that already measured the target.
- `getLayoutSize(el, cs?)` accepts a pre-read declaration, matching `parseBorder`. `MeasuredSize` is exported.
