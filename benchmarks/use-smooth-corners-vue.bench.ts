// @vitest-environment happy-dom
/**
 * JS-only benchmarks for the @lisse/vue adapter.
 *
 * Mirrors `use-smooth-corners.bench.ts` (the React adapter benches): same
 * StubResizeObserver / sync-rAF harness, same Mount/Resize/Update
 * case matrix, same BENCH_OPTS. Two surfaces are covered here —
 * the `useSmoothCorners` composable in isolation, and the `<SmoothCorners>`
 * component that wraps it — so a regression in either layer shows up.
 */
import { bench, describe, beforeAll, afterAll } from "vitest";
import { createApp, defineComponent, h, ref, computed, nextTick, type App, type Ref } from "vue";
import { useSmoothCorners } from "../packages/vue/src/use-smooth-corners.js";
import { SmoothCorners } from "../packages/vue/src/smooth-corners.js";
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
  // exist to rule out. A throw in beforeAll fails the file, so smoke-mount one
  // instance of each surface here; `mountWithRadius` asserts the sync landed, so
  // a harness that stops producing a real layout can no longer go unnoticed.
  const smokeSpec: CaseSpec = { count: 1, autoEffects: true, effects: "innerBorder" };
  const smokeComponent = mountWithRadius((radiusRef) => componentList(smokeSpec, radiusRef.value));
  teardownApp(smokeComponent.container, smokeComponent.app);
  const smokeComposable = mountWithRadius((radiusRef) => composableList(smokeSpec, radiusRef));
  teardownApp(smokeComposable.container, smokeComposable.app);
});

afterAll(() => {
  restoreRaf();
});

interface MountedApp {
  container: HTMLDivElement;
  app: App;
  radiusRef: Ref<number>;
}

function teardownApp(container: HTMLDivElement, app: App): void {
  app.unmount();
  container.remove();
}

// Until now these benches timed an early return, not a sync: `getLayoutSize`
// found no px `width`/`height` in happy-dom's computed style and fell back to
// `offsetWidth`/`offsetHeight`, which happy-dom reports as 0, so every adapter
// sync bailed on `width <= 0` before generating a clip-path. A bench that
// silently measures a bail is worse than a missing bench, so refuse to run
// unless the mounted element actually reached a synced state.
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

// `render` decides whether it reads `radiusRef.value` (tracks it in the
// Root's render, so Root re-renders and diffs props on every mutation — the
// `<SmoothCorners>` component path) or passes the ref itself down untouched
// (Root never re-renders; mutations are picked up by reactivity inside the
// mounted instances — the `useSmoothCorners` composable path).
function mountWithRadius(render: (radiusRef: Ref<number>) => ReturnType<typeof h>): MountedApp {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const radiusRef = ref(20);
  const Root = defineComponent({ render: () => render(radiusRef) });
  const app = createApp(Root);
  app.mount(container);
  // The composable observes in onMounted, which queues the first sync
  // inside the shared rAF batch. Our sync-rAF polyfill means observe()
  // has already run its initial sync — but we still fire the observer to
  // simulate the browser's first layout-delivered callback, now carrying a
  // real border box. Mounting at `resizeSize(0)` keeps the Resize bench
  // honest: its first delivery is `resizeSize(1)`, and consecutive entries
  // always differ, so that delivery is guaranteed to be a changed box.
  const { width, height } = resizeSize(0);
  fireAll(width, height);
  assertSynced(container);
  return { container, app, radiusRef };
}

function benchMountResizeUpdate(
  labelPrefix: string,
  label: string,
  render: (radiusRef: Ref<number>) => ReturnType<typeof h>,
): void {
  describe(`${labelPrefix} Mount ${label}`, () => {
    bench(
      "mount",
      () => {
        const { container, app } = mountWithRadius(render);
        teardownApp(container, app);
      },
      BENCH_OPTS,
    );
  });

  describe(`${labelPrefix} Resize ${label}`, () => {
    let ctx: MountedApp | null = null;
    // Iteration counter, reset with `ctx` so a remounted element (measured at
    // `resizeSize(0)`) is always followed by `resizeSize(1)`.
    let iteration = 0;
    bench(
      "resize",
      () => {
        if (!ctx) ctx = mountWithRadius(render);
        // Each iteration must deliver a *changed* border box. Core drops a
        // notification whose box matches what the last flush measured, and the
        // adapter's change guard bails when width, height and the options key
        // are all unchanged — so redelivering one constant size would time a
        // guard bail, not a re-sync.
        const { width, height } = resizeSize(++iteration);
        fireAll(width, height);
      },
      {
        ...BENCH_OPTS,
        teardown: () => {
          if (ctx) {
            teardownApp(ctx.container, ctx.app);
            ctx = null;
            iteration = 0;
          }
        },
      },
    );
  });

  describe(`${labelPrefix} Update ${label}`, () => {
    let ctx: MountedApp | null = null;
    let toggle = false;
    bench(
      "update",
      async () => {
        if (!ctx) ctx = mountWithRadius(render);
        toggle = !toggle;
        ctx.radiusRef.value = toggle ? 24 : 20;
        // Vue's `watch` flush is scheduled on the microtask queue by
        // default; `nextTick()` waits for it so the update has actually
        // landed before the sample ends.
        await nextTick();
      },
      {
        ...BENCH_OPTS,
        teardown: () => {
          if (ctx) {
            teardownApp(ctx.container, ctx.app);
            ctx = null;
            toggle = false;
          }
        },
      },
    );
  });
}

function componentList(spec: CaseSpec, radius: number) {
  const nodes = [];
  for (let i = 0; i < spec.count; i++) {
    nodes.push(
      h(
        SmoothCorners,
        {
          key: i,
          corners: { radius, smoothing: 0.6 },
          autoEffects: spec.autoEffects,
          innerBorder: spec.effects === "innerBorder" ? INNER_BORDER : undefined,
        },
        { default: () => "x" },
      ),
    );
  }
  return h("div", null, nodes);
}

forEachCase((spec, label) => {
  benchMountResizeUpdate("Vue component", label, (radiusRef) => componentList(spec, radiusRef.value));
});

// useSmoothCorners composable benches, isolated from component overhead.
function composableList(spec: CaseSpec, radiusRef: Ref<number>) {
  const Host = defineComponent({
    setup() {
      const el = ref<HTMLElement | null>(null);
      const options = computed(() => ({ radius: radiusRef.value, smoothing: 0.6 }));
      useSmoothCorners(el, options, {
        autoEffects: spec.autoEffects,
        effects: spec.effects === "innerBorder" ? { innerBorder: INNER_BORDER } : undefined,
      });
      return () => h("div", { ref: el }, "x");
    },
  });

  const nodes = [];
  for (let i = 0; i < spec.count; i++) {
    nodes.push(h(Host, { key: i }));
  }
  return h("div", null, nodes);
}

forEachCase((spec, label) => {
  benchMountResizeUpdate("Vue composable", label, (radiusRef) => composableList(spec, radiusRef));
});
