/** @jsx createElement */
// @vitest-environment happy-dom
//
// Overlays must live outside the clipped element so outer effects can paint.
import { act, createElement, createRoot, useRef, type Root } from "octane";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { BorderConfig } from "@lisse/core";
import { SmoothCorners } from "../src/smooth-corners.js";
import { useSmoothCorners } from "../src/use-smooth-corners.js";
import type { RefObject } from "../src/use-smooth-corners.js";
import { installNoopResizeObserver } from "./helpers.js";

const OUTER: BorderConfig = { width: 3, color: "#ff0000", opacity: 1 };

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  installNoopResizeObserver();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function Grid(props: { selfAnchor?: boolean }): unknown {
  return (
    <div data-testid="grid" style={{ display: "grid" }}>
      <Btn selfAnchor={props.selfAnchor} />
      <Btn selfAnchor={props.selfAnchor} />
    </div>
  );
}

function Btn(props: { selfAnchor?: boolean }): unknown {
  const ref = useRef<HTMLButtonElement | null>(null, Symbol.for("test:overlay:btn:ref"));
  useSmoothCorners(ref as RefObject<HTMLElement | null>, { radius: 18 }, {
    autoEffects: false,
    effects: { outerBorder: OUTER },
    ...(props.selfAnchor
      ? { wrapperRef: ref as RefObject<HTMLElement | null> }
      : {}),
  }, Symbol.for("test:overlay:btn:hook"));
  return <button ref={ref} type="button" />;
}

describe("effects overlay anchoring", () => {
  it("mounts the overlay on the parent, never inside the clipped element", () => {
    act(() => root.render(<Grid />));

    const buttons = [...container.querySelectorAll("button")];
    expect(buttons).toHaveLength(2);
    for (const button of buttons) expect(button.querySelector("svg")).toBeNull();

    const grid = container.querySelector("[data-testid='grid']")!;
    expect(grid.querySelectorAll(":scope > svg")).toHaveLength(2);
  });

  it("ignores a wrapperRef that points at the clipped element itself", () => {
    act(() => root.render(<Grid selfAnchor />));

    const buttons = [...container.querySelectorAll("button")];
    for (const button of buttons) expect(button.querySelector("svg")).toBeNull();

    const grid = container.querySelector("[data-testid='grid']")!;
    expect(grid.querySelectorAll(":scope > svg")).toHaveLength(2);
  });

  it("does not add a layout wrapper around the element", () => {
    act(() => root.render(<Grid />));

    const grid = container.querySelector("[data-testid='grid']")!;
    for (const button of grid.querySelectorAll("button")) {
      expect(button.parentElement).toBe(grid);
    }
    for (const svg of grid.querySelectorAll(":scope > svg")) {
      expect((svg as SVGElement).style.position).toBe("absolute");
    }
  });

  it("still mounts inside the wrapper div for SmoothCorners", () => {
    act(() =>
      root.render(
        <SmoothCorners
          as="button"
          corners={{ radius: 18 }}
          autoEffects={false}
          outerBorder={OUTER}
        />,
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
