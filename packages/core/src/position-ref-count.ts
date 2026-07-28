const refCounts = new WeakMap<HTMLElement, number>();

/**
 * Ensure an anchor is positioned so the SVG effects overlay can sit on it.
 * Ref-counted: already-acquired anchors just increment. A static anchor
 * gets `position: relative` and counts as the first acquire. Returns false
 * when the anchor is non-static but not ours — caller bails out rather
 * than stomp on a user-set style. Pair with `releasePosition`.
 */
export function acquirePosition(anchor: HTMLElement): boolean {
  const count = refCounts.get(anchor) ?? 0;
  if (count > 0) {
    refCounts.set(anchor, count + 1);
    return true;
  }
  const pos = getComputedStyle(anchor).position;
  if (pos !== "static" && pos !== "") return false;
  refCounts.set(anchor, 1);
  anchor.style.position = "relative";
  return true;
}

/**
 * Decrement the ref count; the last release clears the inline `position`
 * applied by `acquirePosition`. A no-op when the anchor was never acquired
 * (we mustn't stomp a user-set inline style).
 */
export function releasePosition(anchor: HTMLElement): void {
  const count = refCounts.get(anchor);
  if (count === undefined) return;
  if (count <= 1) {
    refCounts.delete(anchor);
    anchor.style.position = "";
  } else {
    refCounts.set(anchor, count - 1);
  }
}

const isolationCounts = new WeakMap<HTMLElement, number>();
const savedIsolation = new WeakMap<HTMLElement, string>();

/**
 * Stacking context for the `z-index:-1` drop-shadow SVG. Ref-counted because a
 * whole grid routinely shares one anchor: saving per handle meant the second
 * captured the first's `isolate` and restored it on teardown.
 */
export function acquireIsolation(anchor: HTMLElement): void {
  const count = isolationCounts.get(anchor) ?? 0;
  if (count === 0) savedIsolation.set(anchor, anchor.style.isolation);
  isolationCounts.set(anchor, count + 1);
  anchor.style.isolation = "isolate";
}

export function releaseIsolation(anchor: HTMLElement): void {
  const count = isolationCounts.get(anchor);
  if (count === undefined) return;
  if (count <= 1) {
    isolationCounts.delete(anchor);
    anchor.style.isolation = savedIsolation.get(anchor) ?? "";
    savedIsolation.delete(anchor);
  } else {
    isolationCounts.set(anchor, count - 1);
  }
}
