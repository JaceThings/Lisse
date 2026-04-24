// @vitest-environment happy-dom
/**
 * JS-only benchmarks for the @lisse/react adapter.
 *
 * Each bench case:
 *   1. Mount N SmoothCorners instances (happy-dom, no paint).
 *   2. Force an initial sync via our controllable ResizeObserver stub
 *      plus a synchronous rAF flush.
 *   3. Measure one of three hot paths: Mount, Resize, Update.
 *
 * Timers are wall-clock (vitest's `bench` uses `performance.now()`), so the
 * numbers reflect pure JS work: clip-path generation, SVG overlay syncs,
 * React commits. They do NOT include browser paint or compositing.
 */
import { bench, describe, beforeAll, afterAll } from "vitest";
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SmoothCorners } from "../packages/react/src/smooth-corners.js";
import type { BorderConfig } from "../packages/core/src/types.js";

type ROCallback = (entries: ResizeObserverEntry[]) => void;

interface ControllableObserver {
  callback: ROCallback;
  targets: Set<Element>;
}

const observers: ControllableObserver[] = [];

/**
 * ResizeObserver stub that records every live observer. Tests drive layout
 * manually via `fireAll()`.
 */
class StubResizeObserver {
  private readonly self: ControllableObserver;
  constructor(callback: ROCallback) {
    this.self = { callback, targets: new Set() };
    observers.push(this.self);
  }
  observe(target: Element): void {
    this.self.targets.add(target);
  }
  unobserve(target: Element): void {
    this.self.targets.delete(target);
  }
  disconnect(): void {
    this.self.targets.clear();
    const i = observers.indexOf(this.self);
    if (i !== -1) observers.splice(i, 1);
  }
}

/**
 * Fire every registered observer with synthetic entries for its targets.
 * Mirrors what a real browser would deliver after a layout change.
 */
function fireAll(): void {
  for (const obs of [...observers]) {
    if (obs.targets.size === 0) continue;
    const entries = [...obs.targets].map(
      (target) =>
        ({
          target,
          contentRect: { width: 200, height: 100, top: 0, left: 0, right: 200, bottom: 100, x: 0, y: 0 } as DOMRectReadOnly,
          borderBoxSize: [],
          contentBoxSize: [],
          devicePixelContentBoxSize: [],
        }) as unknown as ResizeObserverEntry,
    );
    obs.callback(entries);
  }
}

/**
 * Flush all pending `requestAnimationFrame` callbacks synchronously. The
 * core `observeResize` schedules its sync inside rAF, so benches need to
 * drain it before stopping the timer.
 */
function flushRaf(): void {
  // Happy-dom's rAF is async; replace it with a synchronous version for
  // benches so we can measure the post-resize work without real timers.
  // No-op here if the polyfill is already installed by `setup`.
}

let syncRaf: (cb: FrameRequestCallback) => number;

function installSyncRaf(): void {
  // Store the original so the teardown can restore it. Replace with a
  // synchronous version that invokes the callback in-place. This is safe
  // because the `observeResize` module only uses rAF to batch — it does
  // not rely on frame timing.
  (globalThis as unknown as { __origRaf?: typeof requestAnimationFrame }).__origRaf =
    globalThis.requestAnimationFrame;
  (globalThis as unknown as { __origCaf?: typeof cancelAnimationFrame }).__origCaf =
    globalThis.cancelAnimationFrame;
  // The core `observeResize` uses `rafId === undefined` as a "frame
  // already scheduled" guard. If our polyfill returns any number, the
  // assignment `rafId = requestAnimationFrame(...)` leaves rafId truthy
  // after the (already-synchronous) callback returns, and subsequent
  // resize notifications would no-op. Returning `undefined` keeps the
  // guard correct while still running the callback inline.
  syncRaf = ((cb: FrameRequestCallback) => {
    cb(performance.now());
    return undefined as unknown as number;
  }) as typeof requestAnimationFrame;
  globalThis.requestAnimationFrame = syncRaf as typeof requestAnimationFrame;
  globalThis.cancelAnimationFrame = (() => {}) as typeof cancelAnimationFrame;
}

