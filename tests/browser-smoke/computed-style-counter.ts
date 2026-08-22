// Shared instrument for the per-adapter computed-style budgets.
//
// Every computed-style read is a style/layout flush point. Mounting a page of
// squircles interleaves reads with the writes each squircle makes (clip-path,
// border strip, overlay placement), so N redundant reads cost N extra recalcs
// of the whole document — the cost profiles as self time inside Lisse.
//
// happy-dom has no layout, so this budget can only be pinned in a real engine.
// The counter keys on the element identity `getComputedStyle` was handed, which
// is what the reporter's DevTools counting did.

export interface Counter {
  /** Reads charged to `el` since `install`. */
  count(el: Element): number;
  /** Every counted element, most-read first. */
  ranked(): Array<{ el: Element; reads: number }>;
  reset(): void;
  restore(): void;
}

export function installCounter(): Counter {
  const counts = new Map<Element, number>();
  const original = window.getComputedStyle;
  window.getComputedStyle = function patched(
    el: Element,
    pseudo?: string | null,
  ): CSSStyleDeclaration {
    counts.set(el, (counts.get(el) ?? 0) + 1);
    return original.call(window, el, pseudo);
  } as typeof window.getComputedStyle;

  return {
    count: (el) => counts.get(el) ?? 0,
    ranked: () =>
      [...counts].map(([el, reads]) => ({ el, reads })).sort((a, b) => b.reads - a.reads),
    reset: () => counts.clear(),
    restore: () => {
      window.getComputedStyle = original;
    },
  };
}

/** Resolve after `ms` of wall clock. */
export function delay(ms: number): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, ms);
  return promise;
}

/** Resolve after two animation frames. */
function twoFrames(): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>();
  requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  return promise;
}

/** Two frames plus a macrotask: enough for the rAF flush and any follow-up. */
export async function settle(): Promise<void> {
  await twoFrames();
  await delay(50);
}

// One read per element is the floor: the size the clip-path is generated from
// has to come from a live read at least once. Auto-extraction supplies that
// read for the mount sync, and the rAF flush takes a second — deliberately
// live rather than reusing the ResizeObserver entry, which is a frame stale by
// the time the flush runs and would clip an animating element to a stale box.
export const MOUNT_BUDGET = 2;
