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

    expect(el.getAttribute("data-slot")).toBe("smooth-corners");

    act(() => {
      localRoot.unmount();
    });

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
    expect(button?.parentElement).toBe(container);
    expect(button?.className).toBe("outer inner");
    expect(button?.getAttribute("data-test")).toBe("ok");
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

describe("<SmoothCorners /> - lazy drop-shadow", () => {
  it("creates no drop-shadow SVG when only innerBorder is present", () => {
    act(() => {
      root.render(
        <SmoothCorners
          autoEffects={false}
          corners={{ radius: 8 }}
          innerBorder={{ width: 2, color: "#000", opacity: 1 }}
        >
          x
        </SmoothCorners>,
      );
    });

    const inner = container.querySelector("[data-slot='smooth-corners']");
    const wrapper = inner?.parentElement as HTMLElement | null;
    expect(wrapper).not.toBeNull();

    // svg-effects ships one SVG overlay for borders / inner shadows.
    // The drop-shadow SVG is a separate second element with z-index:-1.
    // With the lazy fix it should not be created when only border effects
    // are in play.
    const svgs = wrapper!.querySelectorAll("svg");
    expect(svgs.length).toBe(1);
    const dropShadowSvg = Array.from(svgs).find(
      (s) => (s as SVGElement).style.zIndex === "-1",
    );
    expect(dropShadowSvg).toBeUndefined();

    // `createDropShadow` also sets `isolation:isolate` on the anchor.
    // When skipped, the anchor must not carry that mutation.
    expect(wrapper!.style.isolation).toBe("");
  });

  it("creates a drop-shadow SVG lazily when shadow is added later", () => {
    function Tester({ withShadow }: { withShadow: boolean }) {
      return (
        <SmoothCorners
          autoEffects={false}
          corners={{ radius: 8 }}
          innerBorder={{ width: 2, color: "#000", opacity: 1 }}
          shadow={
            withShadow
              ? { offsetX: 0, offsetY: 4, blur: 8, spread: 0, color: "#000", opacity: 0.5 }
              : undefined
          }
        >
          x
        </SmoothCorners>
      );
    }

    act(() => {
      root.render(<Tester withShadow={false} />);
    });

    const inner = container.querySelector("[data-slot='smooth-corners']");
    const wrapper = inner!.parentElement as HTMLElement;
    expect(wrapper.querySelectorAll("svg").length).toBe(1);

    act(() => {
      root.render(<Tester withShadow={true} />);
    });

    // Shadow arriving later should create the drop-shadow SVG on demand.
    expect(wrapper.querySelectorAll("svg").length).toBe(2);
    expect(wrapper.style.isolation).toBe("isolate");
  });
});

