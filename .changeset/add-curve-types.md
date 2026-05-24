---
"@lisse/core": minor
---

Add a `curve` option to `CornerConfig`. Existing consumers keep byte-identical output; the option opts into one of four corner constructions.

```ts
import { generatePath } from "@lisse/core";

const d = generatePath(200, 200, {
  radius: 40,
  curve: "clothoid", // 'arc' | 'squircle' (default) | 'superellipse' | 'clothoid'
  smoothing: 0.6,
});
```

- `arc` — quarter circle (CSS `border-radius`).
- `squircle` — cubic shoulders + central arc, the Lisse / Figma curve. **Default.**
- `superellipse` — `|x/R|^n + |y/R|^n = 1`. Set `exponent` (default `4`, matching CSS `corner-shape: squircle`).
- `clothoid` — Euler-spiral blend from straight edge to central arc. G2 everywhere.

Per-corner mixing works: `{ topLeft: { radius: 40, curve: "clothoid" }, topRight: { radius: 40, curve: "arc" }, ... }`. Drop shadows, inner shadows, and borders track the requested curve — no per-effect changes required.

Math reference: [docs/curves.md](https://github.com/JaceThings/Lisse/blob/main/docs/curves.md). Interactive demo: [corne.rs/math](https://corne.rs/math).

**Note for downstream snapshot tests:** the rendered geometry is unchanged for `curve: 'squircle'` (the default) — same curve segments, same vertices. Two cosmetic format changes in this release affect every path string and will surface in snapshot diffs:

1. Skeleton `M` / `L` coordinates now round to 4 decimals (e.g. `M 64 0` → `M 64.0000 0`), matching the precision the curve segments already used. This makes output bit-stable across Node / browser engines (`Math.sin`/`Math.cos` can vary by 1 ULP between V8 builds).
2. Per-corner curve mixing emits the chosen curve's path segment instead of always the squircle's.

If you snapshot Lisse output, expect a one-time diff. The visual rendering is unchanged.
