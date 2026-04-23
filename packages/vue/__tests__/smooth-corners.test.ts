// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createApp, h, ref } from "vue";
import { SmoothCorners } from "../src/smooth-corners.js";

let container: HTMLDivElement;

beforeEach(() => {
  if (!("ResizeObserver" in globalThis)) {
    (globalThis as { ResizeObserver: unknown }).ResizeObserver = class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    };
  }
  container = document.createElement("div");
  document.body.appendChild(container);
});

afterEach(() => {
  container.remove();
});

function mount(render: () => unknown) {
  const app = createApp({ render });
  app.mount(container);
  return () => app.unmount();
}

describe("<SmoothCorners /> Vue - wrapper-skip", () => {
  it("skips wrapper when autoEffects=false and no effects", () => {
    const unmount = mount(() =>
      h(SmoothCorners, { as: "span", autoEffects: false, corners: { radius: 12 } }, () => "hi"),
    );
    const span = container.querySelector("span");
    expect(span).not.toBeNull();
    expect(span?.parentElement).toBe(container);
    unmount();
  });

  it("wraps in a div when autoEffects defaults to true", () => {
    const unmount = mount(() =>
      h(SmoothCorners, { as: "span", corners: { radius: 12 } }, () => "hi"),
    );
    const span = container.querySelector("span");
    expect(span?.parentElement?.tagName).toBe("DIV");
    expect(span?.parentElement?.parentElement).toBe(container);
    unmount();
  });
});

describe("<SmoothCorners /> Vue - data attributes", () => {
  it("applies data-slot=smooth-corners on the inner element", () => {
    const unmount = mount(() =>
      h(SmoothCorners, { autoEffects: false, corners: { radius: 8 } }, () => "x"),
    );
    const el = container.querySelector("[data-slot='smooth-corners']");
    expect(el).not.toBeNull();
    unmount();
  });
});

describe("<SmoothCorners /> Vue - asChild", () => {
  it("clones the child instead of wrapping", () => {
    const unmount = mount(() =>
      h(
        SmoothCorners,
        {
          asChild: true,
          autoEffects: false,
          corners: { radius: 8 },
          class: "outer",
        },
        () => h("button", { class: "inner", type: "button" }, "click"),
      ),
    );
    const button = container.querySelector("button");
    expect(button).not.toBeNull();
    expect(button?.parentElement).toBe(container);
    // Vue cloneVNode merges classes; both should be present (order is impl-defined).
    expect(button?.className.split(" ").sort()).toEqual(["inner", "outer"]);
    unmount();
  });
});

describe("<SmoothCorners /> Vue - defineExpose", () => {
  it("exposes el and wrapper via template ref", () => {
    const tplRef = ref<{ el: HTMLElement | null; wrapper: HTMLElement | null } | null>(null);
    const unmount = mount(() =>
      h(SmoothCorners, { ref: tplRef, corners: { radius: 8 } }, () => "x"),
    );
    expect(tplRef.value).not.toBeNull();
    expect(tplRef.value?.el).toBeInstanceOf(HTMLElement);
    expect(tplRef.value?.wrapper).toBeInstanceOf(HTMLElement);
    unmount();
  });
});
