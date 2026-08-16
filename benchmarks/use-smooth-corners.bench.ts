// @vitest-environment happy-dom
/**
 * JS-only benchmarks for the @lisse/react adapter.
 *
 * Each bench case:
 *   1. Mount N SmoothCorners instances (happy-dom, no paint).
 *   2. Let the mount's own sync run — the hook subscribes in useLayoutEffect,
 *      which queues a flush that the sync-rAF polyfill runs inline against the
 *      harness's stubbed layout — then deliver the observer's guaranteed
 *      initial notification on top, as a browser does.
 *   3. Measure one of three hot paths: Mount, Resize, Update.
 *
 * `mountFresh` asserts the element actually synced, and `beforeAll` runs it
 * once where a throw is reported: these benches spent months timing an early
 * return, because without a stubbed layout every element measures 0x0 and the
 * adapter bails before generating anything.
 *
 * Timers are wall-clock (vitest's `bench` uses `performance.now()`), so the
 * numbers reflect pure JS work: clip-path generation, SVG overlay syncs,
 * React commits. They do NOT include browser paint or compositing.
 */
import { bench, describe, beforeAll, afterAll } from "vitest";
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SmoothCorners } from "../packages/react/src/smooth-corners.js";
import {
  StubResizeObserver,
  fireAll,
  installSyncRaf,
  restoreRaf,
  stubLayout,
  resizeSize,
  forEachCase,
  BENCH_OPTS,
  INNER_BORDER,
  type CaseSpec,
} from "./adapter-bench-harness.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

function mountFresh(spec: CaseSpec): { container: HTMLDivElement; root: Root } {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(renderList(spec, 20));
  });
  // The hook observes in useLayoutEffect, which queues the first sync inside
  // the shared rAF batch; the sync-rAF polyfill has already run it against the
  // stubbed layout. Firing the observer on top is the browser's guaranteed
  // initial delivery — `observeResize` recognises it as reporting the box the
  // flush just measured and skips it, exactly as it would in a browser.
  const mounted = resizeSize(0);
  fireAll(mounted.width, mounted.height);

  // Tripwire, not a nicety: for months every case here measured a framework
  // mount plus an early return, because `getLayoutSize` saw 0x0 and the
  // adapter bailed before touching a clip-path. `data-state` is "pending" from
  // the moment the hook mounts, so a missing element and an unsynced one are
  // both caught; only a real sync flips it to "ready" and writes a path.
  const el = container.querySelector<HTMLElement>("[data-state]");
  if (el?.getAttribute("data-state") !== "ready" || el.style.clipPath === "") {
    throw new Error(
      `bench went vacuous: expected data-state="ready" with a clip-path, got ` +
        `data-state=${JSON.stringify(el?.getAttribute("data-state"))} ` +
        `clipPath=${JSON.stringify(el?.style.clipPath ?? null)}`,
    );
  }
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
  stubLayout();

  // Run `mountFresh`'s tripwire once where a throw is actually reported.
  // tinybench swallows a throw from inside a bench task: the case just drops
  // out of the results table and the run still exits 0, which is precisely the
  // quiet failure this whole file is being fixed for. A throw in `beforeAll`
  // fails the file.
  const smoke = mountFresh({ count: 1, autoEffects: true, effects: "innerBorder" });
  teardown(smoke.container, smoke.root);
});

afterAll(() => {
  restoreRaf();
});

forEachCase((spec, label) => {
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
    // Starts at 1 because `mountFresh` already delivered `resizeSize(0)`. A
    // redelivery of that same box is dropped by `observeResize` before it ever
    // reaches the adapter, so a constant-size Resize bench would time the skip.
    let iteration = 1;
    bench(
      "resize",
      () => {
        if (!ctx) ctx = mountFresh(spec);
        const next = resizeSize(iteration++);
        fireAll(next.width, next.height);
      },
      {
        ...BENCH_OPTS,
        teardown: () => {
          if (ctx) {
            teardown(ctx.container, ctx.root);
            ctx = null;
            iteration = 1;
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
});
