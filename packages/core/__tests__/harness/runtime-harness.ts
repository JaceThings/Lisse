// Deterministic ResizeObserver + requestAnimationFrame test harness.
//
// observe-resize.ts batches callbacks via rAF and dedupes per element.
// happy-dom runs rAF asynchronously, so "did exactly one update fire"
// is hard to express without controlling both surfaces. This harness
// stubs ResizeObserver and the rAF queue so tests can deliver resize
// entries synchronously and flush rAF on demand.

interface RafTask {
  id: number;
  cb: FrameRequestCallback;
}

class StubResizeObserver {
  static instances: StubResizeObserver[] = [];
  callback: ResizeObserverCallback;
  observed = new Set<Element>();

  constructor(cb: ResizeObserverCallback) {
    this.callback = cb;
    StubResizeObserver.instances.push(this);
  }
  observe(el: Element): void {
    this.observed.add(el);
  }
  unobserve(el: Element): void {
    this.observed.delete(el);
  }
  disconnect(): void {
    this.observed.clear();
    StubResizeObserver.instances = StubResizeObserver.instances.filter((o) => o !== this);
  }
}

export interface RuntimeHarness {
  /** Run every rAF callback queued so far, in FIFO order. */
  flushRaf(): void;
  /** Synchronously deliver a resize entry for `target` to every
   *  observer that has it under observation. */
  deliverResize(target: Element, width?: number, height?: number): void;
  /** Number of live stub observer instances (after disconnect()). */
  observerCount(): number;
  /** Whether `target` is observed by any live observer. */
  isObserved(target: Element): boolean;
  /** Pending rAF task count. */
  pendingRafCount(): number;
}

let savedRaf: typeof requestAnimationFrame | undefined;
let savedCancelRaf: typeof cancelAnimationFrame | undefined;
let savedResizeObserver: typeof ResizeObserver | undefined;
let rafQueue: RafTask[] = [];
let nextRafId = 0;

export function installHarness(): RuntimeHarness {
  savedRaf = globalThis.requestAnimationFrame;
  savedCancelRaf = globalThis.cancelAnimationFrame;
  savedResizeObserver = (globalThis as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;

  rafQueue = [];
  nextRafId = 0;
  StubResizeObserver.instances = [];

  (globalThis as { ResizeObserver: typeof StubResizeObserver }).ResizeObserver = StubResizeObserver;
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback): number => {
    const id = ++nextRafId;
    rafQueue.push({ id, cb });
    return id;
  }) as typeof requestAnimationFrame;
  globalThis.cancelAnimationFrame = ((id: number): void => {
    rafQueue = rafQueue.filter((t) => t.id !== id);
  }) as typeof cancelAnimationFrame;

  return {
    flushRaf(): void {
      const tasks = rafQueue;
      rafQueue = [];
      for (const t of tasks) t.cb(performance.now());
    },
    deliverResize(target, width = 200, height = 100): void {
      const contentRect = {
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: width,
        bottom: height,
        width,
        height,
        toJSON: () => ({}),
      } as DOMRectReadOnly;
      const entry = {
        target,
        contentRect,
        borderBoxSize: [{ inlineSize: width, blockSize: height }],
        contentBoxSize: [{ inlineSize: width, blockSize: height }],
        devicePixelContentBoxSize: [{ inlineSize: width, blockSize: height }],
      } as unknown as ResizeObserverEntry;
      for (const obs of StubResizeObserver.instances) {
        if (obs.observed.has(target)) obs.callback([entry], obs as unknown as ResizeObserver);
      }
    },
    observerCount(): number {
      return StubResizeObserver.instances.length;
    },
    isObserved(target: Element): boolean {
      return StubResizeObserver.instances.some((o) => o.observed.has(target));
    },
    pendingRafCount(): number {
      return rafQueue.length;
    },
  };
}

export function uninstallHarness(): void {
  if (savedRaf) globalThis.requestAnimationFrame = savedRaf;
  if (savedCancelRaf) globalThis.cancelAnimationFrame = savedCancelRaf;
  if (savedResizeObserver) {
    (globalThis as { ResizeObserver: typeof ResizeObserver }).ResizeObserver = savedResizeObserver;
  } else {
    delete (globalThis as { ResizeObserver?: unknown }).ResizeObserver;
  }
  rafQueue = [];
  StubResizeObserver.instances = [];
}
