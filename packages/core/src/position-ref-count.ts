const refCounts = new WeakMap<HTMLElement, number>();

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

export function releasePosition(anchor: HTMLElement): void {
  const count = refCounts.get(anchor) ?? 0;
  if (count <= 1) {
    refCounts.delete(anchor);
    anchor.style.position = "";
  } else {
    refCounts.set(anchor, count - 1);
  }
}
