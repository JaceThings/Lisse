---
"@lisse/core": patch
"@lisse/react": patch
"@lisse/vue": patch
"@lisse/svelte": patch
"@lisse/octane": patch
---

**Flipping `shadowStrategy` no longer strips the wrapper's stacking context.** Two owners were writing `isolation` on the same wrapper: core's drop-shadow handle ref-counted it, and the React and Octane components declared it inline whenever a box-shadow sibling rendered. During the SVG phase the component declared nothing, so core saved `""`. On the flip to `box-shadow` the render committed the component's own `isolation: isolate`, the shadow-toggle effect then destroyed the drop-shadow handle, and its release wrote that saved `""` straight over it — leaving the `z-index: -1` sibling free to paint behind an ancestor background. A fresh `box-shadow` mount was never affected, because core skips the handle entirely there.

The adapters now hold an isolation count of their own for as long as the sibling is mounted, taken before the handle is torn down, so the shared count never reaches zero mid-handover. `acquireIsolation` and `releaseIsolation` are exported from `@lisse/core` for that, alongside the existing `acquirePosition` and `releasePosition`.

`@lisse/vue` and `@lisse/svelte` are unaffected — neither ships `shadowStrategy`, so core stays the only writer — and carry the patch only to keep the four linked packages on one version.
