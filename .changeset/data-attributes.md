---
"@lisse/react": minor
"@lisse/vue": minor
"@lisse/svelte": minor
---

Expose `data-slot="smooth-corners"` and `data-state="pending" | "ready"` on the managed element. `data-state` flips to `"ready"` after the first successful clip-path application. This lets consumers target SmoothCorners elements globally and mask any first-frame flicker:

```css
[data-slot="smooth-corners"][data-state="pending"] { opacity: 0; }
[data-slot="smooth-corners"][data-state="ready"]   { opacity: 1; transition: opacity 100ms; }
```
