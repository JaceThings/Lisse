---
"@lisse/core": minor
"@lisse/react": minor
"@lisse/vue": minor
"@lisse/svelte": minor
---

Default corner smoothing is now `0.65` (`APPLE_SMOOTHING`) — the closest Figma-curve match to Apple's continuous corners. Figma's labeled "iOS" preset remains available as `FIGMA_SMOOTHING` (`0.6`).

**Migration**
- If you omitted `smoothing` and want the old look: set `smoothing: FIGMA_SMOOTHING` (or `0.6`).
- If you already pass `smoothing: 0.6` explicitly, nothing changes.
- Prefer the named constants over magic numbers going forward.
