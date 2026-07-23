import { getLayoutSize } from "./layout-size.js";

/** Border-box size in CSS pixels, matching `getLayoutSize`'s contract. */
interface Size {
  width: number;
  height: number;
}

/**
 * Resize callback. Receives the element's border-box size when the flush
 * could resolve one (from the `ResizeObserverEntry` or a measured fallback);
 * callers may ignore it and re-measure, or use it to skip a forced
 * `getComputedStyle`. Extra parameters are ignored by `() => void` callbacks,
 * so this stays backward-compatible.
 */
type Callback = (size?: Size) => void;

let observer: ResizeObserver | null = null;
let rafId: number | undefined;
const callbackMap = new Map<Element, Set<Callback>>();
const pendingElements = new Set<Element>();
// Border-box size captured from the most recent RO entry for a pending
// element, consumed on the next flush. Lets callbacks skip the forced
// `getComputedStyle` in `getLayoutSize` on RO ticks.
const pendingSizes = new Map<Element, Size>();

/**
 * Extract a border-box size from an entry, in CSS pixels and independent of
 * transforms — exactly what `getLayoutSize` reports, so no padding/border
 * compensation is needed (border-box is border-box regardless of box-sizing).
 *
 * The spec exposes `borderBoxSize` as an array; some engines expose a bare
 * `ResizeObserverSize`. Both forms are handled; engines that omit it entirely
 * fall through to the measured path. Sizes map from the inline/block axes of
 * the default horizontal-tb writing mode Lisse targets.
 */
function entrySize(entry: ResizeObserverEntry): Size | undefined {
  const bb = entry.borderBoxSize as
    | ReadonlyArray<ResizeObserverSize>
    | ResizeObserverSize
    | undefined;
  if (!bb) return undefined;
  const box = Array.isArray(bb) ? bb[0] : (bb as ResizeObserverSize);
  if (!box) return undefined;
  return { width: box.inlineSize, height: box.blockSize };
}

function flush() {
  rafId = undefined;
  const elements = [...pendingElements];
  pendingElements.clear();

  // READ PASS: resolve every element's size before any callback runs, so a
  // later callback's write can't invalidate an earlier callback's style read.
  // RO-provided sizes cost nothing; the rest fall back to a measured read
  // here, still ahead of every write.
  const sizes = new Map<Element, Size | undefined>();
  for (const el of elements) {
    let size = pendingSizes.get(el);
    pendingSizes.delete(el);
    if (!size && callbackMap.has(el)) {
      size = getLayoutSize(el as HTMLElement);
    }
    sizes.set(el, size);
  }

  // WRITE PASS: invoke callbacks with the pre-read size.
  for (const el of elements) {
    const cbs = callbackMap.get(el);
    // Snapshot: a callback may sync-unsubscribe a sibling (e.g. an unmount
    // triggered by the first sync's layout) and could otherwise disconnect
    // the shared observer mid-flush.
    if (cbs) {
      const size = sizes.get(el);
      for (const cb of [...cbs]) cb(size);
    }
  }
}

function getObserver(): ResizeObserver {
  if (!observer) {
    observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        pendingElements.add(entry.target);
        const size = entrySize(entry);
        if (size) pendingSizes.set(entry.target, size);
      }
      if (rafId === undefined) {
        rafId = requestAnimationFrame(flush);
      }
    });
  }
  return observer;
}

/**
 * Observe `el` for resize via a shared ResizeObserver; callbacks are
 * rAF-batched (one frame per tick, across all observed elements) with an
 * immediate initial dispatch. The returned function unsubscribes; the
 * observer disconnects once the last element is released.
 */
export function observeResize(el: Element, callback: Callback): () => void {
  if (typeof ResizeObserver === "undefined") return () => {};

  const obs = getObserver();
  let set = callbackMap.get(el);
  if (!set) {
    set = new Set();
    callbackMap.set(el, set);
    obs.observe(el);
  }
  set.add(callback);

  pendingElements.add(el);
  if (rafId === undefined) {
    rafId = requestAnimationFrame(flush);
  }

  // Guard against double-invocation: a second call after the observer has
  // been torn down and rebuilt could otherwise delete a *new* subscriber's
  // registration for the same element (the `set` closed over here is stale).
  let done = false;
  return () => {
    if (done) return;
    done = true;
    set!.delete(callback);
    if (set!.size === 0) {
      callbackMap.delete(el);
      pendingSizes.delete(el);
      obs.unobserve(el);
    }
    if (callbackMap.size === 0) {
      if (rafId !== undefined) {
        cancelAnimationFrame(rafId);
        rafId = undefined;
      }
      pendingElements.clear();
      pendingSizes.clear();
      observer?.disconnect();
      observer = null;
    }
  };
}
