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

describe("React adapter — SSR border-radius fallback teardown", () => {
  it("clears the fallback once the clip-path lands, but not before", () => {
    act(() => {
      root.render(<SmoothCorners as="div" autoEffects={false} corners={{ radius: 16 }} />);
    });
    const el = getInner();

    // Before the clip-path lands (zero-size element), the SSR fallback stays so
    // corners still look rounded pre-clip.
    expect(el.style.borderRadius).toBe("16px");
    expect(el.style.clipPath).toBe("");

    stubLayout(el);
    act(() => {
      h.deliverResize(el);
      h.flushRaf();
    });

    // Clip-path is the silhouette now; the intersecting fallback must be gone.
    expect(el.style.clipPath).not.toBe("");
    expect(el.style.borderRadius).toBe("");
  });

  it("leaves a user-supplied border-radius untouched", () => {
    act(() => {
      root.render(
        <SmoothCorners
          as="div"
          autoEffects={false}
          corners={{ radius: 16 }}
          style={{ borderRadius: 4 }}
        />,
      );
    });
    const el = getInner();
    stubLayout(el);
    act(() => {
      h.deliverResize(el);
      h.flushRaf();
    });

    expect(el.style.clipPath).not.toBe("");
    expect(el.style.borderRadius).toBe("4px");
  });

  it("leaves an asChild child's border-radius untouched", () => {
    act(() => {
      root.render(
        <SmoothCorners asChild autoEffects={false} corners={{ radius: 16 }}>
          <div style={{ borderRadius: 4 }} />
        </SmoothCorners>,
      );
    });
    const el = getInner();
    stubLayout(el);
    act(() => {
      h.deliverResize(el);
      h.flushRaf();
    });

    expect(el.style.clipPath).not.toBe("");
    expect(el.style.borderRadius).toBe("4px");
  });

  it("restores the fallback on unmount", () => {
    act(() => {
      root.render(<SmoothCorners as="div" autoEffects={false} corners={{ radius: 16 }} />);
    });
    const el = getInner();
    stubLayout(el);
    act(() => {
      h.deliverResize(el);
      h.flushRaf();
    });
    expect(el.style.borderRadius).toBe("");

    act(() => {
      root.unmount();
    });
    // The detached element carries the fallback again (remount safety).
    expect(el.style.borderRadius).toBe("16px");
  });
});

describe("React adapter — shadowStrategy toggle re-renders the SVG shadow", () => {
  it("renders the SVG drop-shadow after flipping box-shadow -> svg and back", () => {
    const shadow = { offsetX: 0, offsetY: 4, blur: 8, spread: 0, color: "#000", opacity: 0.5 };
    function App({ strategy }: { strategy: "svg" | "box-shadow" }) {
      return (
        <SmoothCorners
          as="div"
          autoEffects={false}
          corners={{ radius: 12 }}
          shadowStrategy={strategy}
          shadow={shadow}
        >
          x
        </SmoothCorners>
      );
    }

    act(() => {
      root.render(<App strategy="svg" />);
    });
    const el = getInner();
    const wrapper = el.parentElement as HTMLElement;
    stubLayout(el);
    act(() => {
      h.deliverResize(el);
      h.flushRaf();
    });

    const dropShadowD = (): string | null => {
      const svg = Array.from(wrapper.querySelectorAll("svg")).find(
        (s) => (s as SVGElement).style.zIndex === "-1",
      ) as SVGElement | undefined;
      return svg?.querySelector("path")?.getAttribute("d") ?? null;
    };

    expect(dropShadowD()).toBeTruthy();

    // Flip to CSS box-shadow: SVG drop-shadow handle is torn down.
    act(() => {
      root.render(<App strategy="box-shadow" />);
    });
    act(() => {
      h.deliverResize(el);
      h.flushRaf();
    });

    // Flip back to SVG: the fresh handle must actually render (get a `d`),
    // not sit empty behind the unchanged-key guard.
    act(() => {
      root.render(<App strategy="svg" />);
    });
    act(() => {
      h.deliverResize(el);
      h.flushRaf();
    });

    expect(dropShadowD()).toBeTruthy();
  });
});
