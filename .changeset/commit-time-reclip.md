---
"@lisse/react": patch
---

Re-clip at commit time when a render changes the element's size. Previously a size change only reached the clip through the resize observer, which delivers a frame late; animations that drive width or height through React painted a stale clip for a frame (visible as flattened corners mid-animation on WebKit under load). The hook now syncs on every commit, with a size and options snapshot keeping idle renders at a single computed-style read.
