---
"@lisse/core": patch
---

**`generatePath` is 4.5× faster on cached calls and 2.6× faster cold.** Same bytes out — all 8415 cases of a golden corpus (every curve, radius, smoothing, exponent, per-corner mix, the capsule and blend bands swept at 0.5 px, and non-finite inputs) are byte-identical, digest for digest.

- Number formatting was the hot spot in both regimes. `toFixed(4)` is replaced by an integer-split formatter that falls back to `toFixed` on the near-tie inputs where a scaled multiply would round the other way. Verified against `toFixed(4)` over 780k values, including 400k whose fifth decimal is exactly 5.
- The four orients of a corner emit the same magnitudes permuted and sign-flipped, so each is now formatted once per corner and the orients assemble from those fragments: 56 format calls down to 8 for a cold squircle corner, 72 to 18 for superellipse.
- A uniform corner config resolves one builder output instead of four, skipping three cache-key builds and three LRU touches per call, and a cache hit on the newest key no longer pays a delete/set to stay newest.
- Removed the per-call closure and string-keyed property access in the path assembler.

A resize tick over 500 corners drops from 1.18 ms to 0.28 ms cached, and from 1.93 ms to 0.61 ms when every element's shape misses the cache. The `@lisse/core/path` subpath grows 480 B brotli (3.79 kB → 4.27 kB).