function restoreRaf(): void {
  const g = globalThis as unknown as {
    __origRaf?: typeof requestAnimationFrame;
    __origCaf?: typeof cancelAnimationFrame;
  };
  if (g.__origRaf) globalThis.requestAnimationFrame = g.__origRaf;
  if (g.__origCaf) globalThis.cancelAnimationFrame = g.__origCaf;
}

/**
 * Give every SmoothCorners element a deterministic bounding rect so the
 * hook has a non-zero size to work with. Without this the sync bails out
 * early and benches would measure nothing.
 */
function stubBoundingRect(): void {
  const proto = HTMLElement.prototype as unknown as {
    getBoundingClientRect: () => DOMRect;
  };
  proto.getBoundingClientRect = function () {
    return {
      x: 0,
      y: 0,
      width: 200,
      height: 100,
      top: 0,
      left: 0,
      right: 200,
      bottom: 100,
      toJSON() {
        return this;
      },
    } as DOMRect;
  };
}

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Effects = "none" | "innerBorder";

const INNER_BORDER: BorderConfig = { width: 2, color: "#000", opacity: 1 };

interface CaseSpec {
  count: number;
  autoEffects: boolean;
  effects: Effects;
}

const COUNTS = [1, 10, 50, 100, 500];
const AUTOS = [true, false];
const EFFECTS: Effects[] = ["none", "innerBorder"];

function renderList(spec: CaseSpec, radius: number): ReactNode {
  const nodes: ReactNode[] = [];
  for (let i = 0; i < spec.count; i++) {
    nodes.push(
      createElement(
        SmoothCorners,
        {
          key: i,
          corners: { radius, smoothing: 0.6 },
          autoEffects: spec.autoEffects,
          innerBorder: spec.effects === "innerBorder" ? INNER_BORDER : undefined,
        },
        "x",
      ),
    );
  }
  return createElement("div", null, nodes);
}

function mountFresh(
  spec: CaseSpec,
): { container: HTMLDivElement; root: Root } {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(renderList(spec, 20));
  });
  // The hook observes in useLayoutEffect, which queues the first sync
  // inside the shared rAF batch. Our sync-rAF polyfill means observe()
  // has already run its initial sync — but we still fire the observer to
  // simulate the browser's first layout-delivered callback.
  fireAll();
  return { container, root };
}

function teardown(container: HTMLDivElement, root: Root): void {
  act(() => {
    root.unmount();
  });
  container.remove();
}

beforeAll(() => {
  (globalThis as { ResizeObserver: unknown }).ResizeObserver = StubResizeObserver;
  installSyncRaf();
  stubBoundingRect();
});

afterAll(() => {
  restoreRaf();
});

// Bench config: vitest-bench uses tinybench under the hood. `time: 1000`
// gives each case at least 1s of sampling for a stable mean.
const BENCH_OPTS = { time: 1000 } as const;

for (const count of COUNTS) {
  for (const autoEffects of AUTOS) {
    for (const effects of EFFECTS) {
      const spec: CaseSpec = { count, autoEffects, effects };
      const label = `n=${count} auto=${autoEffects} effects=${effects}`;

      describe(`Mount ${label}`, () => {
        bench(
          "mount",
          () => {
            const { container, root } = mountFresh(spec);
            teardown(container, root);
          },
          BENCH_OPTS,
        );
      });

      describe(`Resize ${label}`, () => {
        let ctx: { container: HTMLDivElement; root: Root } | null = null;
        bench(
          "resize",
          () => {
            if (!ctx) ctx = mountFresh(spec);
            fireAll();
          },
          {
            ...BENCH_OPTS,
            teardown: () => {
              if (ctx) {
                teardown(ctx.container, ctx.root);
                ctx = null;
              }
            },
          },
        );
      });

      describe(`Update ${label}`, () => {
        let ctx: { container: HTMLDivElement; root: Root } | null = null;
        let toggle = false;
        bench(
          "update",
          () => {
            if (!ctx) ctx = mountFresh(spec);
            toggle = !toggle;
            const radius = toggle ? 24 : 20;
            act(() => {
              ctx!.root.render(renderList(spec, radius));
            });
          },
          {
            ...BENCH_OPTS,
            teardown: () => {
              if (ctx) {
                teardown(ctx.container, ctx.root);
                ctx = null;
                toggle = false;
              }
            },
          },
        );
      });

      void flushRaf; // keep reference to avoid unused warning
    }
  }
}
