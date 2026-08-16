/** @jsx createElement */
// @vitest-environment happy-dom
import { act, createElement, createRoot, type Root } from "octane";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  installHarness,
  uninstallHarness,
  type RuntimeHarness,
} from "../../core/__tests__/harness/runtime-harness.ts";
import { SmoothCorners } from "../src/smooth-corners.js";
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

describe("Octane adapter — runtime harness", () => {
  it("batches multiple resize entries into one rAF flush", () => {
    act(() =>
      root.render(<SmoothCorners as="div" autoEffects={false} corners={{ radius: 16 }} />),
    );
    const el = getInner(container);
    stubLayout(el);

    act(() => {
      harness.deliverResize(el, 200, 100);
      harness.deliverResize(el, 250, 120);
      harness.deliverResize(el, 300, 140);
    });

    expect(harness.pendingRafCount()).toBeLessThanOrEqual(1);
    act(() => harness.flushRaf());
    expect(harness.pendingRafCount()).toBe(0);
    expect(el.style.clipPath).not.toBe("");
  });

  it("updates the clip-path style when the radius prop changes", () => {
    function App(props: { r: number }): unknown {
      return <SmoothCorners as="div" autoEffects={false} corners={{ radius: props.r }} />;
    }

    act(() => root.render(<App r={8} />));
    const el = getInner(container);
    stubLayout(el);
    act(() => {
      harness.deliverResize(el);
      harness.flushRaf();
    });
    const before = el.style.clipPath;

    act(() => root.render(<App r={32} />));
    act(() => harness.flushRaf());

    expect(before).not.toBe("");
    expect(el.style.clipPath).not.toBe("");
    expect(el.style.clipPath).not.toBe(before);
  });

  it("handles effects prop changes without crashing", () => {
    function App(props: { withBorder: boolean }): unknown {
      return (
        <SmoothCorners
          as="div"
          autoEffects={false}
          corners={{ radius: 12 }}
          innerBorder={
            props.withBorder ? { width: 2, color: "#000", opacity: 1 } : undefined
          }
        >
          content
        </SmoothCorners>
      );
    }

    act(() => root.render(<App withBorder={false} />));
    const el = getInner(container);
    stubLayout(el);
    act(() => {
      harness.deliverResize(el);
      harness.flushRaf();
    });
    expect(el.style.clipPath).not.toBe("");

    act(() => root.render(<App withBorder />));
    act(() => {
      harness.deliverResize(el);
      harness.flushRaf();
    });
    expect(el.style.clipPath).not.toBe("");
    expect(el.getAttribute("data-slot")).toBe("smooth-corners");
  });

  it("releases the observer when the last subscriber unmounts", () => {
    act(() =>
      root.render(<SmoothCorners as="div" autoEffects={false} corners={{ radius: 12 }} />),
    );
    const el = getInner(container);
    stubLayout(el);
    act(() => {
      harness.deliverResize(el);
      harness.flushRaf();
    });
    expect(harness.isObserved(el)).toBe(true);

    act(() => root.unmount());
    expect(harness.isObserved(el)).toBe(false);
  });

  it("does not double-subscribe on re-render", () => {
    function App(props: { r: number }): unknown {
      return <SmoothCorners as="div" autoEffects={false} corners={{ radius: props.r }} />;
    }

    act(() => root.render(<App r={12} />));
    const el = getInner(container);
    const observersAfterMount = harness.observerCount();
    expect(observersAfterMount).toBeGreaterThanOrEqual(1);

    act(() => root.render(<App r={16} />));
    act(() => root.render(<App r={20} />));

    expect(harness.observerCount()).toBe(observersAfterMount);
    expect(harness.isObserved(el)).toBe(true);
  });
});

