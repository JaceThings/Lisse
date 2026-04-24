const refCounts = new WeakMap<HTMLElement, number>();

/**
 * Ensure an anchor element is positioned so the SVG effects overlay can
 * sit on top of it. Ref-counted: if the anchor already has non-static
 * positioning (user-set or from a previous acquire), this returns true
 * without touching it. If the anchor is static, `position: relative` is
 * applied and the count is incremented. Returns false when the anchor is
 * non-static but not managed by this library -- caller should bail out
 * rather than stomp on user styles.
 *
 * Always pair with `releasePosition` on the same anchor.
 */
export function acquirePosition(anchor: HTMLElement): boolean {
  const count = refCounts.get(anchor) ?? 0;
  if (count > 0) {
    // Already managed by us -- just increment
    refCounts.set(anchor, count + 1);
    return true;
  }
  // First acquire: only proceed if position is static (not user-set)
  const pos = getComputedStyle(anchor).position;
  if (pos !== "static" && pos !== "") return false;
  refCounts.set(anchor, 1);
  anchor.style.position = "relative";
  return true;
}

/**
 * Counterpart to `acquirePosition`. Decrements the ref count; when the
 * last acquirer releases, the inline `position` style applied by
 * `acquirePosition` is cleared.
 */
export function releasePosition(anchor: HTMLElement): void {
  const count = refCounts.get(anchor) ?? 0;
  if (count <= 1) {
    refCounts.delete(anchor);
    anchor.style.position = "";
  } else {
    refCounts.set(anchor, count - 1);
  }
}
