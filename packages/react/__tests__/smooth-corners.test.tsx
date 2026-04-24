// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useRef, forwardRef } from "react";
import { SmoothCorners } from "../src/smooth-corners.js";
import { useSmoothCorners } from "../src/use-smooth-corners.js";
import { Slot } from "../src/slot.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  // happy-dom doesn't ship a ResizeObserver; provide a no-op so the hook
  // can call observe()/disconnect() without throwing.
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
  act(() => {
    root.unmount();
  });
  container.remove();
});

describe("<SmoothCorners /> - wrapper-skip", () => {
  it("renders only the as element when autoEffects=false and no effects", () => {
    act(() => {
      root.render(
        <SmoothCorners as="span" autoEffects={false} corners={{ radius: 12 }}>
          hi
        </SmoothCorners>,
      );
    });
    const span = container.querySelector("span");
    expect(span).not.toBeNull();
    expect(span?.parentElement).toBe(container);
  });

  it("wraps the as element in a div when autoEffects defaults to true", () => {
    act(() => {
      root.render(
        <SmoothCorners as="span" corners={{ radius: 12 }}>
          hi
        </SmoothCorners>,
      );
    });
    const span = container.querySelector("span");
    expect(span?.parentElement?.tagName).toBe("DIV");
    expect(span?.parentElement?.parentElement).toBe(container);
  });
});

describe("<SmoothCorners /> - data attributes", () => {
  it("applies data-slot on the inner element", () => {
    act(() => {
      root.render(
        <SmoothCorners autoEffects={false} corners={{ radius: 8 }}>
          x
        </SmoothCorners>,
      );
    });
    const el = container.querySelector("[data-slot='smooth-corners']");
    expect(el).not.toBeNull();
  });

  it("starts with data-state=pending", () => {
    act(() => {
      root.render(
        <SmoothCorners autoEffects={false} corners={{ radius: 8 }}>
          x
        </SmoothCorners>,
      );
    });
    const el = container.querySelector("[data-slot='smooth-corners']");
    // Without a real layout, the resize callback never fires so we stay pending.
    expect(el?.getAttribute("data-state")).toBe("pending");
  });
});

describe("useSmoothCorners - clip-path save/restore", () => {
  it("restores the prior inline clip-path and removes data attributes on unmount", () => {
    // Drive the hook directly against an element we own. That way the
    // element survives React's unmount and we can inspect style.clipPath
    // and the data attributes after cleanup has run.
    const el = document.createElement("div");
    el.style.clipPath = "circle(10px)";
    document.body.appendChild(el);

    const ref = { current: el } as React.RefObject<HTMLElement>;

    const localContainer = document.createElement("div");
    document.body.appendChild(localContainer);
    const localRoot = createRoot(localContainer);

    function Tester() {
      useSmoothCorners(ref, { radius: 8 }, { autoEffects: false });
      return null;
    }

    act(() => {
      localRoot.render(<Tester />);
    });

    // While mounted, the hook attaches the data attributes.
    expect(el.getAttribute("data-slot")).toBe("smooth-corners");

    act(() => {
      localRoot.unmount();
    });

    // After unmount, the hook's cleanup has run: the original clip-path
    // is restored and the data attributes are gone.
    expect(el.style.clipPath).toBe("circle(10px)");
    expect(el.getAttribute("data-slot")).toBeNull();
    expect(el.getAttribute("data-state")).toBeNull();

    localContainer.remove();
    el.remove();
  });
});

describe("<SmoothCorners /> - asChild", () => {
  it("merges props onto the child element instead of wrapping", () => {
    const handleClick = vi.fn();
    act(() => {
      root.render(
        <SmoothCorners
          asChild
          autoEffects={false}
          corners={{ radius: 8 }}
          onClick={handleClick}
          className="outer"
          data-test="ok"
        >
          <button className="inner" type="button">
            click
          </button>
        </SmoothCorners>,
      );
    });
    const button = container.querySelector("button");
    expect(button).not.toBeNull();
    // No wrapper div should have been added.
    expect(button?.parentElement).toBe(container);
    // Class names merged (parent first, child second).
    expect(button?.className).toBe("outer inner");
    // data attribute forwarded.
    expect(button?.getAttribute("data-test")).toBe("ok");
    // Event handler composed onto child.
    button?.click();
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});

describe("<Slot /> - error messages are reachable", () => {
  // React logs errors to console.error before rethrowing; suppress to
  // keep vitest output clean while still asserting the thrown message.
  let originalError: typeof console.error;
  beforeEach(() => {
    originalError = console.error;
    console.error = vi.fn();
  });
  afterEach(() => {
    console.error = originalError;
  });

  it("throws the library's own error when given zero children", () => {
    expect(() => {
      act(() => {
        root.render(<Slot>{null}</Slot>);
      });
    }).toThrow("Slot: `asChild` expects exactly one child.");
  });

  it("throws the library's own error when given multiple children", () => {
    expect(() => {
      act(() => {
        root.render(
          <Slot>
            <span>a</span>
            <span>b</span>
          </Slot>,
        );
      });
    }).toThrow("Slot: `asChild` expects exactly one child.");
  });

  it("throws the library's own error when the child is not a valid element", () => {
    expect(() => {
      act(() => {
        root.render(<Slot>plain text</Slot>);
      });
    }).toThrow("Slot: child must be a valid React element.");
  });
});

describe("<SmoothCorners /> - ref forwarding", () => {
  it("forwards the external ref to the inner element", () => {
    const ref = { current: null as HTMLElement | null };
    const Tester = forwardRef<HTMLElement>((_, fwd) => {
      return (
        <SmoothCorners ref={fwd} autoEffects={false} corners={{ radius: 8 }} id="forwarded">
          x
        </SmoothCorners>
      );
    });
    act(() => {
      root.render(<Tester ref={ref} />);
    });
    expect(ref.current).not.toBeNull();
    expect(ref.current?.id).toBe("forwarded");
  });
});
