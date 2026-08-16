import { getLayoutSize, type MeasuredSize } from "./layout-size.js";

/**
 * Border-box size per `getLayoutSize`, plus the element's offset within its
 * `offsetParent`. The offset rides along so consumers never read it in the write
 * pass, where it would force a relayout per element.
 */
export interface Measured extends MeasuredSize {
  offsetLeft: number;
  offsetTop: number;
}

/**
 * Receives what was measured at the start of this flush; callers may ignore it
 * and re-measure. Extra parameters are ignored by `() => void` callbacks, so
 * this stays backward-compatible.
 */
type Callback = (measured?: Measured) => void;

let observer: ResizeObserver | null = null;
let rafId: number | undefined;
const callbackMap = new Map<Element, Set<Callback>>();
const pendingElements = new Set<Element>();

/**
 * What the last flush measured for each element, so the observer callback can
 * tell a notification that carries news from one that reports a box we already
 * have. `horizontal` records whether that measurement was taken in a horizontal
 * writing mode, because `borderBoxSize` is inline/block relative and only maps
 * onto width/height there.
 */
const lastMeasured = new WeakMap<Element, { width: number; height: number; horizontal: boolean }>();

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
  //
  // The entry is still good for the opposite question, which the observer
  // callback asks: does this notification report the size we already measured?
  // If so it carries no news and needs no read at all. The accepted cost is one
  // frame in a narrow case — if the element's box changes between the observer's
  // snapshot and our rAF, and the snapshot happened to report exactly our last
  // measured size, the re-clip lands a frame later, because the observer
  // necessarily fires again with the new box.
  const sizes = new Map<Element, Measured>();
  for (const el of elements) {
    if (!callbackMap.has(el)) continue;
    const node = el as HTMLElement;
    const cs = window.getComputedStyle(node);
    const size = getLayoutSize(node, cs);
    // An element that specifies no writing mode of its own resolves to "" under
    // happy-dom, and so does a detached element in Chrome; the CSS initial value
    // is horizontal-tb, so "" is horizontal.
    lastMeasured.set(el, {
      width: size.width,
      height: size.height,
      horizontal: cs.writingMode === "horizontal-tb" || cs.writingMode === "",
    });
    sizes.set(el, { ...size, offsetLeft: node.offsetLeft, offsetTop: node.offsetTop });
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
      let queued = false;
      for (const entry of entries) {
        const last = lastMeasured.get(entry.target);
        const box = entry.borderBoxSize?.[0];
        // A notification reporting the box the last flush already measured is a
        // no-op: the RO's guaranteed initial observation for a freshly observed
        // element is exactly that, arriving a frame after subscribe already
        // queued and measured it, and re-measuring costs a style recalc for a
        // size we hold. Only sound in a horizontal writing mode — `borderBoxSize`
        // is inline/block relative, so a vertical-mode element whose resize
        // transposed its box would compare equal here and be wrongly skipped;
        // that one falls through to a live measure.
        if (last?.horizontal && box && box.inlineSize === last.width && box.blockSize === last.height) {
          continue;
        }
        pendingElements.add(entry.target);
        queued = true;
      }
      if (queued && rafId === undefined) {
        rafId = requestAnimationFrame(flush);
      }
    });
  }
  return observer;
}

/**
 * Queue `el` for the next batched flush without reading layout. For work driven
 * by something other than `el`'s own resize, where measuring inline would land
 * in the write pass. Costs one frame. No-op if `el` isn't observed.
 *
 * Queues unconditionally: unlike an observer notification there is no entry box
 * to recognise as already-measured, and the caller asked precisely because
 * something other than `el` changed what `el` should render.
 */
export function requestMeasure(el: Element): void {
  if (!callbackMap.has(el)) return;
  pendingElements.add(el);
  if (rafId === undefined) {
    rafId = requestAnimationFrame(flush);
  }
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
      // A later re-subscribe re-observes from scratch, and its first
      // notification must not be dismissed against a size measured in a
      // previous life of this element.
      lastMeasured.delete(el);
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

/**
 * Re-measure `target` whenever `anchor` resizes.
 *
 * Skips the anchor's first dispatch. That one comes from the anchor's own
 * subscribe-time queueing, in the same flush that already measured `target` for
 * `target`'s own subscribe — re-queueing there buys nothing and costs `target` a
 * whole extra flush read.
 */
export function observeAnchor(anchor: Element, target: Element): () => void {
  let first = true;
  return observeResize(anchor, () => {
    if (first) {
      first = false;
      return;
    }
    requestMeasure(target);
  });
}
