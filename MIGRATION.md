# Migration

## From `0.1.x` to `0.2.x`

The `0.2.0` release consolidates the corner options into a single `corners` prop / config field across React, Vue, and Svelte:

```diff
- <SmoothCorners radius={20} smoothing={0.6} />
+ <SmoothCorners corners={{ radius: 20, smoothing: 0.6 }} />

- <SmoothCorners topLeft={20} topRight={30} />
+ <SmoothCorners corners={{ topLeft: 20, topRight: 30 }} />

- use:smoothCorners={{ radius: 20, smoothing: 0.6 }}
+ use:smoothCorners={{ corners: { radius: 20, smoothing: 0.6 } }}
```

The Svelte action no longer accepts the bare `SmoothCornerOptions` shape; pass a `SmoothCornersConfig` (`{ corners, effects?, autoEffects? }`) instead.

`SmoothCornersProps` in React is now generic over the element type passed via `as`, so external callers extending the type need to thread the element parameter (`SmoothCornersProps<"a">`).

## From `0.3.x` to `0.4.x`

`0.4.0` adds four corner curve types and is a minor (additive) release for most consumers. **The default curve is unchanged** (Figma squircle) and existing code paths render identical geometry.

Two cosmetic format changes affect every path string and will surface in snapshot diffs:

1. Skeleton `M` / `L` coordinates now round to 4 decimals (e.g. `M 64 0` → `M 64.0000 0`), matching the precision the curve segments already used. This makes output bit-stable across Node / browser engines (`Math.sin` / `Math.cos` can vary by 1 ULP between V8 builds).
2. Per-corner curve mixing emits the chosen curve's path segment instead of always the squircle's.

If you snapshot Lisse output, expect a one-time diff. The rendered geometry is unchanged.

### Using the new curve types

```ts
import { generatePath } from "@lisse/core";

const d = generatePath(200, 200, {
  radius: 40,
  curve: "clothoid", // 'arc' | 'squircle' (default) | 'superellipse' | 'clothoid'
  smoothing: 0.6,
});
```

Per-corner mixing works:

```ts
{
  topLeft:     { radius: 40, curve: "clothoid" },
  topRight:    { radius: 40, curve: "arc" },
  bottomRight: { radius: 40, curve: "squircle", smoothing: 0.6 },
  bottomLeft:  { radius: 40, curve: "superellipse", exponent: 5 },
}
```

Drop shadows, inner shadows, and borders track the requested curve — no per-effect changes required.

See [`docs/curves.md`](./docs/curves.md) for the math reference and [corne.rs/math](https://corne.rs/math) for an interactive demo.
