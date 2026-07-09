---
"@lisse/core": minor
---

Capsule smoothing: squircle shapes whose radius consumes the short axis now
render visibly smoothed caps, and sizes between the classic squircle and the
capsule interpolate per edge, so resizing through the capsule limit is
continuous instead of popping. Output outside that transition band is
byte-identical to before; shapes inside it change deliberately (peak
difference ≈1% of the corner radius at the default smoothing).
