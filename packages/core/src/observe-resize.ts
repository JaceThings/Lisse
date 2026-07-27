import { getLayoutSize } from "./layout-size.js";

/** Border-box size in CSS pixels, matching `getLayoutSize`'s contract. */
interface Size {
  width: number;
  height: number;
}

/**
 * Resize callback. Receives the element's border-box size as measured at the
 * start of this flush; callers may ignore it and re-measure. Extra parameters
 * are ignored by `() => void` callbacks, so this stays backward-compatible.
 */
type Callback = (size?: Size) => void;

let observer: ResizeObserver | null = null;
let rafId: number | undefined;
const callbackMap = new Map<Element, Set<Callback>>();
const pendingElements = new Set<Element>();

function flush() {
  rafId = undefined;
  const elements = [...pendingElements];
  pendingElements.clear();

  // READ PASS: resolve every element's size before any callback runs, so a
  // later callback's write can't invalidate an earlier callback's style read.
  // Batched like this it costs one style recalc for the whole flush.
  //
  // Measured here rather than taken from the `ResizeObserverEntry`: the entry's
  // `borderBoxSize` was captured when the RO fired, which is the frame *before*
  // this flush. Anything that resizes the element in between — a spring
  // committing a tween frame, most visibly — makes that size stale, and a
  // consumer clipping to a stale-larger box gets its corners cut off by the
  // element's own edge. A live read is never staler than the entry, so the
  // saved `getComputedStyle` wasn't worth the frame of skew.
  const sizes = new Map<Element, Size>();
  for (const el of elements) {
    if (callbackMap.has(el)) sizes.set(el, getLayoutSize(el as HTMLElement));
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
      for (const entry of entries) pendingElements.add(entry.target);
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
      obs.unobserve(el);
    }
    if (callbackMap.size === 0) {
      if (rafId !== undefined) {
        cancelAnimationFrame(rafId);
        rafId = undefined;
      }
      pendingElements.clear();
      observer?.disconnect();
      observer = null;
    }
  };
}
