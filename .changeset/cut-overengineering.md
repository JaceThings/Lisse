---
"@lisse/core": major
"@lisse/react": major
"@lisse/vue": major
"@lisse/svelte": major
---

Trim over-engineered surface area and consolidate framework bindings behind `createSmoothCornersController`.

**Breaking removals**

- **Gradient border colors** — `BorderConfig.color` is a hex string again; `GradientConfig`, `LinearGradientConfig`, `RadialGradientConfig`, and `GradientStop` are removed.
- **Border styles** — `double`, `groove`, and `ridge` are removed from `BorderStyle`. Only `solid`, `dashed`, and `dotted` remain.
- **`UniformCornerOptions`** — use `CornerConfig` for uniform corners (`SmoothCornerOptions = CornerConfig | PerCornerConfig`).
- **Public `Slot` export** — `@lisse/react` and `@lisse/vue` no longer export `Slot` or `SlotPropsFor`; use `asChild` on `SmoothCorners` instead.
- **Slimmed `@lisse/core` public API** — removed from the main entry: `extractAndStripEffects`, `restoreStyles`, `mergeEffects`, `acquirePosition`, `releasePosition`, `DEFAULT_SHADOW`, and deprecated `/path` helpers (`getSVGPathFromPathParams`, `toRadians`, `rounded`, `nextUid`, `hexToRgb`, `SVG_NS`). `parseColor`, `parseBoxShadow`, and `hasEffects` remain exported.
- **Internal refactor** — auto-effects, position ref-counting, and SVG handle lifecycle now flow through `createSmoothCornersController` (behaviour unchanged for framework consumers).

**Flutter (`lisse` on pub.dev)**

Flutter is versioned separately via `packages/flutter/pubspec.yaml` (not managed by Changesets). Matching breaking removals ship there: `SmoothClip` removed (clip with `ClipPath` + `LisseBorder`), styled borders limited to `dashed` / `dotted`, and gradient border painting removed.
