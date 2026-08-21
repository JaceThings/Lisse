// @vitest-environment happy-dom
/**
 * JS-only benchmarks for the @lisse/octane adapter.
 *
 * Mirrors `use-smooth-corners.bench.ts` (the React adapter benches): same
 * StubResizeObserver / sync-rAF harness, same Mount/Resize/Update case matrix,
 * same BENCH_OPTS.
 */
import { bench, describe, beforeAll, afterAll } from "vitest";
import { act, createElement, createRoot, type ElementDescriptor, type Root } from "octane";
import { SmoothCorners } from "../packages/octane/src/smooth-corners.js";
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

interface Mounted {
  container: HTMLDivElement;
  root: Root;
}

function renderList(spec: CaseSpec, radius: number): ElementDescriptor {
  const nodes: ElementDescriptor[] = [];
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
  return createElement("div", null, ...nodes);
}

function mountFresh(spec: CaseSpec): Mounted {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(renderList(spec, 20));
  });
  // The hook observes in useLayoutEffect, which queues the first sync inside the
  // shared rAF batch that the sync-rAF polyfill has already run against the
  // stubbed layout. Firing the observer on top is the browser's guaranteed
  // initial delivery, which `observeResize` recognises and skips.
  const mounted = resizeSize(0);
  fireAll(mounted.width, mounted.height);

  // Tripwire: without a stubbed layout `getLayoutSize` reads 0x0 and every sync
  // bails before touching a clip-path, so the whole grid times a framework
  // mount plus an early return. `data-state` is "pending" from the moment the
  // hook mounts, so a missing element and an unsynced one are both caught.
  const el = container.querySelector<HTMLElement>("[data-slot='smooth-corners']");
  if (el?.getAttribute("data-state") !== "ready" || el.style.clipPath === "") {
    throw new Error(
      `bench went vacuous: expected data-state="ready" with a clip-path, got ` +
        `data-state=${JSON.stringify(el?.getAttribute("data-state"))} ` +
        `clipPath=${JSON.stringify(el?.style.clipPath ?? null)}`,
    );
  }
  return { container, root };
}

function teardown({ container, root }: Mounted): void {
  act(() => {
    root.unmount();
  });
  container.remove();
}

beforeAll(() => {
  (globalThis as { ResizeObserver: unknown }).ResizeObserver = StubResizeObserver;
  installSyncRaf();
  stubLayout();

  // tinybench swallows a throw from inside a bench task: the case drops out of
  // the results table and the run still exits 0. Run the tripwire once here,
  // where a throw fails the file.
  teardown(mountFresh({ count: 1, autoEffects: true, effects: "innerBorder" }));
});

afterAll(() => {
  restoreRaf();
});

forEachCase((spec, label) => {
  describe(`Mount ${label}`, () => {
    bench(
      "mount",
      () => {
        teardown(mountFresh(spec));
      },
      BENCH_OPTS,
    );
  });

  describe(`Resize ${label}`, () => {
    let ctx: Mounted | null = null;
    // Starts at 1 because `mountFresh` already delivered `resizeSize(0)`, and a
    // redelivery of that box is dropped before it reaches the adapter.
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
            teardown(ctx);
            ctx = null;
            iteration = 1;
          }
        },
      },
    );
  });

  describe(`Update ${label}`, () => {
    let ctx: Mounted | null = null;
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
            teardown(ctx);
            ctx = null;
            toggle = false;
          }
        },
      },
    );
  });
});
