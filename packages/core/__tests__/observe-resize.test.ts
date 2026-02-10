// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";

let observeResize: typeof import("../src/observe-resize.js").observeResize;

// Mock ResizeObserver
let roCallback: ResizeObserverCallback;
let observedElements: Set<Element>;
const mockObserve = vi.fn((el: Element) => observedElements.add(el));
const mockUnobserve = vi.fn((el: Element) => observedElements.delete(el));
const mockDisconnect = vi.fn(() => observedElements.clear());

// Mock rAF
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

    // Flush initial callbacks
    flushRaf();
    cb1.mockClear();
    cb2.mockClear();

    // Only el1 resizes
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

    // Don't flush — rAF is still pending
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

    // rAF was scheduled but not yet flushed
    expect(rafCallbacks.size).toBe(1);
    unsub();
    expect(rafCallbacks.size).toBe(0);
  });
});