describe("<SmoothCorners /> - shadowStrategy='box-shadow'", () => {
  it("renders a sibling div carrying the expected CSS box-shadow chain", () => {
    act(() => {
      root.render(
        <SmoothCorners
          autoEffects={false}
          corners={{ radius: 16 }}
          shadowStrategy="box-shadow"
          shadow={[
            { offsetX: 0, offsetY: 4, blur: 8, spread: 0, color: "#000000", opacity: 0.25 },
            { offsetX: 0, offsetY: 1, blur: 2, spread: -1, color: "#ff0000", opacity: 0.5 },
          ]}
        >
          x
        </SmoothCorners>,
      );
    });

    const sibling = container.querySelector(
      "[data-slot='smooth-corners-box-shadow']",
    ) as HTMLElement | null;
    expect(sibling).not.toBeNull();
    expect(sibling!.style.boxShadow).toBe(
      "0px 4px 8px 0px rgba(0,0,0,0.25), 0px 1px 2px -1px rgba(255,0,0,0.5)",
    );
    expect(sibling!.style.borderRadius).toBe("16px");
    expect(sibling!.style.position).toBe("absolute");
    expect(sibling!.style.pointerEvents).toBe("none");
    expect(sibling!.style.zIndex).toBe("-1");
  });

  it("emits non-hex shadow colors verbatim so the declaration stays valid", () => {
    act(() => {
      root.render(
        <SmoothCorners
          autoEffects={false}
          corners={{ radius: 16 }}
          shadowStrategy="box-shadow"
          shadow={[
            // Non-hex color with API opacity < 1 — alpha applied via color-mix.
            { offsetX: 0, offsetY: 4, blur: 8, spread: 0, color: "oklch(0.6 0.15 250 / 0.3)", opacity: 0.3 },
            // Non-hex color at opacity 1 (extraction case) — passes through as-is.
            { offsetX: 2, offsetY: 2, blur: 4, spread: 0, color: "lab(50% 40 59)", opacity: 1 },
            // Sibling hex layer must still render as rgba and survive.
            { offsetX: 0, offsetY: 1, blur: 2, spread: -1, color: "#ff0000", opacity: 0.5 },
          ]}
        >
          x
        </SmoothCorners>,
      );
    });

    const sibling = container.querySelector(
      "[data-slot='smooth-corners-box-shadow']",
    ) as HTMLElement | null;
    expect(sibling).not.toBeNull();
    const chain = sibling!.style.boxShadow;
    // The whole declaration is valid: no fabricated NaN channels.
    expect(chain).not.toContain("NaN");
    // API opacity < 1 composes onto the non-hex color via color-mix.
    expect(chain).toContain(
      "color-mix(in srgb, oklch(0.6 0.15 250 / 0.3) 30%, transparent)",
    );
    // opacity 1 keeps the raw string untouched.
    expect(chain).toContain("2px 2px 4px 0px lab(50% 40 59)");
    // The hex sibling layer still becomes rgba and survives.
    expect(chain).toContain("rgba(255,0,0,0.5)");
  });

  it("creates no drop-shadow SVG when shadowStrategy='box-shadow'", () => {
    act(() => {
      root.render(
        <SmoothCorners
          autoEffects={false}
          corners={{ radius: 12 }}
          shadowStrategy="box-shadow"
          shadow={{ offsetX: 0, offsetY: 4, blur: 8, spread: 0, color: "#000", opacity: 0.5 }}
        >
          x
        </SmoothCorners>,
      );
    });

    const inner = container.querySelector("[data-slot='smooth-corners']");
    const wrapper = inner!.parentElement as HTMLElement;
    // No SVG overlays should be present — neither the drop-shadow SVG
    // (which the box-shadow path bypasses) nor the effects overlay (no
    // borders / inner-shadow / autoEffects). The CSS sibling div is the
    // only descendant rendered alongside the inner element.
    expect(wrapper.querySelectorAll("svg").length).toBe(0);
    expect(
      wrapper.querySelector("[data-slot='smooth-corners-box-shadow']"),
    ).not.toBeNull();
  });

  it("skips the box-shadow sibling when no shadow chain is provided", () => {
    act(() => {
      root.render(
        <SmoothCorners
          autoEffects={false}
          corners={{ radius: 8 }}
          shadowStrategy="box-shadow"
        >
          x
        </SmoothCorners>,
      );
    });
    expect(
      container.querySelector("[data-slot='smooth-corners-box-shadow']"),
    ).toBeNull();
  });

  it("drops invisible (opacity<=0) entries from the chain", () => {
    act(() => {
      root.render(
        <SmoothCorners
          autoEffects={false}
          corners={{ radius: 8 }}
          shadowStrategy="box-shadow"
          shadow={[
            { offsetX: 0, offsetY: 4, blur: 8, spread: 0, color: "#000", opacity: 0 },
            { offsetX: 0, offsetY: 2, blur: 4, spread: 0, color: "#000", opacity: 0.3 },
          ]}
        >
          x
        </SmoothCorners>,
      );
    });
    const sibling = container.querySelector(
      "[data-slot='smooth-corners-box-shadow']",
    ) as HTMLElement;
    expect(sibling.style.boxShadow).toBe("0px 2px 4px 0px rgba(0,0,0,0.3)");
  });

  it("emits four-value border-radius for per-corner configs", () => {
    act(() => {
      root.render(
        <SmoothCorners
          autoEffects={false}
          corners={{ topLeft: 4, topRight: 8, bottomRight: 12, bottomLeft: 16 }}
          shadowStrategy="box-shadow"
          shadow={{ offsetX: 0, offsetY: 4, blur: 8, spread: 0, color: "#000", opacity: 0.5 }}
        >
          x
        </SmoothCorners>,
      );
    });
    const sibling = container.querySelector(
      "[data-slot='smooth-corners-box-shadow']",
    ) as HTMLElement;
    // happy-dom may normalise the four-value shorthand into separate
    // longhand properties; compare against the inline style attribute.
    const inline = sibling.getAttribute("style") ?? "";
    expect(inline).toContain("4px 8px 12px 16px");
  });

  it("default strategy is 'svg' — drop-shadow SVG is created, no CSS sibling", () => {
    act(() => {
      root.render(
        <SmoothCorners
          autoEffects={false}
          corners={{ radius: 8 }}
          shadow={{ offsetX: 0, offsetY: 4, blur: 8, spread: 0, color: "#000", opacity: 0.5 }}
        >
          x
        </SmoothCorners>,
      );
    });

    const inner = container.querySelector("[data-slot='smooth-corners']");
    const wrapper = inner!.parentElement as HTMLElement;
    // SVG drop-shadow present (z-index:-1 marker), no CSS sibling.
    const svgs = Array.from(wrapper.querySelectorAll("svg"));
    expect(svgs.some((s) => (s as SVGElement).style.zIndex === "-1")).toBe(true);
    expect(
      wrapper.querySelector("[data-slot='smooth-corners-box-shadow']"),
    ).toBeNull();
  });

  it("flipping strategy svg→box-shadow tears down the SVG drop-shadow handle", () => {
    function Tester({ strategy }: { strategy: "svg" | "box-shadow" }) {
      return (
        <SmoothCorners
          autoEffects={false}
          corners={{ radius: 8 }}
          shadowStrategy={strategy}
          shadow={{ offsetX: 0, offsetY: 4, blur: 8, spread: 0, color: "#000", opacity: 0.5 }}
        >
          x
        </SmoothCorners>
      );
    }

    act(() => {
      root.render(<Tester strategy="svg" />);
    });

    const inner = container.querySelector("[data-slot='smooth-corners']");
    const wrapper = inner!.parentElement as HTMLElement;
    // Drop-shadow SVG (z-index:-1) exists under "svg" strategy.
    const hasDropShadowSvg = (): boolean =>
      Array.from(wrapper.querySelectorAll("svg")).some(
        (s) => (s as SVGElement).style.zIndex === "-1",
      );
    expect(hasDropShadowSvg()).toBe(true);
    expect(wrapper.style.isolation).toBe("isolate");

    // Flip to box-shadow. The SVG drop-shadow handle must be torn down
    // (no leftover SVG, no leftover isolation:isolate on the anchor).
    act(() => {
      root.render(<Tester strategy="box-shadow" />);
    });

    expect(hasDropShadowSvg()).toBe(false);
    // The CSS sibling div should be present in its place.
    expect(
      wrapper.querySelector("[data-slot='smooth-corners-box-shadow']"),
    ).not.toBeNull();
  });

  it("flipping strategy box-shadow→svg reattaches the SVG drop-shadow handle", () => {
    function Tester({ strategy }: { strategy: "svg" | "box-shadow" }) {
      return (
        <SmoothCorners
          autoEffects={false}
          corners={{ radius: 8 }}
          shadowStrategy={strategy}
          shadow={{ offsetX: 0, offsetY: 4, blur: 8, spread: 0, color: "#000", opacity: 0.5 }}
        >
          x
        </SmoothCorners>
      );
    }

    act(() => {
      root.render(<Tester strategy="box-shadow" />);
    });

    const inner = container.querySelector("[data-slot='smooth-corners']");
    const wrapper = inner!.parentElement as HTMLElement;
    expect(
      wrapper.querySelector("[data-slot='smooth-corners-box-shadow']"),
    ).not.toBeNull();

    act(() => {
      root.render(<Tester strategy="svg" />);
    });

    const hasDropShadowSvg = Array.from(wrapper.querySelectorAll("svg")).some(
      (s) => (s as SVGElement).style.zIndex === "-1",
    );
    expect(hasDropShadowSvg).toBe(true);
    expect(
      wrapper.querySelector("[data-slot='smooth-corners-box-shadow']"),
    ).toBeNull();
  });

  it("routes auto-extracted CSS box-shadow into the sibling div", () => {
    act(() => {
      root.render(
        <SmoothCorners
          corners={{ radius: 12 }}
          shadowStrategy="box-shadow"
          style={{ boxShadow: "rgb(0, 0, 0) 0px 4px 8px 0px" }}
        >
          x
        </SmoothCorners>,
      );
    });

    // The hook strips the inline box-shadow on the consumer element so
    // clip-path doesn't crop it; the extracted chain must reappear on
    // the sibling div instead of vanishing silently.
    const inner = container.querySelector(
      "[data-slot='smooth-corners']",
    ) as HTMLElement;
    expect(inner.style.boxShadow).toBe("none");

    const sibling = container.querySelector(
      "[data-slot='smooth-corners-box-shadow']",
    ) as HTMLElement | null;
    expect(sibling).not.toBeNull();
    expect(sibling!.style.boxShadow).toBe("0px 4px 8px 0px rgba(0,0,0,1)");
  });

  it("explicit shadow prop wins over auto-extracted CSS box-shadow", () => {
    act(() => {
      root.render(
        <SmoothCorners
          corners={{ radius: 12 }}
          shadowStrategy="box-shadow"
          shadow={{ offsetX: 0, offsetY: 2, blur: 4, spread: 0, color: "#ff0000", opacity: 0.5 }}
          style={{ boxShadow: "rgb(0, 0, 0) 0px 8px 16px 0px" }}
        >
          x
        </SmoothCorners>,
      );
    });

    const sibling = container.querySelector(
      "[data-slot='smooth-corners-box-shadow']",
    ) as HTMLElement;
    expect(sibling.style.boxShadow).toBe("0px 2px 4px 0px rgba(255,0,0,0.5)");
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
