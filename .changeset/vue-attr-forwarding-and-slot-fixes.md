---
"@lisse/vue": patch
---

Three bug fixes surfaced during code review of the v0.2.0 component refactor:

- `<SmoothCorners>` now forwards consumer attributes (`class`, `style`, event listeners, `aria-*`, `data-*`) to the inner clipped element rather than the wrapper `div` that appears when effects are present. Previously Vue's default `inheritAttrs` behaviour landed these attributes on the wrapper, so styling the clipped element required either `asChild` or a descendant selector.

- The clip-path save/restore path now captures the managed element at setup time and restores onto the same element at cleanup. Previously the composable read `unref(target)` again at cleanup, so reassigning the target ref to a different element between setup and cleanup could apply the saved clip-path to the wrong element.

- `Slot` now recursively flattens `Fragment` vnodes and rejects text vnodes explicitly. Previously a single-element child wrapped in a `<template>` was filtered out entirely, and a text-only child was accepted but could not carry attributes or a ref.
