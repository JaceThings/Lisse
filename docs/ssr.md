# Server-side rendering

The core package provides a `/path` subpath export that excludes all DOM-dependent code. Use it in server-side rendering, Node.js scripts, or edge runtimes:

```ts
// DOM-free import — safe for SSR, Node.js, edge runtimes
import { generatePath } from "@lisse/core/path";
```

The `/path` export includes `generatePath`, `generateClipPath`, `getPathParamsForCorner`, `distributeAndNormalize`, `getCurveBuilder`, `buildArc`, `buildSquircle`, `buildSuperellipse`, `buildClothoid`, `CURVE_TYPES`, `DEFAULT_SHADOW`, and the smoothing/curve defaults (`APPLE_SMOOTHING`, `FIGMA_SMOOTHING`, `DEFAULT_SMOOTHING`, `DEFAULT_PRESERVE_SMOOTHING`, `DEFAULT_CURVE`, `DEFAULT_EXPONENT`). It excludes `createSvgEffects`, `createDropShadow`, and `observeResize` — anything that touches the DOM.

## React / Vue SSR

The React and Vue framework wrappers render the SSR-safe markup automatically. `<SmoothCorners>` produces the wrapper structure on the server; the client-side hydration applies the clip-path once `ResizeObserver` fires.

## Cache and per-request isolation

The curve-shape LRU cache is module-scoped. In long-running SSR processes (Next.js, Astro, custom Node servers) you may want to clear it between requests:

```ts
import { clearCurveCache } from "@lisse/core";

// In your request handler, between requests
clearCurveCache();
```

In practice this is rarely necessary — the cache is bounded at 64 entries and serves the same configs across requests.
