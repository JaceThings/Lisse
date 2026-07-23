// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createApp, h, ref, nextTick, type App } from "vue";
import {
  installHarness,
  uninstallHarness,
  type RuntimeHarness,
} from "../../core/__tests__/harness/runtime-harness.ts";
import { SmoothCorners } from "../src/smooth-corners.js";

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

describe("Vue adapter — runtime harness", () => {
  it("batches multiple resize entries into one rAF flush", () => {
    mount(() => h(SmoothCorners, { as: "div", autoEffects: false, corners: { radius: 16 } }));
    const el = getInner();
    stubLayout(el);

    h_.deliverResize(el, 200, 100);
    h_.deliverResize(el, 250, 120);
    h_.deliverResize(el, 300, 140);

    expect(h_.pendingRafCount()).toBeLessThanOrEqual(1);
    h_.flushRaf();
    expect(h_.pendingRafCount()).toBe(0);
    expect(el.style.clipPath).not.toBe("");
  });

  it("updates the clip-path style when the radius prop changes", async () => {
    const radius = ref(8);
    mount(() => h(SmoothCorners, { as: "div", autoEffects: false, corners: { radius: radius.value } }));
    const el = getInner();
    stubLayout(el);
    h_.deliverResize(el);
    h_.flushRaf();
    const dBefore = el.style.clipPath;

    radius.value = 32;
    // Vue flushes reactive updates in a microtask; flush rAF after.
    await Promise.resolve();
    h_.flushRaf();
    const dAfter = el.style.clipPath;

    expect(dBefore).not.toBe("");
    expect(dAfter).not.toBe("");
    expect(dAfter).not.toBe(dBefore);
  });

  it("handles effects prop changes without crashing", async () => {
    const withBorder = ref(false);
    mount(() =>
      h(SmoothCorners, {
        as: "div",
        autoEffects: false,
        corners: { radius: 12 },
        innerBorder: withBorder.value ? { width: 2, color: "#000", opacity: 1 } : undefined,
      }),
    );
    const el = getInner();
    stubLayout(el);
    h_.deliverResize(el);
    h_.flushRaf();
    expect(el.style.clipPath).not.toBe("");

    withBorder.value = true;
    await Promise.resolve();
    // Re-acquire and re-stub: enabling innerBorder may wrap in a fresh
    // DOM node, losing the offset stubs on the original element.
    const after = getInner();
    stubLayout(after);
    h_.deliverResize(after);
    h_.flushRaf();
    expect(after.style.clipPath).not.toBe("");
    expect(after.getAttribute("data-slot")).toBe("smooth-corners");
  });

  it("releases the observer when the last subscriber unmounts", () => {
    const app = mount(() =>
      h(SmoothCorners, { as: "div", autoEffects: false, corners: { radius: 12 } }),
    );
    const el = getInner();
    stubLayout(el);
    h_.deliverResize(el);
    h_.flushRaf();
    expect(h_.isObserved(el)).toBe(true);

    app.unmount();
    apps.splice(apps.indexOf(app), 1);
    expect(h_.isObserved(el)).toBe(false);
  });

  it("does not double-subscribe on re-render", async () => {
    const radius = ref(12);
    mount(() => h(SmoothCorners, { as: "div", autoEffects: false, corners: { radius: radius.value } }));
    const el = getInner();
    const observersAfterMount = h_.observerCount();
    expect(observersAfterMount).toBeGreaterThanOrEqual(1);

    radius.value = 16;
    await Promise.resolve();
    radius.value = 20;
    await Promise.resolve();

    expect(h_.observerCount()).toBe(observersAfterMount);
    expect(h_.isObserved(el)).toBe(true);
  });
});

describe("Vue adapter — SSR border-radius fallback teardown", () => {
  it("clears the fallback once the clip-path lands, but not before", () => {
    mount(() => h(SmoothCorners, { as: "div", autoEffects: false, corners: { radius: 16 } }));
    const el = getInner();

    // Pre-clip: fallback present so corners look rounded.
    expect(el.style.borderRadius).toBe("16px");

    stubLayout(el);
    h_.deliverResize(el);
    h_.flushRaf();

    expect(el.style.clipPath).not.toBe("");
    expect(el.style.borderRadius).toBe("");
  });

  it("keeps the fallback cleared across an unrelated re-render", async () => {
    const cls = ref("a");
    mount(() =>
      h(SmoothCorners, { as: "div", autoEffects: false, corners: { radius: 16 }, class: cls.value }),
    );
    const el = getInner();
    stubLayout(el);
    h_.deliverResize(el);
    h_.flushRaf();
    expect(el.style.borderRadius).toBe("");

    // Vue re-patches every inline style key on re-render; the fallback must not
    // come back (the component drops the binding once the clip-path is applied).
    cls.value = "b";
    await nextTick();
    expect(el.getAttribute("class")).toBe("b");
    expect(el.style.borderRadius).toBe("");
  });

  it("leaves a user-supplied border-radius untouched", () => {
    mount(() =>
      h(SmoothCorners, {
        as: "div",
        autoEffects: false,
        corners: { radius: 16 },
        style: { borderRadius: "4px" },
      }),
    );
    const el = getInner();
    stubLayout(el);
    h_.deliverResize(el);
    h_.flushRaf();

    expect(el.style.clipPath).not.toBe("");
    expect(el.style.borderRadius).toBe("4px");
  });
});
