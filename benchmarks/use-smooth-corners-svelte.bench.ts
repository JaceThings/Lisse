// @vitest-environment happy-dom
/**
 * JS-only benchmarks for the @lisse/svelte adapter.
 *
 * Mirrors `use-smooth-corners.bench.ts` (the React adapter benches): same
 * StubResizeObserver / sync-rAF harness, same Mount/Resize/Update case
 * matrix, same BENCH_OPTS. `@lisse/svelte` exposes a single plain-function
 * action (no compiled `.svelte` component), so the benches drive it
 * directly against real DOM nodes the same way a Svelte runtime would —
 * `use:smoothCorners` calling the action on mount, `update()` on prop
 * change, `destroy()` on teardown.
 */
import { bench, describe, beforeAll, afterAll } from "vitest";
import {
  smoothCorners,
  type SmoothCornersAction,
  type SmoothCornersConfig,
} from "../packages/svelte/src/smooth-corners.js";
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

beforeAll(() => {
  (globalThis as { ResizeObserver: unknown }).ResizeObserver = StubResizeObserver;
  installSyncRaf();
  stubBoundingRect();
});

afterAll(() => {
  restoreRaf();
});

function configFor(spec: CaseSpec, radius: number): SmoothCornersConfig {
  return {
    corners: { radius, smoothing: 0.6 },
    autoEffects: spec.autoEffects,
    effects: spec.effects === "innerBorder" ? { innerBorder: INNER_BORDER } : undefined,
  };
}

interface Instance {
  el: HTMLElement;
  action: SmoothCornersAction;
}

function mountFresh(spec: CaseSpec): { container: HTMLDivElement; instances: Instance[] } {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const instances: Instance[] = [];
  for (let i = 0; i < spec.count; i++) {
    const el = document.createElement("div");
    el.textContent = "x";
    container.appendChild(el);
    const action = smoothCorners(el, configFor(spec, 20));
    instances.push({ el, action });
  }
  // The action registers via observeResize synchronously at attach time;
  // our sync-rAF polyfill means it has already run its initial sync — but
  // we still fire the observer to simulate the browser's first
  // layout-delivered callback, matching the other adapter benches.
  fireAll();
  return { container, instances };
}

function teardown(container: HTMLDivElement, instances: Instance[]): void {
  for (const { action } of instances) action.destroy();
  container.remove();
}

forEachCase((spec, label) => {
  describe(`Svelte action Mount ${label}`, () => {
    bench(
      "mount",
      () => {
        const { container, instances } = mountFresh(spec);
        teardown(container, instances);
      },
      BENCH_OPTS,
    );
  });

  describe(`Svelte action Resize ${label}`, () => {
    let ctx: { container: HTMLDivElement; instances: Instance[] } | null = null;
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
            teardown(ctx.container, ctx.instances);
            ctx = null;
          }
        },
      },
    );
  });

  describe(`Svelte action Update ${label}`, () => {
    let ctx: { container: HTMLDivElement; instances: Instance[] } | null = null;
    let toggle = false;
    bench(
      "update",
      () => {
        if (!ctx) ctx = mountFresh(spec);
        toggle = !toggle;
        const radius = toggle ? 24 : 20;
        for (const { action } of ctx.instances) {
          action.update(configFor(spec, radius));
        }
      },
      {
        ...BENCH_OPTS,
        teardown: () => {
          if (ctx) {
            teardown(ctx.container, ctx.instances);
            ctx = null;
            toggle = false;
          }
        },
      },
    );
  });
});
