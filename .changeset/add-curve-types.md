---
"@lisse/core": minor
---

Add curve-type option to `CornerConfig`. Existing consumers keep byte-identical output; the new option opts into one of four corner constructions.

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
- `clothoid` — Euler-spiral blend from straight edge to central circular arc. G2 everywhere.

Per-corner mixing supported: `{ topLeft: { radius: 40, curve: "clothoid" }, topRight: { radius: 40, curve: "arc" }, ... }`. Drop shadows, inner shadows, and borders all track the requested curve — no per-effect changes required.

Math reference: [docs/curves.md](https://github.com/JaceThings/Lisse/blob/main/docs/curves.md). Interactive demo: [corne.rs/math](https://corne.rs/math).

**Note for downstream snapshot tests:** path output is byte-identical for `curve: 'squircle'` (the default). Opting into other curves changes the path string for that corner.
