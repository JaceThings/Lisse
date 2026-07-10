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
 */
export function getLayoutSize(el: HTMLElement): { width: number; height: number } {
  const style = window.getComputedStyle(el);
  // Only a px value is a resolved used size. Width/height don't apply to
  // non-replaced inline elements, so their computed value survives as-is —
  // parseFloat("100%") would fabricate a 100px box that doesn't exist.
  const px = (v: string) => (v.endsWith("px") ? parseFloat(v) : NaN);
  const w = px(style.width);
  const h = px(style.height);

  if (Number.isNaN(w) || Number.isNaN(h)) {
    return { width: el.offsetWidth, height: el.offsetHeight };
  }
  if (style.boxSizing === "border-box") {
    return { width: w, height: h };
  }

  const padX = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
  const padY = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
  const bdrX = (parseFloat(style.borderLeftWidth) || 0) + (parseFloat(style.borderRightWidth) || 0);
  const bdrY = (parseFloat(style.borderTopWidth) || 0) + (parseFloat(style.borderBottomWidth) || 0);

  return { width: w + padX + bdrX, height: h + padY + bdrY };
}
