// Two places need this: Collapse swaps its animation pipeline, Preview
// swaps its shadow render path. Both motivated by Safari rendering
// bottlenecks (SVG filter rasterisation runs software-side, grid track
// transitions can't promote to a compositor layer). Module-level const
// — `navigator.userAgent` is stable for the page lifetime, so we resolve
// once on import.
export const IS_SAFARI =
  typeof navigator !== "undefined" &&
  /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
