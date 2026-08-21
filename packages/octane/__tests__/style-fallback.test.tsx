/** @jsx createElement */
// @vitest-environment happy-dom
import { act, createElement, createRoot, type Root } from "octane";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  installHarness,
  uninstallHarness,
  type RuntimeHarness,
} from "../../core/__tests__/harness/runtime-harness.ts";
import { Slot, SmoothCorners } from "../src/index.js";
import { getInner, stubLayout } from "./helpers.js";

let container: HTMLDivElement;
let root: Root;
let harness: RuntimeHarness;

beforeEach(() => {
  harness = installHarness();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  uninstallHarness();
});

function landClipPath(el: HTMLElement): void {
  stubLayout(el);
  act(() => {
    harness.deliverResize(el);
    harness.flushRaf();
  });
}

describe("Octane adapter — SSR fallback with a CSS-text style", () => {
  it("delivers the fallback alongside a string style that sets no radius", () => {
    act(() =>
      root.render(
        <SmoothCorners
          as="div"
          autoEffects={false}
          corners={{ radius: 16 }}
          style="background-color: red"
        />,
      ),
    );
    const el = getInner(container);
    expect(el.style.borderRadius).toBe("16px");
    expect(el.style.backgroundColor).toBe("red");

    landClipPath(el);
    expect(el.style.clipPath).not.toBe("");
    expect(el.style.borderRadius).toBe("");
    expect(el.style.backgroundColor).toBe("red");
  });

  it("leaves a string style that already sets a radius alone", () => {
    act(() =>
      root.render(
        <SmoothCorners
          as="div"
          autoEffects={false}
          corners={{ radius: 16 }}
          style="border-radius: 4px"
        />,
      ),
    );
    const el = getInner(container);
    expect(el.style.borderRadius).toBe("4px");

    landClipPath(el);
    expect(el.style.clipPath).not.toBe("");
    expect(el.style.borderRadius).toBe("4px");
  });

  it("recognises a per-corner longhand in a string style", () => {
    act(() =>
      root.render(
        <SmoothCorners
          as="div"
          autoEffects={false}
          corners={{ radius: 16 }}
          style="border-top-left-radius: 8px"
        />,
      ),
    );
    const el = getInner(container);
    // Unlike a duplicate shorthand, a prepended one here would round the other three corners.
    expect(el.getAttribute("style") ?? "").not.toContain("16px");

    landClipPath(el);
    expect(el.style.clipPath).not.toBe("");
    expect(el.style.borderTopLeftRadius).toBe("8px");
  });

  it("keeps the object style path unchanged", () => {
    act(() =>
      root.render(
        <SmoothCorners
          as="div"
          autoEffects={false}
          corners={{ radius: 16 }}
          style={{ backgroundColor: "red" }}
        />,
      ),
    );
    const el = getInner(container);
    expect(el.style.borderRadius).toBe("16px");
    expect(el.style.backgroundColor).toBe("red");

    landClipPath(el);
    expect(el.style.clipPath).not.toBe("");
    expect(el.style.borderRadius).toBe("");
    expect(el.style.backgroundColor).toBe("red");
  });
});

describe("Octane adapter — SSR fallback through asChild", () => {
  it("keeps the fallback when the child supplies a string style", () => {
    act(() =>
      root.render(
        <SmoothCorners asChild autoEffects={false} corners={{ radius: 16 }}>
          <button style="color: red" type="button">
            save
          </button>
        </SmoothCorners>,
      ),
    );
    const el = getInner(container);
    expect(el.tagName).toBe("BUTTON");
    expect(el.style.borderRadius).toBe("16px");
    expect(el.style.color).toBe("red");

    landClipPath(el);
    expect(el.style.clipPath).not.toBe("");
    expect(el.style.borderRadius).toBe("");
    expect(el.style.color).toBe("red");
  });

  it("lets a radius in the child's string style win and survive", () => {
    act(() =>
      root.render(
        <SmoothCorners
          asChild
          autoEffects={false}
          corners={{ radius: 16 }}
          style={{ backgroundColor: "green" }}
        >
          <button style="border-radius: 4px" type="button">
            save
          </button>
        </SmoothCorners>,
      ),
    );
    const el = getInner(container);
    expect(el.style.borderRadius).toBe("4px");
    expect(el.style.backgroundColor).toBe("green");

    landClipPath(el);
    expect(el.style.clipPath).not.toBe("");
    expect(el.style.borderRadius).toBe("4px");
  });
});

describe("Octane adapter — Slot style merge", () => {
  it("merges an object parent with a CSS-text child, child winning", () => {
    act(() =>
      root.render(
        <Slot style={{ color: "blue", backgroundColor: "green" }}>
          <button style="color: red" type="button">
            save
          </button>
        </Slot>,
      ),
    );
    const el = container.querySelector("button")!;
    expect(el.style.color).toBe("red");
    expect(el.style.backgroundColor).toBe("green");
  });

  it("merges a CSS-text parent with an object child, child winning", () => {
    act(() =>
      root.render(
        <Slot style="color: blue; background-color: green">
          <button style={{ color: "red" }} type="button">
            save
          </button>
        </Slot>,
      ),
    );
    const el = container.querySelector("button")!;
    expect(el.style.color).toBe("red");
    expect(el.style.backgroundColor).toBe("green");
  });

  it("concatenates two CSS-text styles with the child's declarations last", () => {
    act(() =>
      root.render(
        <Slot style="color: blue; background-color: green">
          <button style="color: red" type="button">
            save
          </button>
        </Slot>,
      ),
    );
    const el = container.querySelector("button")!;
    expect(el.style.color).toBe("red");
    expect(el.style.backgroundColor).toBe("green");
  });

  it("keeps the parent style when the child explicitly clears its own", () => {
    act(() =>
      root.render(
        <Slot style={{ color: "blue" }}>
          <button style={undefined} type="button">
            save
          </button>
        </Slot>,
      ),
    );
    const el = container.querySelector("button")!;
    expect(el.style.color).toBe("blue");
  });

  it("does not split a declaration value on its own semicolons", () => {
    act(() =>
      root.render(
        <Slot style={{ color: "blue", backgroundColor: "green" }}>
          <button
            style="background-image: url(data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=); color: red"
            type="button"
          >
            save
          </button>
        </Slot>,
      ),
    );
    const el = container.querySelector("button")!;
    expect(el.style.backgroundImage).toContain("base64,PHN2Zz48L3N2Zz4=");
    expect(el.style.color).toBe("red");
    expect(el.style.backgroundColor).toBe("green");
  });
});
