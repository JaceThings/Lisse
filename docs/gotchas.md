# Gotchas

Lisse applies `clip-path` at the DOM level to carve the squircle shape. Because the clip is enforced by the browser on the clipped element and every descendant, there are four interaction quirks worth knowing before you wire it into an existing design system.

## Focus outlines are clipped

`clip-path` crops focus rings at the squircle edge, so the outline you get on `:focus-visible` disappears around the corners.

Workarounds:
- Push the outline outside the clip with `outline-offset`.
- Replace the outline with a `box-shadow` ring on a parent element.
- Use the auto-extracted `innerBorder` as the focus indicator so it follows the squircle.

## Overflowing descendants are clipped

Children that paint outside the clipped bounds — a tooltip popping out of a card, a dropdown menu, a hover lift — are cropped at the squircle edge.

Workarounds:
- Render the overflowing child in a portal.
- Use a sibling that is NOT a descendant of the clipped container.

## Scrollbars on scrollable children are clipped

A `<div style="overflow: auto">` inside a Lisse-clipped container has its scrollbar cropped at the corners, making the scroll thumb look chopped.

Workarounds:
- Move the scroll container outside the clipped element.
- Wrap the scroll container itself with Lisse rather than a parent.

## A CSS `border` under `clip-path` thins at the corners

Putting `clip-path` on an element that still paints its own `border` gives a ring that is `w` wide along the edges and at the 45° apex but visibly thinner either side of the apex — about 0.75`w` for a 2px border on a 40px radius, less noticeable as `w` grows relative to the radius.

The clip only changes the outer edge. The inner edge of a CSS border is still the browser's rounded rectangle: per CSS Backgrounds and Borders Level 3 (§5.4, corner shaping) its corner radius is the outer radius minus the border width, `max(0, R − w)`, which is a circular arc. A smooth corner leaves the straight edge earlier than a circular one — at `(1 + smoothing) · R` from the corner instead of `R` — and eases into its arc, so near those tangent points it sits inside the circular corner and meets it only at the apex. The ring is the gap between a squircle outside and a circle inside, which is uniform nowhere but the apex.

Workarounds:
- Use `innerBorder`, or let auto-effects extract the element's border. Both stroke the squircle path at `2w` and clip it to the path, so the inner edge is the exact offset of the outer one.
- Drawing it yourself: stroke the same path at `2w` and clip with the path, or stroke it at `w` along a path inset by `w / 2` with radius `R − w / 2`. Do not keep the CSS border.
- Nesting works: a child clipped to radius `R − w`, inset by `w`, forms a ring that is uniform to within a few percent.
