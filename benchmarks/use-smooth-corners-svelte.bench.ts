// @vitest-environment happy-dom
/**
 * JS-only benchmarks for the @lisse/svelte adapter.
 *
 * Mirrors `use-smooth-corners.bench.ts` (the React adapter benches): same
 * StubResizeObserver / sync-rAF / stubbed-layout harness, same
 * Mount/Resize/Update case matrix, same BENCH_OPTS. `@lisse/svelte` exposes a
 * single plain-function action (no compiled `.svelte` component), so the
 * benches drive it directly against real DOM nodes the same way a Svelte
 * runtime would — `use:smoothCorners` calling the action on mount, `update()`
 * on prop change, `destroy()` on teardown.
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
  resizeSize,
  stubLayout,
  forEachCase,
  BENCH_OPTS,
  INNER_BORDER,
  type CaseSpec,
} from "./adapter-bench-harness.js";

beforeAll(() => {
  (globalThis as { ResizeObserver: unknown }).ResizeObserver = StubResizeObserver;
  installSyncRaf();
  stubLayout();

  // A throw from inside a bench task is swallowed: vitest prints no error, drops
  // the case's row and still exits 0 — the same silent vacuity these benches
  // exist to rule out. A throw in beforeAll fails the file, so smoke-attach one
  // instance here; `mountFresh` asserts the sync landed, so a harness that stops
  // producing a real layout can no longer go unnoticed.
  const smoke = mountFresh({ count: 1, autoEffects: true, effects: "innerBorder" });
  teardown(smoke.container, smoke.instances);
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

// Until now these benches timed an early return, not a sync: `getLayoutSize`
// found no px `width`/`height` in happy-dom's computed style and fell back to
// `offsetWidth`/`offsetHeight`, which happy-dom reports as 0, so every action
// sync bailed on `width <= 0` before generating a clip-path. A bench that
// silently measures a bail is worse than a missing bench, so refuse to run
// unless the attached node actually reached a synced state.
function assertSynced(container: HTMLElement): void {
  const el = container.querySelector<HTMLElement>("[data-slot='smooth-corners']");
  if (!el) throw new Error("vacuous bench: nothing was squircled");
  const state = el.getAttribute("data-state");
  if (state !== "ready" || el.style.clipPath === "") {
    throw new Error(
      `vacuous bench: sync never ran (data-state="${state}", clipPath="${el.style.clipPath}")`,
    );
  }
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
  // layout-delivered callback, now carrying a real border box, matching the
  // other adapter benches. Attaching at `resizeSize(0)` keeps the Resize
  // bench honest: its first delivery is `resizeSize(1)`, and consecutive
  // entries always differ, so that delivery is a genuinely changed box.
  const { width, height } = resizeSize(0);
  fireAll(width, height);
  assertSynced(container);
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
    // Iteration counter, reset with `ctx` so a freshly attached node (measured
    // at `resizeSize(0)`) is always followed by `resizeSize(1)`.
    let iteration = 0;
    bench(
      "resize",
      () => {
        if (!ctx) ctx = mountFresh(spec);
        // Each iteration must deliver a *changed* border box. Core drops a
        // notification whose box matches what the last flush measured, and the
        // action's change guard bails when width, height and the options key
        // are all unchanged — so redelivering one constant size would time a
        // guard bail, not a re-sync.
        const { width, height } = resizeSize(++iteration);
        fireAll(width, height);
      },
      {
        ...BENCH_OPTS,
        teardown: () => {
          if (ctx) {
            teardown(ctx.container, ctx.instances);
            ctx = null;
            iteration = 0;
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
