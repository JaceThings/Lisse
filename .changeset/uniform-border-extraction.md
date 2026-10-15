---
"@lisse/core": patch
---

**Auto-extracted borders no longer shift content on `border-box` elements.** The stripped border width now moves into padding under either `box-sizing`, as it already did on `content-box`. A border is also only extracted when all four sides share the same style, width and color; a one-sided or mixed border used to be redrawn as a full ring from its top side, and is now left as CSS.
