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
import {
  StubResizeObserver,
  fireAll,
  installSyncRaf,
  restoreRaf,
  stubBoundingRect,
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
});
