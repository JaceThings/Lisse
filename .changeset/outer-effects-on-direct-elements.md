---
"@lisse/core": patch
"@lisse/react": patch
"@lisse/vue": patch
"@lisse/svelte": patch
---

Outer effects now work on an element that is itself the layout target, with no wrapper div.

The SVG effects overlay was stretched over its anchor with `position: absolute; inset: 0`, which assumed the anchor's padding box was the clipped element's border box. It rarely was. Anchoring to the element itself nested the overlay inside its own `clip-path`, which clips the whole subtree, so an `outerBorder` was cut away entirely; anchoring to a shared parent put every overlay at the parent's origin, so a grid of buttons drew all its rings stacked on the first cell. Between them there was no way to get an outer border, focus ring included, without wrapping the element and giving up its place in the layout.

The overlay is now sized and positioned over its own target inside the anchor, so the element keeps its position as a direct grid/flex item and its role as the keyboard-focus target. Placement stays exact through anchor borders and padding, scrolled anchors, ancestor `transform: scale()`, and fractional offsets, and it follows the element when a container reflows it without resizing it. An anchor ref pointing at the clipped element itself is now ignored in favour of its parent, since a nested overlay could never paint an outer border.

Positioning the overlay needs the element's offset, and reading that inside the resize flush's write pass would force a synchronous relayout per element — 119 layouts became 36,000 across 300 elements in an early cut of this. The offset now rides along with the size the shared `ResizeObserver` already measures in its batched read pass, so layout work stays flat in the number of elements. `resize-storm` gained a case that renders actual effects (the existing one renders none, so it never ran this code) and asserts on the layout counter rather than frame timing, which is too hardware-dependent to catch it.

Sharing one anchor between many elements also exposed an unref-counted `isolation: isolate`: the drop shadow saved and restored that style per handle, so the second handle on a container captured the first's `isolate` and wrote it back on teardown, stranding a stacking context. It is now ref-counted like `position`.

`<SmoothCorners>` renders pixel-for-pixel as before whenever its wrapper starts where the element starts, which is the usual case. It is not purely additive there, though: the wrapper is a block `<div>` and `as="button"` renders an inline-block child, so under `text-align: center` — or anything else that offsets the element inside its wrapper — the effects overlay used to sit at the wrapper's corner while the element sat elsewhere. It now follows the element.
