// @vitest-environment happy-dom
//
// Where the overlay gets mounted. `clip-path` clips its element's entire
// subtree, so an overlay nested inside the clipped element can never paint an
// outerBorder. Positioning arithmetic lives in core's overlay-placement tests.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createApp, defineComponent, h, nextTick, ref, type App, type VNode } from "vue";
import { useSmoothCorners } from "../src/use-smooth-corners.js";
import { SmoothCorners } from "../src/smooth-corners.js";
import type { BorderConfig } from "@lisse/core";

const OUTER: BorderConfig = { width: 3, color: "#ff0000", opacity: 1 };

let container: HTMLDivElement;
const apps: App[] = [];

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
  while (apps.length > 0) apps.pop()?.unmount();
  container.remove();
});

function mount(render: () => unknown): void {
  const app = createApp({ render });
  app.mount(container);
  apps.push(app);
}

const Btn = defineComponent({
  props: { selfAnchor: { type: Boolean, default: false } },
  setup(props) {
    const el = ref<HTMLElement | null>(null);
    useSmoothCorners(el, { radius: 18 }, {
      autoEffects: false,
      effects: { outerBorder: OUTER },
      ...(props.selfAnchor ? { wrapper: el } : {}),
    });
    return () => h("button", { ref: el, type: "button" });
  },
});

function grid(children: VNode[]) {
  return h("div", { "data-testid": "grid", style: { display: "grid" } }, children);
}

function findGrid(): Element {
  return container.querySelector("[data-testid='grid']")!;
}

describe("effects overlay anchoring", () => {
  it("mounts the overlay on the parent, never inside the clipped element", () => {
    mount(() => grid([h(Btn), h(Btn)]));

    const buttons = [...container.querySelectorAll("button")];
    expect(buttons).toHaveLength(2);
    for (const btn of buttons) expect(btn.querySelector("svg")).toBeNull();

    expect(findGrid().querySelectorAll(":scope > svg")).toHaveLength(2);
  });

  it("ignores a wrapper ref that points at the clipped element itself", () => {
    mount(() => grid([h(Btn, { selfAnchor: true }), h(Btn, { selfAnchor: true })]));

    const buttons = [...container.querySelectorAll("button")];
    for (const btn of buttons) expect(btn.querySelector("svg")).toBeNull();

    expect(findGrid().querySelectorAll(":scope > svg")).toHaveLength(2);
  });

  it("does not add a layout wrapper around the element", () => {
    // Overlays are absolutely positioned, so they never become grid items.
    mount(() => grid([h(Btn), h(Btn)]));

    const g = findGrid();
    for (const btn of g.querySelectorAll("button")) {
      expect(btn.parentElement).toBe(g);
    }
    for (const svg of g.querySelectorAll(":scope > svg")) {
      expect((svg as SVGElement).style.position).toBe("absolute");
    }
  });

  it("still mounts inside the wrapper div for <SmoothCorners>", () => {
    mount(() =>
      h(SmoothCorners, { as: "button", corners: { radius: 18 }, autoEffects: false, outerBorder: OUTER }),
    );

    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.tagName).toBe("DIV");
    expect(wrapper.querySelector(":scope > svg")).not.toBeNull();
    expect(container.querySelector("button")!.querySelector("svg")).toBeNull();
  });

  it("removes the overlay from the parent on unmount", async () => {
    // The grid outlives the buttons here, so a leaked overlay would still be
    // hanging off it — plain app.unmount() would detach the whole tree and
    // couldn't tell a cleaned-up anchor from an abandoned one.
    const show = ref(true);
    mount(() => grid(show.value ? [h(Btn), h(Btn)] : []));

    const g = findGrid();
    expect(g.querySelectorAll(":scope > svg")).toHaveLength(2);

    show.value = false;
    await nextTick();
    expect(g.querySelectorAll("svg")).toHaveLength(0);
  });
});
