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
    if (cbs) for (const cb of cbs) cb();
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
 * Observe an element for resize using a single shared ResizeObserver.
 * Callbacks are rAF-batched: one requestAnimationFrame per frame for all
 * observed elements. An initial callback is scheduled immediately.
 *
 * @returns Unsubscribe function. Calling it stops observation for this
 *          callback. When the last callback for an element is removed,
 *          the element is unobserved. When no elements remain, the
 *          shared observer is disconnected.
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

  // Schedule initial callback in the current rAF batch
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
