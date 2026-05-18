# Safari shadow rendering — the device-pixel snap problem

This is a survival guide for one specific WebKit bug class. **If you don't
ship shadows through `<SmoothCorners shadow={…}>` you can stop reading
— this document does not apply to you.**

If you do ship shadows, and your users are on Safari, read on.

---

## What you'll see

A `<SmoothCorners shadow={…}>` instance on macOS or iOS Safari renders
the drop-shadow with one of two visibly different appearances depending
on where the element happens to land in the page layout. Symptoms:

- The shadow on a card looks **noticeably heavier** than the shadow on
  another, otherwise-identical card a few rows away.
- A 1 px ring at the top edge of the shadow that's there sometimes
  and absent other times.
- Resizing the browser window by a single pixel (or scrolling, or
  adding a CSS line above the card) flips the appearance.
- Chrome / Firefox / Edge / any non-WebKit browser shows none of this.
  Both cards look identical on those engines.

The clip-path silhouette (the squircle outline) is unaffected. Only
the shadow rasterisation drifts.

---

## What's actually happening

WebKit rasterises SVG `<filter>` output (specifically `feGaussianBlur`)
with a biased antialiasing pass whose magnitude depends on the
filtered element's **device-pixel Y position**.

Concrete example on a 2× Retina display:

| CSS Y position | Device-pixel Y | Shadow renders |
|----------------|---------------:|----------------|
| `100.0 px`     | `200`          | clean          |
| `100.25 px`    | `200.5`        | heavier        |
| `100.5 px`     | `201`          | clean          |
| `100.75 px`    | `201.5`        | heavier        |

The threshold is on integer device pixels. Any time the element's
final compositor-layer position falls on a fractional device pixel,
the shadow rasterisation is biased; on integer device pixels it
rasterises cleanly.

Chromium (Skia) rasterises uniformly across sub-pixel positions, so
this isn't a problem there.

---

## Scope: this is *only* about shadows

The bug class is narrowly scoped:

| What you're rendering with SmoothCorners | Affected? |
|------------------------------------------|-----------|
| `clip-path` (the squircle silhouette)    | No        |
| `innerShadow`                            | No*       |
| `innerBorder` / `outerBorder` / `middleBorder` | No  |
| `shadow` (drop-shadow)                   | **Yes**   |

\* `innerShadow` paints inside the clipped element via SVG strokes; it
doesn't go through the `feGaussianBlur` path that exhibits the bias.

Same shape, same library, the bug only fires through the
`<filter>` chain that drop-shadow uses.

---

## The fix: place the element on integer device pixels

The library does not auto-correct this. Auto-correction at the
library level would either need to mutate the consumer's element
position (risky) or accept a per-frame `rAF` budget across every
shadowed surface on a page (expensive, and our experiments showed
the WebKit compositor sometimes silently rounds sub-pixel `transform`
values away anyway).

So the responsibility is yours. **Lay out your shadowed elements so
their bounding-box top-left lands on an integer device pixel.**

The recipe for a 2× Retina display:

1. Measure the element's `getBoundingClientRect().top` in CSS pixels.
2. Multiply by `window.devicePixelRatio` (which is `2` for Retina).
3. If the result is an integer, the element is already on the grid
   and renders cleanly. Stop.
4. If the result is fractional, calculate the CSS-pixel delta you'd
   need to push the element to nudge it back to an integer device pixel:
   `delta = (round(top × dpr) − top × dpr) ÷ dpr`.
5. Add that delta as `padding-top` (or `margin-top`, or a `top` offset
   on a `position: relative` ancestor) to whatever container the
   element lives in.

### Worked example

Your install row sits at `y = 692.75 CSS px`. On a 2× Retina display
that's `1385.5` device pixels — fractional, so the shadow will be
biased. The delta is `(round(1385.5) − 1385.5) ÷ 2 = 0.5 ÷ 2 = 0.25
CSS px`. Add `padding-top: 0.25px` to the row's container and the row
lands at `693.0 CSS px = 1386 device-px`, which is integer.

### Worked example, multiple elements at different offsets

Realistic case: the first card on a page might naturally land at
fractional device-px `X`, while a card further down lands at
fractional device-px `Y` because of accumulated content heights
above it. Different elements need different nudges. The fix is
per-container: you set `padding-top: 0.25px` (or whatever your
measurement showed) on the first card's container, and a different
nudge on the second card's container.

The lisse marketing site (`apps/website/`) is a working reference for
this pattern — the pills container in `Demo.tsx` and the install rows
container in `Install.tsx` both have explicit small `top` / `padding-top`
offsets baked in to land their cards on integer device pixels.

---

## Detecting whether you're affected

You can confirm in DevTools without writing any code:

