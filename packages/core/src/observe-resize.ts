type Callback = () => void;

let observer: ResizeObserver | null = null;
let rafId: number | undefined;
const callbackMap = new Map<Element, Set<Callback>>();
const pendingElements = new Set<Element>();

function flush() {
  rafId = undefined;
  const elements = [...pendingElements];
  pendingElements.clear();
  for (const el of elements) {
    const cbs = callbackMap.get(el);
    // Snapshot: a callback may sync-unsubscribe a sibling (e.g. an unmount
    // triggered by the first sync's layout) and could otherwise disconnect
    // the shared observer mid-flush.
    if (cbs) for (const cb of [...cbs]) cb();
  }
}

function getObserver(): ResizeObserver {
  if (!observer) {
    observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        pendingElements.add(entry.target);
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

  return () => {
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
