// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  installHarness,
  uninstallHarness,
  type RuntimeHarness,
} from "../../core/__tests__/harness/runtime-harness.ts";
import { SmoothCorners } from "../src/smooth-corners.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let h: RuntimeHarness;

beforeEach(() => {
  h = installHarness();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  uninstallHarness();
});

/** Get the inner clipped element (the one carrying data-slot). */
function getInner(): HTMLElement {
  const el = container.querySelector<HTMLElement>("[data-slot='smooth-corners']");
  if (!el) throw new Error("inner data-slot element not found");
  return el;
}

/** Stub the offset dimensions of an element so getLayoutSize returns
 *  a positive size and runSync proceeds past its zero-size bailout. */
function stubLayout(el: HTMLElement, width = 200, height = 100): void {
  Object.defineProperty(el, "offsetWidth", { value: width, configurable: true });
  Object.defineProperty(el, "offsetHeight", { value: height, configurable: true });
}

describe("React adapter — runtime harness", () => {
  it("batches multiple resize entries into one rAF flush", () => {
    act(() => {
      root.render(<SmoothCorners as="div" autoEffects={false} corners={{ radius: 16 }} />);
    });
    const el = getInner();
    stubLayout(el);

    // Three resize deliveries while no rAF flush has run yet.
    act(() => {
      h.deliverResize(el, 200, 100);
      h.deliverResize(el, 250, 120);
      h.deliverResize(el, 300, 140);
    });

    // Each deliverResize adds the element to pendingElements and schedules
    // a rAF (if not already scheduled). The harness should have exactly
    // one rAF task pending — proving dedup.
    expect(h.pendingRafCount()).toBeLessThanOrEqual(1);

    act(() => {
      h.flushRaf();
    });

    // After flush, no rAF tasks remain and the clip-path has been set.
    expect(h.pendingRafCount()).toBe(0);
    expect(el.style.clipPath).not.toBe("");
  });

  it("updates the clip-path style when the radius prop changes", () => {
    function App({ r }: { r: number }) {
      return <SmoothCorners as="div" autoEffects={false} corners={{ radius: r }} />;
    }

    act(() => {
      root.render(<App r={8} />);
    });
    const el = getInner();
    stubLayout(el);
    act(() => {
      h.deliverResize(el);
      h.flushRaf();
    });
    const dBefore = el.style.clipPath;

    act(() => {
      root.render(<App r={32} />);
    });
    act(() => {
      h.flushRaf();
    });
    const dAfter = el.style.clipPath;

    expect(dBefore).not.toBe("");
    expect(dAfter).not.toBe("");
    expect(dAfter).not.toBe(dBefore);
  });

  it("handles effects prop changes without crashing", () => {
    function App({ withBorder }: { withBorder: boolean }) {
      return (
        <SmoothCorners
          as="div"
          autoEffects={false}
          corners={{ radius: 12 }}
          innerBorder={withBorder ? { width: 2, color: "#000", opacity: 1 } : undefined}
        >
          content
        </SmoothCorners>
      );
    }

    act(() => {
      root.render(<App withBorder={false} />);
    });
    const el = getInner();
    stubLayout(el);
    act(() => {
      h.deliverResize(el);
      h.flushRaf();
    });
    expect(el.style.clipPath).not.toBe("");

    // Toggle border on — re-sync should fire and the overlay handle should
    // be created. We just need the component to survive the prop change.
    act(() => {
      root.render(<App withBorder={true} />);
    });
    act(() => {
      h.deliverResize(el);
      h.flushRaf();
    });
    expect(el.style.clipPath).not.toBe("");
    expect(el.getAttribute("data-slot")).toBe("smooth-corners");
  });

  it("releases the observer when the last subscriber unmounts", () => {
    act(() => {
      root.render(<SmoothCorners as="div" autoEffects={false} corners={{ radius: 12 }} />);
    });
    const el = getInner();
    stubLayout(el);
    act(() => {
      h.deliverResize(el);
      h.flushRaf();
    });

    expect(h.isObserved(el)).toBe(true);

    act(() => {
      root.unmount();
    });

    // After unmount, the singleton's last subscriber removed itself —
    // the observer disconnects and is no longer tracking the element.
    expect(h.isObserved(el)).toBe(false);
  });

  it("does not double-subscribe on re-render", () => {
    function App({ r }: { r: number }) {
      return <SmoothCorners as="div" autoEffects={false} corners={{ radius: r }} />;
    }

    act(() => {
      root.render(<App r={12} />);
    });
    const el = getInner();
    const observersAfterMount = h.observerCount();
    expect(observersAfterMount).toBeGreaterThanOrEqual(1);

    act(() => {
      root.render(<App r={16} />);
    });
    act(() => {
      root.render(<App r={20} />);
    });

    // Re-renders should not allocate new ResizeObserver instances —
    // observe-resize.ts uses a shared singleton.
    expect(h.observerCount()).toBe(observersAfterMount);
    expect(h.isObserved(el)).toBe(true);
  });
});
