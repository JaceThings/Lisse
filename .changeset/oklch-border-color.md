---
"@lisse/core": patch
---

**Keep borders painted in wide-gamut colors.** `parseBorder` read the computed border color through `parseColor`, which only decodes `rgb()`/`rgba()`, and gave up when that came back undefined. Tailwind v4 emits every color as `oklch()`, so on a Tailwind v4 site the border was never converted to an SVG ring, and the original square-cornered CSS border stayed on the element for `clip-path` to cut away at each corner. Straight edges looked right, corners thinned out to a sliver.

Borders now use the same fallback outer shadows have had: colors outside sRGB — `oklch()`, `lab()`, `color()` — are carried through as their raw CSS string instead of being clipped into hex, so the stroke keeps the gamut the browser paints the element with. Alpha stays embedded in that string rather than being applied twice.

Groove and ridge borders in those colors also no longer render black: `darkenHex` read channels off the string and got `NaN`, and now falls back to `color-mix` for anything that isn't hex.
