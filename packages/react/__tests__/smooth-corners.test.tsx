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

describe("useSmoothCorners - detach before unmount", () => {
  it("cleans up without throwing when the element is detached between mount and unmount", () => {
    const parent = document.createElement("div");
    parent.style.position = "relative";
    document.body.appendChild(parent);

    const el = document.createElement("div");
    parent.appendChild(el);

    const ref = { current: el } as React.RefObject<HTMLElement>;
    const localContainer = document.createElement("div");
    document.body.appendChild(localContainer);
    const localRoot = createRoot(localContainer);

    function Tester() {
      useSmoothCorners(
        ref,
        { radius: 8 },
        {
          autoEffects: false,
          effects: { innerBorder: { width: 2, color: "#000", opacity: 1 } },
        },
      );
      return null;
    }

    act(() => {
      localRoot.render(<Tester />);
    });

    parent.removeChild(el);

    expect(() => {
      act(() => {
        localRoot.unmount();
      });
    }).not.toThrow();

    localContainer.remove();
    parent.remove();
  });
});

describe("useSmoothCorners - autoEffects toggle cycle", () => {
  it("strips CSS effects on extraction and restores them when autoEffects flips off", () => {
    const el = document.createElement("div");
    // happy-dom does not resolve named colours via getComputedStyle, so the
    // guarded `extractAndStripEffects` treats "red" as unparseable. Use an
    // rgb() colour to exercise the successful-parse path.
    el.style.border = "2px solid rgb(255, 0, 0)";
    document.body.appendChild(el);

    const ref = { current: el } as React.RefObject<HTMLElement>;
    const localContainer = document.createElement("div");
    document.body.appendChild(localContainer);
    const localRoot = createRoot(localContainer);

    function Tester({ autoEffects }: { autoEffects: boolean }) {
      useSmoothCorners(ref, { radius: 8 }, { autoEffects });
      return null;
    }

    act(() => {
      localRoot.render(<Tester autoEffects={true} />);
    });
    // `extractAndStripEffects` writes `border = "0"`, which user agents
    // normalise back to `"0px"` on read.
    expect(el.style.border).toBe("0px");

    act(() => {
      localRoot.render(<Tester autoEffects={false} />);
    });
    expect(el.style.border).toBe("2px solid rgb(255, 0, 0)");

    act(() => {
      localRoot.render(<Tester autoEffects={true} />);
    });
    expect(el.style.border).toBe("0px");

    act(() => {
      localRoot.unmount();
    });
    expect(el.style.border).toBe("2px solid rgb(255, 0, 0)");

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

  it("wraps the cloned child in a wrapper div when effects are present", () => {
    act(() => {
      root.render(
        <SmoothCorners
          asChild
          corners={{ radius: 8 }}
          innerBorder={{ width: 2, color: "#000", opacity: 1 }}
        >
          <button type="button">click</button>
        </SmoothCorners>,
      );
    });
    const button = container.querySelector("button");
    expect(button).not.toBeNull();
    // Effects require a wrapper div with position: relative for the SVG overlay.
    const wrapper = button?.parentElement;
    expect(wrapper?.tagName).toBe("DIV");
    expect(wrapper?.style.position).toBe("relative");
    expect(button?.getAttribute("data-slot")).toBe("smooth-corners");
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

  it("throws when given zero children", () => {
    expect(() => {
      act(() => {
        root.render(<Slot>{null}</Slot>);
      });
    }).toThrow("received none");
  });

  it("throws with a count when given multiple children", () => {
    expect(() => {
      act(() => {
        root.render(
          <Slot>
            <span>a</span>
            <span>b</span>
          </Slot>,
        );
      });
    }).toThrow("received 2");
  });

  it("throws with Fragment hint when the child is a Fragment", () => {
    expect(() => {
      act(() => {
        root.render(
          <Slot>
            <>
              <span>a</span>
              <span>b</span>
            </>
          </Slot>,
        );
      });
    }).toThrow("not a Fragment");
  });

  it("throws when the child is plain text", () => {
    expect(() => {
      act(() => {
        root.render(<Slot>plain text</Slot>);
      });
    }).toThrow("not a string");
  });
});

describe("<Slot /> - preventDefault gating", () => {
  it("skips the parent handler when the child calls event.preventDefault()", () => {
    const parent = vi.fn();
    const child = vi.fn((e: React.MouseEvent) => {
      e.preventDefault();
    });
    act(() => {
      root.render(
        <Slot onClick={parent}>
          <button type="button" onClick={child}>
            x
          </button>
        </Slot>,
      );
    });
    container.querySelector("button")?.click();
    expect(child).toHaveBeenCalledTimes(1);
    expect(parent).not.toHaveBeenCalled();
  });

  it("still calls the parent handler when the child does not preventDefault", () => {
    const parent = vi.fn();
    const child = vi.fn();
    act(() => {
      root.render(
        <Slot onClick={parent}>
          <button type="button" onClick={child}>
            x
          </button>
        </Slot>,
      );
    });
    container.querySelector("button")?.click();
    expect(child).toHaveBeenCalledTimes(1);
    expect(parent).toHaveBeenCalledTimes(1);
  });
});

describe("<Slot /> - child ref composition", () => {
  it("composes the Slot's forwarded ref with the child's own ref (React 19 props.ref and React 18 element.ref)", () => {
    const outerRef = { current: null as HTMLElement | null };
    const childRef = { current: null as HTMLButtonElement | null };

    const Child = forwardRef<HTMLButtonElement, { children?: React.ReactNode }>(
      function Child(props, ref) {
        return (
          <button ref={ref} type="button">
            {props.children}
          </button>
        );
      },
    );

    act(() => {
      root.render(
        <Slot ref={outerRef}>
          <Child ref={childRef}>x</Child>
        </Slot>,
      );
    });

    const button = container.querySelector("button");
    expect(button).not.toBeNull();
    // Both refs resolve to the same rendered DOM element.
    expect(outerRef.current).toBe(button);
    expect(childRef.current).toBe(button);
  });
});

describe("<Slot /> - generic element typing", () => {
  it("accepts anchor attributes when parameterised over 'a'", () => {
    act(() => {
      root.render(
        <Slot<"a"> href="/x">
          <a>link</a>
        </Slot>,
      );
    });
    const a = container.querySelector("a");
    expect(a?.getAttribute("href")).toBe("/x");
  });

  it("accepts button attributes when parameterised over 'button'", () => {
    act(() => {
      root.render(
        <Slot<"button"> type="submit">
          <button>submit</button>
        </Slot>,
      );
    });
    const button = container.querySelector("button");
    expect(button?.getAttribute("type")).toBe("submit");
  });
});

describe("<SmoothCorners /> - effects toggle stability", () => {
  it("does not recreate SVG handles when effects toggle on and off", () => {
    function Tester({ withBorder }: { withBorder: boolean }) {
      return (
        <SmoothCorners
          corners={{ radius: 8 }}
          innerBorder={
            withBorder ? { width: 2, color: "#000", opacity: 1 } : undefined
          }
        >
          x
        </SmoothCorners>
      );
    }

    act(() => {
      root.render(<Tester withBorder={true} />);
    });

    const wrapper = container.querySelector("[data-slot='smooth-corners']")
      ?.parentElement;
    expect(wrapper).not.toBeNull();
    const svgsAfterMount = Array.from(wrapper!.querySelectorAll("svg"));
    expect(svgsAfterMount.length).toBeGreaterThan(0);

    act(() => {
      root.render(<Tester withBorder={false} />);
    });
    act(() => {
      root.render(<Tester withBorder={true} />);
    });

    const svgsAfterToggle = Array.from(wrapper!.querySelectorAll("svg"));
    // Same SVG element references — no teardown/recreate cycle.
    expect(svgsAfterToggle).toEqual(svgsAfterMount);
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
