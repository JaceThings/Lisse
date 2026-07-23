// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createApp, createSSRApp, h, ref, type App } from "vue";
import { renderToString } from "vue/server-renderer";
import {
  installHarness,
  uninstallHarness,
  type RuntimeHarness,
} from "../../core/__tests__/harness/runtime-harness.ts";
import { SmoothCorners } from "../src/smooth-corners.js";
import type { BorderConfig } from "@lisse/core";

let container: HTMLDivElement;
let h_: RuntimeHarness;
const apps: App[] = [];

beforeEach(() => {
  h_ = installHarness();
  container = document.createElement("div");
  document.body.appendChild(container);
});

afterEach(() => {
  while (apps.length > 0) apps.pop()?.unmount();
  container.remove();
  uninstallHarness();
});

function mount(render: () => unknown): App {
  const app = createApp({ render });
  app.mount(container);
  apps.push(app);
  return app;
}

function getInner(): HTMLElement {
  const el = container.querySelector<HTMLElement>("[data-slot='smooth-corners']");
  if (!el) throw new Error("inner data-slot element not found");
  return el;
}

function stubLayout(el: HTMLElement, width = 200, height = 100): void {
  Object.defineProperty(el, "offsetWidth", { value: width, configurable: true });
  Object.defineProperty(el, "offsetHeight", { value: height, configurable: true });
}

// A successful syncAll writes the clip-path AND marks data-state="ready" in
// the same branch, so counting the "ready" writes counts regenerations.
function readyWrites(spy: ReturnType<typeof vi.spyOn>): number {
  return spy.mock.calls.filter((c) => c[0] === "data-state" && c[1] === "ready").length;
}

describe("Vue change guard", () => {
  it("no-op reactive/resize ticks cause zero regenerations; a real change causes exactly one", async () => {
    const radius = ref(16);
    mount(() =>
      h(SmoothCorners, { as: "div", autoEffects: false, corners: { radius: radius.value } }),
    );
    const el = getInner();
    stubLayout(el);

    // Prime: first sync applies the clip-path. Flush pending Vue watchers
    // (the target watcher re-runs setup once post-mount) before spying so
    // the spy only sees work caused by the ticks under test.
    h_.deliverResize(el, 200, 100);
    h_.flushRaf();
    await Promise.resolve();
    h_.flushRaf();
    expect(el.style.clipPath).not.toBe("");
    const clipAfterPrime = el.style.clipPath;

    const spy = vi.spyOn(el, "setAttribute");

    // N no-op resize ticks at the same size → guard bails every time.
    for (let i = 0; i < 5; i++) h_.deliverResize(el, 200, 100);
    h_.flushRaf();
    expect(readyWrites(spy)).toBe(0);
    expect(el.style.clipPath).toBe(clipAfterPrime);

    // A real option change → exactly one regeneration.
    radius.value = 40;
    await Promise.resolve();
    h_.flushRaf();
    expect(readyWrites(spy)).toBe(1);
    expect(el.style.clipPath).not.toBe(clipAfterPrime);

    // Further no-op ticks after the change still bail.
    for (let i = 0; i < 3; i++) h_.deliverResize(el, 200, 100);
    h_.flushRaf();
    expect(readyWrites(spy)).toBe(1);
  });

  it("mutating an unrelated prop does not trigger sync; mutating a border value does", async () => {
    const cls = ref("alpha");
    const border = ref<BorderConfig | undefined>(undefined);
    mount(() =>
      // autoEffects default (true) keeps the wrapper present regardless of
      // the border toggle, so the inner element stays stable across changes.
      h(SmoothCorners, {
        as: "div",
        corners: { radius: 12 },
        class: cls.value,
        innerBorder: border.value,
      }),
    );
    const el = getInner();
    stubLayout(el);
    h_.deliverResize(el, 200, 100);
    h_.flushRaf();
    // Flush the post-mount target watcher (re-runs setup once) before spying.
    await Promise.resolve();
    h_.flushRaf();

    const spy = vi.spyOn(el, "setAttribute");

    const clipBefore = el.style.clipPath;
    expect(clipBefore).not.toBe("");

    // Unrelated prop (class) changes → re-render, but no regeneration.
    cls.value = "beta";
    await Promise.resolve();
    h_.flushRaf();
    expect(readyWrites(spy)).toBe(0);
    // The Vue-managed border-radius binding must not clobber the
    // imperatively-applied clip-path on an unrelated re-render.
    expect(el.style.clipPath).toBe(clipBefore);
    expect(el.className).toBe("beta");

    // A border value change → exactly one regeneration.
    border.value = { width: 2, color: "#000", opacity: 1 };
    await Promise.resolve();
    h_.flushRaf();
    expect(readyWrites(spy)).toBe(1);
  });

  it("SSR markup contains an inline border-radius derived from the corner radius", async () => {
    const app = createSSRApp({
      render: () =>
        h(SmoothCorners, { corners: { radius: 16, smoothing: 0.6 } }, () => "hello"),
    });
    const html = await renderToString(app);
    expect(html).toContain("border-radius:16px");
  });

  it("SSR border-radius honors per-corner radii and yields to a user style", async () => {
    const perCorner = await renderToString(
      createSSRApp({
        render: () =>
          h(SmoothCorners, {
            autoEffects: false,
            corners: { topLeft: 4, topRight: 8, bottomRight: 12, bottomLeft: 16 },
          }, () => "x"),
      }),
    );
    expect(perCorner).toContain("border-radius:4px 8px 12px 16px");

    // A user-supplied borderRadius wins over the fallback.
    const userWins = await renderToString(
      createSSRApp({
        render: () =>
          h(
            SmoothCorners,
            { autoEffects: false, corners: { radius: 16 }, style: { borderRadius: "3px" } },
            () => "x",
          ),
      }),
    );
    expect(userWins).toContain("border-radius:3px");
    expect(userWins).not.toContain("border-radius:16px");
  });
});
