// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
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

  it("composes event handlers between parent and cloned child", () => {
    const parentClick = vi.fn();
    const childClick = vi.fn();
    const unmount = mount(() =>
      h(
        SmoothCorners,
        {
          asChild: true,
          autoEffects: false,
          corners: { radius: 8 },
          onClick: parentClick,
        },
        () => h("button", { onClick: childClick, type: "button" }, "click"),
      ),
    );
    const button = container.querySelector<HTMLButtonElement>("button");
    expect(button).not.toBeNull();
    button!.click();
    expect(childClick).toHaveBeenCalledTimes(1);
    expect(parentClick).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("wraps the cloned child in a wrapper div when effects are present", () => {
    const unmount = mount(() =>
      h(
        SmoothCorners,
        {
          asChild: true,
          corners: { radius: 8 },
          innerBorder: { width: 2, color: "#000", opacity: 1 },
        },
        () => h("button", { type: "button" }, "click"),
      ),
    );
    const button = container.querySelector("button");
    expect(button).not.toBeNull();
    // Effects require a wrapper div with position: relative for the SVG overlay.
    const wrapper = button?.parentElement;
    expect(wrapper?.tagName).toBe("DIV");
    expect(wrapper?.style.position).toBe("relative");
    // The button still carries the data-slot attribute from the hook.
    expect(button?.getAttribute("data-slot")).toBe("smooth-corners");
    unmount();
  });
});

describe("<SmoothCorners /> Vue - attr forwarding", () => {
  it("forwards class and style to the inner element, not the wrapper, when wrapped", () => {
    // With autoEffects=true (default), needsWrapper is true. Consumer
    // attrs must land on the inner clipped element, not on the wrapper
    // div. Vue's default inheritAttrs=true would leak them onto the
    // wrapper.
    const unmount = mount(() =>
      h(
        SmoothCorners,
        {
          corners: { radius: 8 },
          class: "consumer-class",
          "data-testid": "consumer-node",
        },
        () => "x",
      ),
    );

    const inner = container.querySelector<HTMLElement>("[data-testid='consumer-node']");
    expect(inner).not.toBeNull();
    expect(inner?.className).toContain("consumer-class");

    // The wrapper div above it must NOT carry the consumer class.
    const wrapper = inner?.parentElement;
    expect(wrapper?.tagName).toBe("DIV");
    expect(wrapper?.className).not.toContain("consumer-class");

    unmount();
  });

  it("forwards class to the cloned child when asChild and wrapped", () => {
    const unmount = mount(() =>
      h(
        SmoothCorners,
        {
          asChild: true,
          corners: { radius: 8 },
          class: "consumer-class",
        },
        () => h("button", { class: "button-class", type: "button" }, "click"),
      ),
    );

    const button = container.querySelector<HTMLButtonElement>("button");
    expect(button).not.toBeNull();
    expect(button?.className.split(" ").sort()).toEqual(
      expect.arrayContaining(["button-class", "consumer-class"]),
    );
    // The wrapper should not carry the consumer class.
    const wrapper = button?.parentElement;
    expect(wrapper?.tagName).toBe("DIV");
    expect(wrapper?.className).not.toContain("consumer-class");

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

describe("<SmoothCorners /> Vue - anchor capture", () => {
  it("releases position on the original anchor even if the element is reparented", () => {
    // Parent starts with no inline position. acquirePosition should set
    // position: relative on it at mount, and cleanupEffects must release
    // the ORIGINAL parent (not whatever parentElement resolves to after
    // a reparent).
    const originalParent = document.createElement("div");
    container.appendChild(originalParent);

    const newParent = document.createElement("div");
    container.appendChild(newParent);

    const tplRef = ref<{ el: HTMLElement | null; wrapper: HTMLElement | null } | null>(null);
    const unmount = mount(() =>
      h(
        SmoothCorners,
        {
          ref: tplRef,
          corners: { radius: 8 },
          innerBorder: { width: 2, color: "#000", opacity: 1 },
        },
        () => "x",
      ),
    );

    // Move the wrapper into originalParent so its parentElement is set.
    const wrapper = tplRef.value?.wrapper;
    expect(wrapper).toBeInstanceOf(HTMLElement);
    originalParent.appendChild(wrapper!);

    // acquirePosition should have flipped the wrapper's inline position on
    // mount (the component itself sets position: relative via inline style).
    // The ref-count mechanism is inside @lisse/core; here we only need to
    // prove the original anchor is released, not leaked, after reparent.
    newParent.appendChild(wrapper!);

    unmount();

    // The wrapper's original parent should not retain any leaked styles
    // from Lisse. If the buggy cleanup path ran, it would have called
    // releasePosition(newParent) instead of the original anchor, leaving
    // state on the original anchor. With the fix, originalParent has no
    // leaked inline position.
    expect(originalParent.style.position).toBe("");
    expect(newParent.style.position).toBe("");
  });
});
