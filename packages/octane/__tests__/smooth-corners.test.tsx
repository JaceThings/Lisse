/** @jsx createElement */
// @vitest-environment happy-dom
import { act, createElement, createRoot, type Root } from "octane";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SmoothCorners, useSmoothCorners } from "../src/index.js";

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

describe("@lisse/octane", () => {
  it("renders the direct element when effects are disabled", () => {
    act(() => {
      root.render(
        <SmoothCorners autoEffects={false} as="span" corners={{ radius: 12 }}>
          hello
        </SmoothCorners>
      );
    });

    const span = container.querySelector("span");
    expect(span).not.toBeNull();
    expect(span?.parentElement).toBe(container);
    expect(span?.getAttribute("data-slot")).toBe("smooth-corners");
    expect(span?.getAttribute("data-state")).toBe("pending");
  });

  it("supports asChild and preserves the child element", () => {
    act(() => {
      root.render(
        <SmoothCorners
          asChild
          autoEffects={false}
          corners={{ radius: 8 }}
          className={["parent", { active: true }]}
        >
          <button class={["child", { disabled: false }]} type="button">
            save
          </button>
        </SmoothCorners>
      );
    });

    const button = container.querySelector("button");
    expect(button?.textContent).toBe("save");
    expect(button?.className).toBe("parent active child");
    expect(button?.getAttribute("data-slot")).toBe("smooth-corners");
  });

  it("composes forwarded and child refs with Octane ref arrays", () => {
    const forwardedRef = { current: null as HTMLButtonElement | null };
    const childRef = { current: null as HTMLButtonElement | null };

    act(() => {
      root.render(
        <SmoothCorners asChild autoEffects={false} ref={forwardedRef}>
          <button ref={childRef}>save</button>
        </SmoothCorners>
      );
    });

    const button = container.querySelector("button");
    expect(forwardedRef.current).toBe(button);
    expect(childRef.current).toBe(button);
  });

  it("renders the CSS shadow sibling strategy", () => {
    act(() => {
      root.render(
        <SmoothCorners
          autoEffects={false}
          corners={{ radius: 12 }}
          shadowStrategy="box-shadow"
          shadow={{
            offsetX: 0,
            offsetY: 4,
            blur: 12,
            spread: 0,
            color: "#000000",
            opacity: 0.25,
          }}
        />
      );
    });

    const sibling = container.querySelector<HTMLElement>(
      "[data-slot='smooth-corners-box-shadow']",
    );
    expect(sibling).not.toBeNull();
    expect(sibling?.style.boxShadow).toContain("rgba(0,0,0,0.25)");
  });

  it("restores the original clip path on unmount", () => {
    const element = document.createElement("div");
    element.style.clipPath = "circle(10px)";
    document.body.appendChild(element);

    function Tester(): unknown {
      // The public hook normally receives this slot from the Octane compiler.
      // This test is plain TypeScript, so the slot is supplied explicitly.
      const ref = { current: element };
      useSmoothCorners(ref, { radius: 8 }, { autoEffects: false }, Symbol.for("test:hook"));
      return null;
    }

    act(() => root.render(<Tester />));
    expect(element.getAttribute("data-slot")).toBe("smooth-corners");
    act(() => root.unmount());
    expect(element.style.clipPath).toBe("circle(10px)");
    expect(element.getAttribute("data-slot")).toBeNull();
    element.remove();
  });
});
