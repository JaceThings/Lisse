# Safari SVG scale-up pixelation — the inverted-scale trick

This is a survival guide for one specific WebKit rendering behaviour
that affects any SVG content rendered through CSS `transform: scale()`.
**It is not Lisse-specific** — it applies to any web app that scales
SVG up via CSS transforms on an ancestor element, including sites that
never touch this library.

If you've ever shipped an SVG, animated a zoom on it, and watched
the curves go stair-stepped on Safari while Chrome stays clean, this
is the bug.

---

## What you'll see

An `<svg>` element (or any element containing SVG geometry — paths,
`<clipPath>`, masks) sits at some CSS layout size. An ancestor has
`transform: scale(K)` with `K > 1` — either statically or animated.

On Chrome / Firefox: the SVG content stays crisp at any K. The
renderer re-tessellates paths against the composited resolution.

On Safari (macOS and iOS): the SVG curves go visibly pixelated /
stair-stepped at the corners. The bigger K is, the worse it looks. A
1.5× zoom is borderline; a 3× zoom is obviously bad; a 10× zoom looks
like Minecraft.

---

## What's actually happening

WebKit's compositor rasterises an SVG element's content **once at the
element's own CSS layout size**, caches that bitmap as the element's
backing store, and then composites that bitmap under any ancestor
transform. When an ancestor scales up, Safari bilinear-upsamples the
already-rasterised cache rather than re-tessellating the path at the
new effective resolution.

This is the same WebKit-compositor caching behaviour documented in
[Bug 27684](https://bugs.webkit.org/show_bug.cgi?id=27684) ("Composited
elements appear pixelated when scaled up using transform") — unresolved
since 2009 — and [Bug 224795](https://bugs.webkit.org/show_bug.cgi?id=224795)
("Zooming browser does not properly scale SVG clip paths"). Both ship
in current Safari.

What's *not* happening: the SVG renderer is not broken. It tessellates
the path correctly the first time. The problem is that the *compositor*
reuses the bitmap when the ancestor's transform changes, instead of
treating the transform change as an invalidation.

---

## Scope

This bug affects more than just `<svg>` elements:

| Render technique                    | Affected by Safari scale-up? |
|-------------------------------------|------------------------------|
| Inline `<svg><path/></svg>`         | Yes                          |
| CSS `clip-path: path(...)`          | Yes                          |
| CSS `clip-path: url(#svg-clipPath)` | Yes                          |
| CSS `mask-image: url(...svg)`       | Yes (some Safari versions)   |
| HTML element with `border-radius`   | No (re-rasterised per frame) |
| Canvas content                      | Behaves like its source      |

If you draw a shape using *any* SVG path machinery and an ancestor
ever scales up, expect pixelation on Safari at the point of largest
zoom.

---

## The fix: render at the maximum size, scale down

Safari's compositor downsamples *cleanly* — it just doesn't upsample
cleanly. So the fix is to flip the scale baseline.

Don't render at the small size and scale up. Render at the **largest
size your animation ever needs**, then scale *down* by default. The
"compare" / "zoom" state stays at `scale(1)`, never enlarging anything.

### Worked example: an SVG that animates between 100×100 and 300×300

**Don't do this (Safari pixelates at scale(3)):**

```html
<div style="transform: scale(1); /* animated to scale(3) */">
  <svg width="100" height="100" viewBox="0 0 100 100">
    <path d="..." fill="black"/>
  </svg>
</div>
```

**Do this instead (Safari downsamples cleanly at scale(0.333)):**

```html
<div style="transform: scale(0.333); /* animated to scale(1) */">
  <svg width="300" height="300" viewBox="0 0 300 300">
    <!-- Re-author the path at the 300×300 coordinate space. -->
    <path d="..." fill="black"/>
  </svg>
</div>
```

The visible result is identical at both ends of the animation. The
difference is which direction the scale travels. Safari's compositor
cache, sized to the layout box, now holds the high-resolution version;
both the static `scale(1)` end and the `scale(0.333)` end downsample
from it.

### What to do if your "zoom" is unbounded

If the consumer can zoom the SVG arbitrarily, pick a `MAX_ZOOM_SCALE`
that covers every realistic case and author the SVG at that size. The
memory cost is real (a 4096×4096 cached bitmap is non-trivial) but for
small-to-mid SVGs (under ~1000×1000 device-px) it's negligible.

### What to do if you don't know the path coordinates ahead of time

If the path is generated at runtime (e.g., via a library), generate it
at the largest size, then CSS-scale the wrapper down. Re-generating on
every animation frame to track the current scale defeats the purpose;
the SVG renderer would re-tessellate but the compositor cache would
still be stale until the next paint settles.

---

## When you can't invert the scale

Some scenarios don't fit the trick:

- **Content inside the SVG that scales differently from the squircle**
  (e.g., text labels that should always render at 12px regardless of
  zoom). Inverting the SVG baseline makes those texts render too small.
  Use `vector-effect="non-scaling-stroke"` for strokes and absolute
  font sizes inside the SVG to preserve readability.

- **SVGs with bitmap content** (`<image href=...>`). The bitmap
  upscales the same way the rasterised SVG does. Pre-rasterise the
  bitmap at the target zoom size, or use a separate `<img>` element
  outside the scaling wrapper.

- **Drag-to-zoom interactions** where the user picks K. Pick the
  largest K you support, author at that size, and scale down to the
  current zoom level. A "max K" can be effectively infinite for
  practical purposes if you author at a high enough baseline.

---

## Related WebKit tickets

- [Bug 27684 — Composited elements appear pixelated when scaled up](https://bugs.webkit.org/show_bug.cgi?id=27684)
- [Bug 224795 — Zooming browser does not properly scale SVG clip paths](https://bugs.webkit.org/show_bug.cgi?id=224795)
- [Bug 126207 — Master bug: clip-path](https://bugs.webkit.org/show_bug.cgi?id=126207)

Workarounds repeatedly reported as *ineffective*: `will-change`,
`translateZ(0)`, `backface-visibility: hidden`, and
`image-rendering: crisp-edges`. These promote compositing or hint at
quality but don't invalidate the cached raster on transform change.

---

## Summary

If your SVG sits inside something that scales up, the rendered curves
will look soft on Safari. Move the scale baseline so the SVG only ever
gets smaller. Render at the largest size, downscale by default.
