---
"@lisse/core": patch
---

**Keep borders painted in wide-gamut colors.** `parseBorder` read the computed border color through `parseColor`, which only decodes `rgb()`/`rgba()`, and dropped the border outright when that came back undefined. Tailwind v4 emits every color as `oklch()`, so auto-extracted effects rendered no border at all on a Tailwind v4 site.

Borders now use the same fallback outer shadows have had: colors outside sRGB — `oklch()`, `lab()`, `color()` — are carried through as their raw CSS string instead of being clipped into hex, so the stroke keeps the gamut the browser paints the element with. Alpha stays embedded in that string rather than being applied twice.

Groove and ridge borders in those colors also no longer render black: `darkenHex` read channels off the string and got `NaN`, and now falls back to `color-mix` for anything that isn't hex.