1. Open your page in Safari.
2. Find a card with a shadow that looks "off."
3. In the console: `document.querySelector('YOUR_CARD_SELECTOR')
   .getBoundingClientRect().top * window.devicePixelRatio`.
4. If the result is fractional, you're hitting it.

You can also use the `<DebugMenu>` pattern from `apps/website/src/components/DebugMenu.tsx`
for a live readout — but that's a development scaffold; we don't ship
a packaged version of it.

---

## The opt-out: `shadowStrategy="box-shadow"`

If you can't reliably control your layout (third-party widgets,
animated content, etc.) and you don't care about the shadow tracing
the squircle silhouette exactly, you can side-step the WebKit
rasterisation pipeline altogether:

```tsx
<SmoothCorners
  corners={{ radius: 16, smoothing: 0.6 }}
  shadow={CARD_SHADOW}
  shadowStrategy="box-shadow"
>
  …
</SmoothCorners>
```

This renders the shadow as a native CSS `box-shadow` on a sibling
`<div>` behind the clipped child. CSS `box-shadow` is rasterised
through a different WebKit code path that does not exhibit the
bias. The trade-off: the shadow silhouette is a rounded
rectangle (following `border-radius`), not a squircle.

At the default smoothing of `0.6` and moderate radii (8–24 px) the
silhouette delta lives entirely inside the blur halo and is invisible
to anyone but a designer with a screenshot tool. At larger smoothing
values (`> 0.9`) or very wide corner radii (`> 32 px`) the silhouette
mismatch becomes visible.

---

## What we tried that didn't work

Recording these so future contributors don't burn time re-trying them:

1. **`transform: translate(δx, δy)` on the shadow SVG element only.**
   Snaps the SVG element to integer device-px relative to its
   ancestors. But WebKit rasterises filters off the compositor layer
   that owns the SVG, and that layer is owned by the anchor wrapper —
   moving just the SVG inside the wrapper changes its local position
   but not its layer position. No effect.

2. **`transform: translate(δx, δy)` on the wrapper element.**
   Snaps the wrapper to integer device-px. We could not consistently
   make this take visible effect on Safari — some Safari versions
   appear to silently snap sub-pixel `transform` values to integer
   compositor-layer coordinates. `translate3d(…, 0)` did not change
   the outcome.

3. **`filterUnits="userSpaceOnUse"` with a per-element pixel region.**
   This is in the library and does help — it removes one source of
   compositor-rounding drift. But it is not sufficient on its own to
   eliminate the bias.

4. **`-webkit-image-set` cursor cascade, `translateZ(0)` compositor
   promotion, `will-change: filter`.** These are all standard "force
   GPU compositing" tricks that do not address the rasterisation grid
   the filter samples on.

5. **Re-rendering the shadow as multiple stacked path strokes** to
   approximate the Gaussian blur without `<filter>`. Technically would
   work; not yet implemented because the path-stroke approximation
   compounds 4–6× the geometry per shadow layer for visually-good
   results, and the static-padding workaround is simpler.

---

## Why we don't auto-fix this in the library

We considered shipping the auto-snap in `@lisse/react`'s
`useSmoothCorners` hook. The implementation worked correctly in unit
tests (mathematically: a fractional position got the right
compensating `translate3d` written to it). The implementation did not
work in practice on Safari for the reasons above. Rather than ship a
per-frame `rAF` that silently does nothing, we removed it. If WebKit's
behaviour changes — or a more reliable mechanism is identified — the
library can ship the auto-fix transparently.

For now: the library renders the shadow correctly when the consumer
places their element on integer device pixels. The consumer owns the
layout, so the consumer owns the alignment.

---

## Related: SVG scale-up pixelation

A separate but adjacent WebKit bug: any SVG content (paths, clip-paths,
masks) inside a `transform: scale()`-d ancestor pixelates on Safari
because the compositor caches the raster at the element's layout size
and bilinear-upsamples on scale. The fix is to invert the scale
baseline — render at the largest size your animation needs, then
CSS-scale *down* by default. See
[docs/safari-svg-scale-rendering.md](./safari-svg-scale-rendering.md).
This is not Lisse-specific and affects any SVG content rendered
through a CSS transform.

## Related WebKit tickets

- [Bug 184511 — SVG antialias fail in Safari responsive design mode
  and iOS](https://bugs.webkit.org/show_bug.cgi?id=184511) (closest
  match to the symptom shape).
- [Bug 283156 — blur effects on SVG have performance issues](
  https://bugs.webkit.org/show_bug.cgi?id=283156) (related rasterisation
  pipeline).
- [Bug 89767 — SVG Filter Effect sub-region not applied for some filters](
  https://bugs.webkit.org/show_bug.cgi?id=89767) (filter-region math
  edge cases — fixed but the family of bugs persists).

No WebKit ticket explicitly names "fractional device-pixel Y toggles
shadow heaviness." Worth filing with a minimal reproduction.