describe("Octane adapter — SSR border-radius fallback teardown", () => {
  it("clears the fallback once the clip-path lands, but not before", () => {
    act(() =>
      root.render(<SmoothCorners as="div" autoEffects={false} corners={{ radius: 16 }} />),
    );
    const el = getInner(container);
    expect(el.style.borderRadius).toBe("16px");
    expect(el.style.clipPath).toBe("");

    stubLayout(el);
    act(() => {
      harness.deliverResize(el);
      harness.flushRaf();
    });
    expect(el.style.clipPath).not.toBe("");
    expect(el.style.borderRadius).toBe("");
  });

  it("leaves a user-supplied border-radius untouched", () => {
    act(() =>
      root.render(
        <SmoothCorners
          as="div"
          autoEffects={false}
          corners={{ radius: 16 }}
          style={{ borderRadius: 4 }}
        />,
      ),
    );
    const el = getInner(container);
    stubLayout(el);
    act(() => {
      harness.deliverResize(el);
      harness.flushRaf();
    });
    expect(el.style.clipPath).not.toBe("");
    expect(el.style.borderRadius).toBe("4px");
  });

  it("leaves a user-supplied per-corner radius untouched", () => {
    act(() =>
      root.render(
        <SmoothCorners
          as="div"
          autoEffects={false}
          corners={{ radius: 16 }}
          style={{ borderTopLeftRadius: 8 }}
        />,
      ),
    );
    const el = getInner(container);
    stubLayout(el);
    act(() => {
      harness.deliverResize(el);
      harness.flushRaf();
    });
    expect(el.style.clipPath).not.toBe("");
    expect(el.style.borderTopLeftRadius).toBe("8px");
  });

  it("leaves an asChild child's border-radius untouched", () => {
    act(() =>
      root.render(
        <SmoothCorners asChild autoEffects={false} corners={{ radius: 16 }}>
          <div style={{ borderRadius: 4 }} />
        </SmoothCorners>,
      ),
    );
    const el = getInner(container);
    stubLayout(el);
    act(() => {
      harness.deliverResize(el);
      harness.flushRaf();
    });
    expect(el.style.clipPath).not.toBe("");
    expect(el.style.borderRadius).toBe("4px");
  });

  it("restores the fallback on unmount", () => {
    act(() =>
      root.render(<SmoothCorners as="div" autoEffects={false} corners={{ radius: 16 }} />),
    );
    const el = getInner(container);
    stubLayout(el);
    act(() => {
      harness.deliverResize(el);
      harness.flushRaf();
    });
    expect(el.style.borderRadius).toBe("");

    act(() => root.unmount());
    expect(el.style.borderRadius).toBe("16px");
  });
});

describe("Octane adapter — shadowStrategy toggle re-renders the SVG shadow", () => {
  it("renders the SVG drop-shadow after flipping box-shadow -> svg and back", () => {
    const shadow = { offsetX: 0, offsetY: 4, blur: 8, spread: 0, color: "#000", opacity: 0.5 };
    function App(props: { strategy: "svg" | "box-shadow" }): unknown {
      return (
        <SmoothCorners
          as="div"
          autoEffects={false}
          corners={{ radius: 12 }}
          shadowStrategy={props.strategy}
          shadow={shadow}
        >
          x
        </SmoothCorners>
      );
    }

    act(() => root.render(<App strategy="svg" />));
    const el = getInner(container);
    const wrapper = el.parentElement as HTMLElement;
    stubLayout(el);
    act(() => {
      harness.deliverResize(el);
      harness.flushRaf();
    });

    const dropShadowD = (): string | null => {
      const svg = Array.from(wrapper.querySelectorAll("svg")).find(
        (item) => (item as SVGElement).style.zIndex === "-1",
      ) as SVGElement | undefined;
      return svg?.querySelector("path")?.getAttribute("d") ?? null;
    };
    expect(dropShadowD()).toBeTruthy();

    act(() => root.render(<App strategy="box-shadow" />));
    act(() => {
      harness.deliverResize(el);
      harness.flushRaf();
    });
    act(() => root.render(<App strategy="svg" />));
    act(() => {
      harness.deliverResize(el);
      harness.flushRaf();
    });
    expect(dropShadowD()).toBeTruthy();
  });
});
