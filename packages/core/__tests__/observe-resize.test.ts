// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";

let observeResize: typeof import("../src/observe-resize.js").observeResize;

let roCallback: ResizeObserverCallback;
let observedElements: Set<Element>;
const mockObserve = vi.fn((el: Element) => observedElements.add(el));
const mockUnobserve = vi.fn((el: Element) => observedElements.delete(el));
const mockDisconnect = vi.fn(() => observedElements.clear());

let rafCallbacks: Map<number, FrameRequestCallback>;
let nextRafId: number;

beforeEach(async () => {
  vi.resetModules();

  observedElements = new Set();
  rafCallbacks = new Map();
  nextRafId = 1;

  vi.stubGlobal("ResizeObserver", class {
    constructor(cb: ResizeObserverCallback) { roCallback = cb; }
    observe = mockObserve;
    unobserve = mockUnobserve;
    disconnect = mockDisconnect;
  });

  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    const id = nextRafId++;
    rafCallbacks.set(id, cb);
    return id;
  });

  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    rafCallbacks.delete(id);
  });

  mockObserve.mockClear();
  mockUnobserve.mockClear();
  mockDisconnect.mockClear();

  const mod = await import("../src/observe-resize.js");
  observeResize = mod.observeResize;
});

function flushRaf() {
  const cbs = [...rafCallbacks.values()];
  rafCallbacks.clear();
  for (const cb of cbs) cb(performance.now());
}

function triggerResize(...elements: Element[]) {
  const entries = elements.map((target) => ({ target } as ResizeObserverEntry));
  roCallback(entries, {} as ResizeObserver);
}

// Resize with a border-box size on the entry. The flush ignores it and
// measures live, so this exists to prove the entry's size can't leak through.
function triggerResizeSized(el: Element, width: number, height: number) {
  const borderBoxSize = [{ inlineSize: width, blockSize: height } as ResizeObserverSize];
  roCallback(
    [{ target: el, borderBoxSize } as unknown as ResizeObserverEntry],
    {} as ResizeObserver,
  );
}

