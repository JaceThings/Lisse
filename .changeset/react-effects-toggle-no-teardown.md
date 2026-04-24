---
"@lisse/react": patch
---

Perf: toggling an effect prop (`innerBorder`, `outerBorder`, `middleBorder`, `innerShadow`, `shadow`) on and off no longer tears down and rebuilds the SVG overlay. Handles are created lazily on first use and destroyed only when the component unmounts, matching the Vue composable's behaviour. This eliminates a round trip through `createSvgEffects`, `createDropShadow`, `acquirePosition`, `releasePosition`, and `extractAndStripEffects` for consumers that flip effects dynamically.
