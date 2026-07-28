// @vitest-environment happy-dom
//
// Where the overlay gets mounted. `clip-path` clips its element's entire
// subtree, so an overlay nested inside the clipped element can never paint an
// outerBorder. Positioning arithmetic lives in core's overlay-placement tests.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useRef } from "react";
import { SmoothCorners } from "../src/smooth-corners.js";
import { useSmoothCorners } from "../src/use-smooth-corners.js";
import type { BorderConfig } from "@lisse/core";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const OUTER: BorderConfig = { width: 3, color: "#ff0000", opacity: 1 };

let container: HTMLDivElement;
let root: Root;

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
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function Grid({ selfAnchor }: { selfAnchor?: boolean }) {
  return (
    <div data-testid="grid" style={{ display: "grid" }}>
      <Btn selfAnchor={selfAnchor} />
      <Btn selfAnchor={selfAnchor} />
    </div>
  );
}

function Btn({ selfAnchor }: { selfAnchor?: boolean }) {
  const ref = useRef<HTMLButtonElement>(null);
  useSmoothCorners(ref as React.RefObject<HTMLElement | null>, { radius: 18 }, {
    autoEffects: false,
    effects: { outerBorder: OUTER },
    ...(selfAnchor ? { wrapperRef: ref as React.RefObject<HTMLElement | null> } : {}),
  });
  return <button ref={ref} type="button" />;
}

describe("effects overlay anchoring", () => {
  it("mounts the overlay on the parent, never inside the clipped element", () => {
    act(() => root.render(<Grid />));

    const buttons = [...container.querySelectorAll("button")];
    expect(buttons).toHaveLength(2);
    for (const btn of buttons) expect(btn.querySelector("svg")).toBeNull();

    const grid = container.querySelector("[data-testid='grid']")!;
    expect(grid.querySelectorAll(":scope > svg")).toHaveLength(2);
  });

  it("ignores a wrapperRef that points at the clipped element itself", () => {
    act(() => root.render(<Grid selfAnchor />));

    const buttons = [...container.querySelectorAll("button")];
    for (const btn of buttons) expect(btn.querySelector("svg")).toBeNull();

    const grid = container.querySelector("[data-testid='grid']")!;
    expect(grid.querySelectorAll(":scope > svg")).toHaveLength(2);
  });

  it("does not add a layout wrapper around the element", () => {
    // Overlays are absolutely positioned, so they never become grid items.
    act(() => root.render(<Grid />));

    const grid = container.querySelector("[data-testid='grid']")!;
    for (const btn of grid.querySelectorAll("button")) {
      expect(btn.parentElement).toBe(grid);
    }
    for (const svg of grid.querySelectorAll(":scope > svg")) {
      expect((svg as SVGElement).style.position).toBe("absolute");
    }
  });

  it("still mounts inside the wrapper div for <SmoothCorners>", () => {
    act(() =>
      root.render(
        <SmoothCorners as="button" corners={{ radius: 18 }} autoEffects={false} outerBorder={OUTER} />,
      ),
    );

    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.tagName).toBe("DIV");
    expect(wrapper.querySelector(":scope > svg")).not.toBeNull();
    expect(container.querySelector("button")!.querySelector("svg")).toBeNull();
  });

  it("removes the overlay from the parent on unmount", () => {
    act(() => root.render(<Grid />));
    const grid = container.querySelector("[data-testid='grid']")!;
    expect(grid.querySelectorAll(":scope > svg")).toHaveLength(2);

    act(() => root.render(<div data-testid="grid" style={{ display: "grid" }} />));
    expect(container.querySelectorAll("svg")).toHaveLength(0);
  });
});