describe("observeResize", () => {
  it("fires initial callback after rAF flush", () => {
    const el = document.createElement("div");
    const cb = vi.fn();
    observeResize(el, cb);

    expect(cb).not.toHaveBeenCalled();
    flushRaf();
    expect(cb).toHaveBeenCalledOnce();
  });

  it("fires multiple callbacks on same element", () => {
    const el = document.createElement("div");
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    observeResize(el, cb1);
    observeResize(el, cb2);

    flushRaf();
    expect(cb1).toHaveBeenCalledOnce();
    expect(cb2).toHaveBeenCalledOnce();
  });

  it("only fires callbacks for the resized element", () => {
    const el1 = document.createElement("div");
    const el2 = document.createElement("div");
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    observeResize(el1, cb1);
    observeResize(el2, cb2);

    flushRaf();
    cb1.mockClear();
    cb2.mockClear();

    triggerResize(el1);
    flushRaf();
    expect(cb1).toHaveBeenCalledOnce();
    expect(cb2).not.toHaveBeenCalled();
  });

  it("batches two element resizes into one rAF frame", () => {
    const el1 = document.createElement("div");
    const el2 = document.createElement("div");
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    observeResize(el1, cb1);
    observeResize(el2, cb2);

    flushRaf();
    cb1.mockClear();
    cb2.mockClear();

    triggerResize(el1, el2);
    expect(rafCallbacks.size).toBe(1);
    flushRaf();
    expect(cb1).toHaveBeenCalledOnce();
    expect(cb2).toHaveBeenCalledOnce();
  });

  it("removing one callback leaves element observed; remaining callback still fires", () => {
    const el = document.createElement("div");
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    observeResize(el, cb1);
    const unsub2 = observeResize(el, cb2);

    flushRaf();
    cb1.mockClear();
    cb2.mockClear();

    unsub2();
    expect(mockUnobserve).not.toHaveBeenCalled();

    triggerResize(el);
    flushRaf();
    expect(cb1).toHaveBeenCalledOnce();
    expect(cb2).not.toHaveBeenCalled();
  });

  it("removing last callback calls unobserve on that element", () => {
    const el = document.createElement("div");
    const cb = vi.fn();
    const unsub = observeResize(el, cb);

    flushRaf();
    unsub();
    expect(mockUnobserve).toHaveBeenCalledWith(el);
  });

  it("removing all elements calls disconnect and cancelAnimationFrame", () => {
    const el1 = document.createElement("div");
    const el2 = document.createElement("div");
    const unsub1 = observeResize(el1, vi.fn());
    const unsub2 = observeResize(el2, vi.fn());

    unsub1();
    expect(mockDisconnect).not.toHaveBeenCalled();

    unsub2();
    expect(mockDisconnect).toHaveBeenCalledOnce();
  });

  it("returns noop when ResizeObserver is undefined", async () => {
    vi.resetModules();
    vi.stubGlobal("ResizeObserver", undefined);

    const mod = await import("../src/observe-resize.js");
    const el = document.createElement("div");
    const unsub = mod.observeResize(el, vi.fn());
    expect(unsub).toBeTypeOf("function");
    expect(() => unsub()).not.toThrow();
  });

  it("unsubscribe is idempotent", () => {
    const el = document.createElement("div");
    const unsub = observeResize(el, vi.fn());
    flushRaf();

    unsub();
    expect(() => unsub()).not.toThrow();
  });

  it("rAF cancelled on immediate full cleanup before flush", () => {
    const el = document.createElement("div");
    const unsub = observeResize(el, vi.fn());

    expect(rafCallbacks.size).toBe(1);
    unsub();
    expect(rafCallbacks.size).toBe(0);
  });

  it("reports the element's border-box size on a resize tick", () => {
    const el = document.createElement("div");
    const cb = vi.fn();
    observeResize(el, cb);
    flushRaf();
    cb.mockClear();

    vi.spyOn(window, "getComputedStyle").mockReturnValue(
      { width: "200px", height: "100px", boxSizing: "border-box" } as CSSStyleDeclaration,
    );
    triggerResizeSized(el, 200, 100);
    flushRaf();

    expect(cb).toHaveBeenCalledOnce();
    expect(cb).toHaveBeenCalledWith(expect.objectContaining({ width: 200, height: 100 }));
    expect(cb).toHaveBeenCalledWith(
      expect.objectContaining({ offsetLeft: expect.any(Number), offsetTop: expect.any(Number) }),
    );
  });

  // The regression that produced chopped capsule corners mid-morph: the RO
  // fires in frame N, the flush runs in frame N+1, and by then a spring has
  // committed a new size. A size captured from the entry is a frame stale —
  // during a shrink it describes a *larger* box, so the clip-path it produces
  // gets cut off by the element's own edge.
  it("measures at flush time, not from a size captured a frame earlier", () => {
    const el = document.createElement("div");
    const cb = vi.fn();
    observeResize(el, cb);
    flushRaf();
    cb.mockClear();

    // Frame N: the RO reports the pre-morph horizontal capsule.
    triggerResizeSized(el, 210, 84);
    // Frame N+1, before the flush: the spring commits the vertical target.
    vi.spyOn(window, "getComputedStyle").mockReturnValue(
      { width: "84px", height: "210px", boxSizing: "border-box" } as CSSStyleDeclaration,
    );
    flushRaf();

    expect(cb).toHaveBeenCalledWith(expect.objectContaining({ width: 84, height: 210 }));
  });

  it("falls back to offset* when computed style has no resolved size", () => {
    const el = document.createElement("div");
    Object.defineProperty(el, "offsetWidth", { value: 150, configurable: true });
    Object.defineProperty(el, "offsetHeight", { value: 60, configurable: true });
    const cb = vi.fn();
    observeResize(el, cb);
    flushRaf();
    cb.mockClear();

    const gcs = vi
      .spyOn(window, "getComputedStyle")
      .mockReturnValue({ width: "auto", height: "auto", boxSizing: "content-box" } as CSSStyleDeclaration);
    triggerResize(el);
    flushRaf();

    expect(gcs).toHaveBeenCalledWith(el);
    expect(cb).toHaveBeenCalledWith(expect.objectContaining({ width: 150, height: 60 }));
  });

  it("performs all reads before any writes across multiple observed elements", () => {
    const log: string[] = [];
    vi.spyOn(window, "getComputedStyle").mockImplementation(((el: Element) => {
      log.push(`read:${(el as HTMLElement).id}`);
      return { width: "auto", height: "auto", boxSizing: "content-box" } as CSSStyleDeclaration;
    }) as typeof window.getComputedStyle);

    const el1 = document.createElement("div");
    el1.id = "a";
    const el2 = document.createElement("div");
    el2.id = "b";
    observeResize(el1, () => log.push("write:a"));
    observeResize(el2, () => log.push("write:b"));

    flushRaf();

    expect(log).toEqual(["read:a", "read:b", "write:a", "write:b"]);
    const firstWrite = log.findIndex((e) => e.startsWith("write:"));
    const lastRead = log.map((e) => e.startsWith("read:")).lastIndexOf(true);
    expect(lastRead).toBeLessThan(firstWrite);
  });

  it("snapshots the callback set during flush so sibling unsubscribe mid-tick is safe", () => {
    // Regression: if a callback synchronously unsubscribes a sibling on the
    // same element, iterating the live Set would skip the sibling and — in
    // the worst case, when both are the only observers — disconnect the
    // shared observer mid-flush. Snapshotting the Set before iteration
    // guarantees the sibling still fires exactly once for this tick.
    const el = document.createElement("div");
    const cb2 = vi.fn();
    let unsub2: () => void;
    const cb1 = vi.fn(() => {
      unsub2();
    });
    observeResize(el, cb1);
    unsub2 = observeResize(el, cb2);

    flushRaf();
    expect(cb1).toHaveBeenCalledOnce();
    expect(cb2).toHaveBeenCalledOnce();
  });

  it("unsubscribe is idempotent — a stray double-call can't evict a re-subscription", () => {
    // Regression: the returned unsubscribe closes over the element's callback
    // Set. After it tears the last subscriber down (observer disconnects), a
    // second call would still run `set.delete` + the empty-set branch, which —
    // once a NEW subscriber has re-registered the same element — would delete
    // the new subscriber's registration and unobserve it. A `done` guard makes
    // the second call a no-op.
    const el = document.createElement("div");
    const cbA = vi.fn();
    const unsubA = observeResize(el, cbA);
    flushRaf();

    unsubA(); // full teardown: observer disconnects, element unobserved.

    const cbB = vi.fn();
    observeResize(el, cbB); // rebuild: fresh Set + re-observe.

    unsubA(); // stray double-call — must NOT touch B's registration.

    triggerResize(el);
    flushRaf();

    expect(cbB).toHaveBeenCalled();
  });
});
