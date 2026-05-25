# Gotchas

Lisse applies `clip-path` at the DOM level to carve the squircle shape. Because the clip is enforced by the browser on the clipped element and every descendant, there are three interaction quirks worth knowing before you wire it into an existing design system.

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
