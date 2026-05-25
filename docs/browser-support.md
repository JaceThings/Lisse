# Browser support

Lisse targets evergreen browsers. The runtime uses `clip-path`, `ResizeObserver`, `getComputedStyle`, and standard SVG APIs.

| Browser | Minimum version |
|---|---|
| Chrome / Edge | 79 |
| Firefox | 69 |
| Safari | 13.1 |

Older browsers miss `ResizeObserver`; Lisse falls back to a no-op observer there, so elements render with their initial size but do not re-sync on resize. Drop-shadow filters and SVG mask features require the listed versions. If you need broader coverage, polyfill `ResizeObserver` yourself.

Safari has documented SVG quirks that affect this library; see [`safari-shadow-rendering.md`](./safari-shadow-rendering.md) and [`safari-svg-scale-rendering.md`](./safari-svg-scale-rendering.md) for the workarounds Lisse applies.
