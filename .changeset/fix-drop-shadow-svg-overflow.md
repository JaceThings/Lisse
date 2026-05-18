---
"@lisse/core": patch
---

Fix horizontal viewport overflow on narrow anchors. The drop-shadow `<svg>` was created without explicit `width`/`height` attributes, so browsers fell back to the SVG replaced-element default of `300×150` CSS px. CSS `position: absolute; inset: 0` does not override an SVG's intrinsic size, so on anchors narrower than 300 px (e.g. toggle pills around 110 px on mobile) the shadow SVG forced 200+ px of horizontal scroll even though its visible shadow rendered correctly. The SVG now sets `width="100%"` and `height="100%"` so it stretches to fill the anchor regardless of intrinsic size.
