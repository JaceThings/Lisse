---
"@lisse/extension": patch
---

**Input borders no longer shift on GitHub and other Primer-styled sites.** Two separate causes, both visible on `github.com/settings/profile`.

- **The stroke layer inherited the site's `background-position`.** Primer sets `background-position: right 8px center` on `.form-control` for its validation icon. The SVG border was appended as a new background layer but every other background longhand was copied by hand in six places, and `position` was the one that got missed — so our stroke rode the site's offset and drew 8px left of the element's real edge. All six longhands now travel as one `BackgroundInput` object through a single read and a single write, and our layer is pinned at `0% 0%`.
- **The site's inset `box-shadow` kept painting beside the stroke.** Primer's `inset 0 1px 0 rgba(1,4,9,.24)` outranked our inline `box-shadow: none`, so a second, unclipped edge stayed on screen. The hide is now written with `important` priority, and it is released before each read pass so `:focus` rings are measured from the site's own value rather than ours.
