---
"@lisse/vue": patch
---

Stop tearing the clip-path down on every re-render. Vue re-normalizes a vnode's `ref` on each render, so the template ref was nulled and re-set even when the element never changed, and the composable treated that as a new element: it cleared the clip-path, destroyed the SVG effect handles, and rebuilt them on the next observer tick — a frame of square corners and missing effects on any unrelated state change. Re-attaching now happens only for a genuinely different element, or when `autoEffects` toggles and the extraction lifecycle has to run again.
