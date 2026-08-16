/** A border-box size in CSS pixels, at float precision. */
export interface MeasuredSize {
  width: number;
  height: number;
}

/** The computed-style fields the border-box math reads. */
export type LayoutStyleSource = Pick<
  CSSStyleDeclaration,
  | "width"
  | "height"
  | "boxSizing"
  | "paddingTop"
  | "paddingRight"
  | "paddingBottom"
  | "paddingLeft"
  | "borderTopWidth"
  | "borderRightWidth"
  | "borderBottomWidth"
  | "borderLeftWidth"
>;

/**
 * Read an element's border-box in CSS pixels with float precision,
 * ignoring transforms on the element or any ancestor.
 *
 * - `getBoundingClientRect` folds in ancestor transforms (an element
 *   under `transform: scale(K)` would clip to K× its layout size).
 * - `offsetWidth/offsetHeight` ignore transforms (good) but round to
 *   integers — a fractional layout height (e.g. 28.8 px from
 *   line-height × font-size) leaves a sub-pixel sliver of un-clipped
 *   paint at the edge.
 * - `getComputedStyle.width/height` is the resolved used value in CSS
 *   pixels at full float precision. On `border-box` it's already the
 *   border-box; on `content-box` we add padding + border to recover it.
 *
 * Falls back to `offset*` in non-browser environments (happy-dom under
 * test) where `getComputedStyle` may return `"auto"` or "".
 *
 * Pass a pre-read `cs` to reuse an existing `getComputedStyle` result (its
 * values must be snapshotted before any layout-dirtying write — computed
 * style is live); omit it and the element's computed style is read here.
 */
export function getLayoutSize(
  el: HTMLElement,
  cs: LayoutStyleSource = window.getComputedStyle(el),
): MeasuredSize {
  // Only a px value is a resolved used size. Width/height don't apply to
  // non-replaced inline elements, so their computed value survives as-is —
  // parseFloat("100%") would fabricate a 100px box that doesn't exist.
  const px = (v: string) => (v.endsWith("px") ? parseFloat(v) : NaN);
  const w = px(cs.width);
  const h = px(cs.height);

  if (Number.isNaN(w) || Number.isNaN(h)) {
    return { width: el.offsetWidth, height: el.offsetHeight };
  }
  if (cs.boxSizing === "border-box") {
    return { width: w, height: h };
  }

  const padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
  const padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
  const bdrX = (parseFloat(cs.borderLeftWidth) || 0) + (parseFloat(cs.borderRightWidth) || 0);
  const bdrY = (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.borderBottomWidth) || 0);

  return { width: w + padX + bdrX, height: h + padY + bdrY };
}
