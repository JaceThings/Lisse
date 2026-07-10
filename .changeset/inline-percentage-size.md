---
"@lisse/core": patch
---

getLayoutSize no longer parses percentage computed sizes as pixels. Width and height don't apply to non-replaced inline elements, so getComputedStyle returns the computed value verbatim there ("100%", "auto"); parseFloat("100%") fabricated a 100px box and produced wildly oversized clips (a crescent-shaped avatar on Reddit was a 100x100 clip on a 32px element). Only px values are trusted now; anything else falls back to offsetWidth/offsetHeight, which measure inline fragments correctly.
