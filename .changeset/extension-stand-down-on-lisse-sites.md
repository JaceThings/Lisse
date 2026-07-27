---
"@lisse/extension": patch
---

First release since 0.1.2 — the store builds were never updated for 0.1.3, so this collects three fixes that never reached users.

- **Stand down on pages that already ship Lisse.** The extension looks for the `[data-slot="smooth-corners"]` marker that every framework binding stamps on the elements it manages; finding it, it undoes everything it has applied, disconnects its observers and stops. Previously the page's own Lisse and the extension clipped the same elements, so corners on sites built with Lisse were smoothed twice and rendered chopped.
- **Pixel-snap the border stroke.** Browsers snap a native border's edges to the nearest device-pixel line at paint time. The SVG stroke now snaps with the same rounding, so borders no longer land dim or a whole device pixel off at fractional geometry.
- **Declare data collection for AMO.** The Firefox manifest carries `browser_specific_settings.gecko.data_collection_permissions` (`required: ["none"]`), which Mozilla now requires on submission.

Also picks up `@lisse/core@0.6.0` — per-corner curve types (`arc`, `squircle`, `superellipse`, `clothoid`).
