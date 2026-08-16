// SSR `renderToString` benchmarks: how long it takes to server-render N
// `SmoothCorners` instances per adapter, no DOM/ResizeObserver/rAF
// involved. Mirrors the render approach used in
// `tests/consumer-smoke/ssr-smoke.mjs` (import the adapter's component and
// call its framework's string-renderer directly).
//
// Both adapters emit the library's SSR `border-radius` fallback markup, derived
// per instance at render time — measured output for one instance is
// `<div style="position:relative"><div style="border-radius:12px">…`, so neither
// case is timing a bare framework render.
import { bench, describe } from "vitest";
import { createElement } from "react";
import { renderToString as reactRenderToString } from "react-dom/server";
import { createSSRApp, h, type VNode } from "vue";
import { renderToString as vueRenderToString } from "vue/server-renderer";
import { SmoothCorners as ReactSmoothCorners } from "../packages/react/src/smooth-corners.js";
import { SmoothCorners as VueSmoothCorners } from "../packages/vue/src/smooth-corners.js";

const BENCH_OPTS = { time: 1000 } as const;
const COUNTS = [1, 10, 50, 100];

function reactTree(count: number) {
  const nodes = [];
  for (let i = 0; i < count; i++) {
    nodes.push(
      createElement(
        ReactSmoothCorners,
        { key: i, as: "div", corners: { radius: 12, smoothing: 0.6 } },
        createElement("span", null, "hello"),
      ),
    );
  }
  return createElement("div", null, nodes);
}

function vueApp(count: number) {
  const nodes: VNode[] = [];
  for (let i = 0; i < count; i++) {
    nodes.push(
      h(
        VueSmoothCorners,
        { key: i, as: "div", corners: { radius: 12, smoothing: 0.6 } },
        { default: () => h("span", null, "hello") },
      ),
    );
  }
  return createSSRApp({ render: () => h("div", null, nodes) });
}

for (const count of COUNTS) {
  describe(`SSR renderToString n=${count}`, () => {
    bench(
      "react",
      () => {
        reactRenderToString(reactTree(count));
      },
      BENCH_OPTS,
    );

    bench(
      "vue",
      async () => {
        await vueRenderToString(vueApp(count));
      },
      BENCH_OPTS,
    );
  });
}
