---
"@lisse/react": patch
---

Adds `shadowStrategy?: "svg" | "box-shadow"` to `<SmoothCorners>`. Default is `"svg"`, so existing apps are unchanged.

If you want to opt into CSS `box-shadow` rendering — e.g. to bypass the SVG filter pipeline entirely on shadow-heavy pages — pass `shadowStrategy="box-shadow"`. React then renders a sibling absolutely-positioned div behind the clipped element carrying the shadow chain, and core skips creating the SVG drop-shadow handle altogether (no rAF loop, no extra `<svg>`, no `isolation:isolate` mutation).

`autoEffects` works the same way under the new strategy: any CSS `box-shadow` Lisse extracts from the consumer element is routed into the sibling div instead of the SVG handle, so the shadow doesn't disappear when you flip the strategy. The explicit `shadow` prop takes precedence over the extracted chain.

Trade-off: the `"box-shadow"` silhouette is a rounded rectangle, not a squircle, so corners with high smoothing will look slightly less continuous than the SVG path. The `ShadowStrategy` type is exported from `@lisse/react`.
