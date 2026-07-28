// @vitest-environment happy-dom
//
// Where the overlay gets mounted. `clip-path` clips its element's entire
// subtree, so an overlay nested inside the clipped element can never paint an
// outerBorder. Positioning arithmetic lives in core's overlay-placement tests.
// The action has no wrapper option, so react/vue's self-anchor case is absent.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { smoothCorners, type SmoothCornersAction } from "../src/smooth-corners.js";
import type { BorderConfig } from "@lisse/core";

const OUTER: BorderConfig = { width: 3, color: "#ff0000", opacity: 1 };

let container: HTMLDivElement;
let grid: HTMLDivElement;
const actions: SmoothCornersAction[] = [];

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
  grid = document.createElement("div");
  grid.style.display = "grid";
  container.appendChild(grid);
});

afterEach(() => {
  // Anchors are ref-counted; a surviving action leaks a count into the next test.
  while (actions.length > 0) actions.pop()?.destroy();
  container.remove();
});

function useTwoButtons(): HTMLButtonElement[] {
  const buttons = [document.createElement("button"), document.createElement("button")];
  for (const btn of buttons) grid.appendChild(btn);
  for (const btn of buttons) {
    actions.push(
      smoothCorners(btn, {
        corners: { radius: 18 },
        autoEffects: false,
        effects: { outerBorder: OUTER },
      }),
    );
  }
  return buttons;
}

describe("effects overlay anchoring", () => {
  it("mounts the overlay on the parent, never inside the clipped node", () => {
    const buttons = useTwoButtons();

    for (const btn of buttons) expect(btn.querySelector("svg")).toBeNull();

    expect(grid.querySelectorAll(":scope > svg")).toHaveLength(2);
  });

  it("does not add a layout wrapper around the node", () => {
    // Overlays are absolutely positioned, so they never become grid items.
    const buttons = useTwoButtons();

    for (const btn of buttons) expect(btn.parentElement).toBe(grid);
    for (const svg of grid.querySelectorAll(":scope > svg")) {
      expect((svg as SVGElement).style.position).toBe("absolute");
    }
  });

  it("removes the overlay from the parent on destroy", () => {
    useTwoButtons();
    expect(grid.querySelectorAll(":scope > svg")).toHaveLength(2);

    while (actions.length > 0) actions.pop()!.destroy();

    expect(grid.querySelectorAll("svg")).toHaveLength(0);
  });
});
