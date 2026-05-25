# How it works

The algorithm is based on [Figma's blog post on squircles](https://www.figma.com/blog/desperately-seeking-squircles/) and produces the same smooth corners you see in Figma's design tool.

A standard `border-radius` arc is a quarter circle — the curvature jumps abruptly from zero (along the straight edge) to a fixed value (along the arc). A squircle uses a series of bezier curves that ease into and out of the corner, distributing curvature smoothly across a longer segment of the edge.

The `smoothing` parameter (0 to 1) controls how far the curvature extends along the edges. At `smoothing: 0` the output is identical to a standard `border-radius`. At `smoothing: 1` the curvature occupies the maximum possible edge length.

When `preserveSmoothing` is `true` (the default), the algorithm maintains the requested smoothing value even if it means reducing the effective corner radius. When `false`, the radius is preserved and smoothing is reduced to fit.

## Border rendering

Three border positions, each using a different SVG technique:

**Inner border** draws the SVG stroke at double the specified width, then clips it to the squircle shape. Because a stroke straddles the path (half inside, half outside), clipping removes the outer half entirely. Only the inner portion remains visible.

**Outer border** also draws the stroke at double width, but uses an SVG mask instead of a clip. The mask is a white rectangle (fully visible) with a black squircle path cut out of it (fully hidden). This hides the inner half of the stroke and reveals only the outer half. The mask bounds are extended by the border width so the stroke is never cut off at the edges of the SVG.

**Middle border** is the simplest case. The stroke is drawn at its actual width with no clip or mask applied. It naturally straddles the path, half inside and half outside the squircle.

## Shadow rendering

**Drop shadow** does not use CSS `box-shadow`, which would follow the rectangular bounding box and get clipped. Instead, the library generates an actual squircle SVG path expanded by the `spread` value in all directions. This path is filled with the shadow colour, translated by `offsetX`/`offsetY`, and blurred using an SVG `feGaussianBlur` filter. The shadow SVG is positioned behind the element at `z-index: -1` using `isolation: isolate` to create a proper stacking context.

**Inner shadow** uses an SVG mask with a cutout. A white rectangle defines the visible area, and a black squircle path punched out of it creates the hole. A coloured rectangle drawn behind this mask produces the appearance of shadow around the inside edges. The cutout path is adjusted for `spread` (shrinking the hole) and `offset` (shifting it). The result is blurred with `feGaussianBlur` and clipped to the original squircle shape so nothing leaks outside.

### Multiple shadow rendering order

When an array of shadows is provided, the first shadow in the array renders on top (closest to the element). Each shadow gets its own SVG filter element. Shadows are rendered in reverse order in the SVG DOM so that SVG's "later paints on top" rule matches CSS's "first listed is topmost" convention.

## Auto-effects: content-box compensation

When `autoEffects` strips a CSS border from an element using `box-sizing: content-box`, removing the border would cause layout shift — the content area would expand to fill the space the border occupied. To prevent this, the library automatically increases padding by the border width on each side. The original padding values are saved and restored on cleanup.

## Resize handling

All Lisse instances share a single `ResizeObserver`. Callbacks are batched via `requestAnimationFrame` so that multiple elements resizing in the same frame only trigger one re-render pass. When the last observed element is removed, the observer disconnects automatically.

## Anchor positioning

The SVG overlays (borders, shadows) are absolutely positioned inside an anchor element. The library automatically sets `position: relative` on this anchor if it has `position: static`. A ref-counting system ensures that if multiple Lisse instances share the same anchor, the position is only reset to `static` when the last instance unmounts.
