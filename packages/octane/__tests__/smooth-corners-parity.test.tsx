/** @jsx createElement */
/** @jsxFrag Fragment */
// @vitest-environment happy-dom
import { act, createElement, createRoot, Fragment, type Root } from "octane";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Slot, SmoothCorners, useSmoothCorners, type RefObject } from "../src/index.js";
import { installNoopResizeObserver, stubLayout } from "./helpers.js";

const HOOK_SLOT = Symbol.for("@lisse/octane:test:smooth-corners:hook");

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

describe("<SmoothCorners /> - parity basics", () => {
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

  it("applies data-slot on the inner element", () => {
    act(() => {
      root.render(
        <SmoothCorners autoEffects={false} corners={{ radius: 8 }}>
          x
        </SmoothCorners>,
      );
    });
    expect(container.querySelector("[data-slot='smooth-corners']")).not.toBeNull();
  });

  it("starts with data-state=pending", () => {
    act(() => {
      root.render(
        <SmoothCorners autoEffects={false} corners={{ radius: 8 }}>
          x
        </SmoothCorners>,
      );
    });
    expect(container.querySelector("[data-slot='smooth-corners']")?.getAttribute("data-state")).toBe(
      "pending",
    );
  });
});

describe("useSmoothCorners - cleanup parity", () => {
  it("restores the prior inline clip-path and removes data attributes on unmount", () => {
    const el = document.createElement("div");
    el.style.clipPath = "circle(10px)";
    document.body.appendChild(el);

    const ref = { current: el } as RefObject<HTMLElement | null>;
    const localContainer = document.createElement("div");
    document.body.appendChild(localContainer);
    const localRoot = createRoot(localContainer);

    function Tester(): null {
      useSmoothCorners(ref, { radius: 8 }, { autoEffects: false }, HOOK_SLOT);
      return null;
    }

    act(() => localRoot.render(<Tester />));
    expect(el.getAttribute("data-slot")).toBe("smooth-corners");

    act(() => localRoot.unmount());
    expect(el.style.clipPath).toBe("circle(10px)");
    expect(el.getAttribute("data-slot")).toBeNull();
    expect(el.getAttribute("data-state")).toBeNull();

    localContainer.remove();
    el.remove();
  });

  it("cleans up without throwing when the element is detached between mount and unmount", () => {
    const parent = document.createElement("div");
    parent.style.position = "relative";
    document.body.appendChild(parent);

    const el = document.createElement("div");
    parent.appendChild(el);

    const ref = { current: el } as RefObject<HTMLElement | null>;
    const localContainer = document.createElement("div");
    document.body.appendChild(localContainer);
    const localRoot = createRoot(localContainer);

    function Tester(): null {
      useSmoothCorners(
        ref,
        { radius: 8 },
        {
          autoEffects: false,
          effects: { innerBorder: { width: 2, color: "#000", opacity: 1 } },
        },
        HOOK_SLOT,
      );
      return null;
    }

    act(() => localRoot.render(<Tester />));
    parent.removeChild(el);

    expect(() => act(() => localRoot.unmount())).not.toThrow();
    localContainer.remove();
    parent.remove();
  });

  it("strips CSS effects on extraction and restores them when autoEffects flips off", () => {
    const el = document.createElement("div");
    el.style.border = "2px solid rgb(255, 0, 0)";
    document.body.appendChild(el);

    const ref = { current: el } as RefObject<HTMLElement | null>;
    const localContainer = document.createElement("div");
    document.body.appendChild(localContainer);
    const localRoot = createRoot(localContainer);

    function Tester(props: { autoEffects: boolean }): null {
      useSmoothCorners(ref, { radius: 8 }, { autoEffects: props.autoEffects }, HOOK_SLOT);
      return null;
    }

    act(() => localRoot.render(<Tester autoEffects />));
    expect(el.style.border).toBe("0px");

    act(() => localRoot.render(<Tester autoEffects={false} />));
    expect(el.style.border).toBe("2px solid rgb(255, 0, 0)");

    act(() => localRoot.render(<Tester autoEffects />));
    expect(el.style.border).toBe("0px");

    act(() => localRoot.unmount());
    expect(el.style.border).toBe("2px solid rgb(255, 0, 0)");
    localContainer.remove();
    el.remove();
  });
});

describe("<SmoothCorners /> - asChild parity", () => {
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
        <SmoothCorners asChild corners={{ radius: 8 }} innerBorder={{ width: 2, color: "#000", opacity: 1 }}>
          <button type="button">click</button>
        </SmoothCorners>,
      );
    });
    const button = container.querySelector("button");
    expect(button).not.toBeNull();
    const wrapper = button?.parentElement;
    expect(wrapper?.tagName).toBe("DIV");
    expect(wrapper?.style.position).toBe("relative");
    expect(button?.getAttribute("data-slot")).toBe("smooth-corners");
  });
});

describe("<Slot /> - error messages are reachable", () => {
  it("throws when given zero children", async () => {
    await expect(act(() => root.render(<Slot>{null}</Slot>))).rejects.toThrow("received none");
  });

  it("throws with a count when given multiple children", async () => {
    await expect(
      act(() =>
        root.render(
          <Slot>
            <span>a</span>
            <span>b</span>
          </Slot>,
        ),
      ),
    ).rejects.toThrow("received 2");
  });

  it("throws with Fragment hint when the child is a Fragment", async () => {
    await expect(
      act(() => {
        root.render(
          <Slot>
            <Fragment>
              <span>a</span>
              <span>b</span>
            </Fragment>
          </Slot>,
        );
      }),
    ).rejects.toThrow("not a Fragment");
  });

  it("throws when the child is plain text", async () => {
    await expect(act(() => root.render(<Slot>plain text</Slot>))).rejects.toThrow("not a string");
  });
});

describe("<Slot /> - preventDefault gating", () => {
  it("skips the parent handler when the child calls event.preventDefault()", () => {
    const parent = vi.fn();
    const child = vi.fn((event: Event) => event.preventDefault());
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

describe("<Slot /> - native ref-array composition", () => {
  it("attaches the Slot ref and the child's own ref to the same element", () => {
    const outerRef = { current: null as HTMLElement | null };
    const childRef = { current: null as HTMLButtonElement | null };

    act(() => {
      root.render(
        <Slot ref={outerRef}>
          <button ref={childRef}>x</button>
        </Slot>,
      );
    });

    const button = container.querySelector("button");
    expect(button).not.toBeNull();
    expect(outerRef.current).toBe(button);
    expect(childRef.current).toBe(button);
  });
});

describe("<Slot /> - generic element behavior", () => {
  it("accepts anchor attributes", () => {
    act(() => {
      root.render(
        <Slot href="/x">
          <a>link</a>
        </Slot>,
      );
    });
    expect(container.querySelector("a")?.getAttribute("href")).toBe("/x");
  });

  it("accepts button attributes", () => {
    act(() => {
      root.render(
        <Slot type="submit">
          <button>submit</button>
        </Slot>,
      );
    });
    expect(container.querySelector("button")?.getAttribute("type")).toBe("submit");
  });
});

describe("<SmoothCorners /> - effects toggle stability", () => {
  it("does not recreate SVG handles when effects toggle on and off", () => {
    function Tester(props: { withBorder: boolean }): unknown {
      return (
        <SmoothCorners
          corners={{ radius: 8 }}
          innerBorder={props.withBorder ? { width: 2, color: "#000", opacity: 1 } : undefined}
        >
          x
        </SmoothCorners>
      );
    }

    act(() => root.render(<Tester withBorder />));
    const wrapper = container.querySelector("[data-slot='smooth-corners']")?.parentElement;
    expect(wrapper).not.toBeNull();
    const svgsAfterMount = Array.from(wrapper!.querySelectorAll("svg"));
    expect(svgsAfterMount.length).toBeGreaterThan(0);

    act(() => root.render(<Tester withBorder={false} />));
    act(() => root.render(<Tester withBorder />));
    expect(Array.from(wrapper!.querySelectorAll("svg"))).toEqual(svgsAfterMount);
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
    const svgs = wrapper!.querySelectorAll("svg");
    expect(svgs.length).toBe(1);
    expect(Array.from(svgs).find((svg) => (svg as SVGElement).style.zIndex === "-1")).toBeUndefined();
    expect(wrapper!.style.isolation).toBe("");
  });

  it("creates a drop-shadow SVG lazily when shadow is added later", () => {
    function Tester(props: { withShadow: boolean }): unknown {
      return (
        <SmoothCorners
          autoEffects={false}
          corners={{ radius: 8 }}
          innerBorder={{ width: 2, color: "#000", opacity: 1 }}
          shadow={
            props.withShadow
              ? { offsetX: 0, offsetY: 4, blur: 8, spread: 0, color: "#000", opacity: 0.5 }
              : undefined
          }
        >
          x
        </SmoothCorners>
      );
    }

    act(() => root.render(<Tester withShadow={false} />));
    const inner = container.querySelector("[data-slot='smooth-corners']")!;
    const wrapper = inner.parentElement as HTMLElement;
    expect(wrapper.querySelectorAll("svg").length).toBe(1);

    act(() => root.render(<Tester withShadow />));
    expect(wrapper.querySelectorAll("svg").length).toBe(2);
    expect(wrapper.style.isolation).toBe("isolate");
  });
});

describe("<SmoothCorners /> - shadowStrategy='box-shadow'", () => {
  it("emits non-hex shadow colors verbatim so the declaration stays valid", () => {
    act(() => {
      root.render(
        <SmoothCorners
          autoEffects={false}
          corners={{ radius: 16 }}
          shadowStrategy="box-shadow"
          shadow={[
            { offsetX: 0, offsetY: 4, blur: 8, spread: 0, color: "oklch(0.6 0.15 250 / 0.3)", opacity: 0.3 },
            { offsetX: 2, offsetY: 2, blur: 4, spread: 0, color: "lab(50% 40 59)", opacity: 1 },
            { offsetX: 0, offsetY: 1, blur: 2, spread: -1, color: "#ff0000", opacity: 0.5 },
          ]}
        >
          x
        </SmoothCorners>
      );
    });
    const sibling = container.querySelector<HTMLElement>("[data-slot='smooth-corners-box-shadow']");
    expect(sibling).not.toBeNull();
    const chain = sibling!.style.boxShadow;
    expect(chain).not.toContain("NaN");
    expect(chain).toContain("color-mix(in srgb, oklch(0.6 0.15 250 / 0.3) 30%, transparent)");
    expect(chain).toContain("2px 2px 4px 0px lab(50% 40 59)");
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
    const wrapper = container.querySelector("[data-slot='smooth-corners']")!.parentElement as HTMLElement;
    expect(wrapper.querySelectorAll("svg").length).toBe(0);
    expect(wrapper.querySelector("[data-slot='smooth-corners-box-shadow']")).not.toBeNull();
  });

  it("skips the box-shadow sibling when no shadow chain is provided", () => {
    act(() => {
      root.render(
        <SmoothCorners autoEffects={false} corners={{ radius: 8 }} shadowStrategy="box-shadow">
          x
        </SmoothCorners>,
      );
    });
    expect(container.querySelector("[data-slot='smooth-corners-box-shadow']")).toBeNull();
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
        </SmoothCorners>
      );
    });
    const sibling = container.querySelector<HTMLElement>("[data-slot='smooth-corners-box-shadow']")!;
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
    const sibling = container.querySelector<HTMLElement>("[data-slot='smooth-corners-box-shadow']")!;
    expect(sibling.getAttribute("style") ?? "").toContain("4px 8px 12px 16px");
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
    const wrapper = container.querySelector("[data-slot='smooth-corners']")!.parentElement as HTMLElement;
    expect(Array.from(wrapper.querySelectorAll("svg")).some((svg) => (svg as SVGElement).style.zIndex === "-1")).toBe(true);
    expect(wrapper.querySelector("[data-slot='smooth-corners-box-shadow']")).toBeNull();
  });

  it("flipping strategy svg→box-shadow tears down the SVG drop-shadow handle", () => {
    function Tester(props: { strategy: "svg" | "box-shadow" }): unknown {
      return (
        <SmoothCorners
          autoEffects={false}
          corners={{ radius: 8 }}
          shadowStrategy={props.strategy}
          shadow={{ offsetX: 0, offsetY: 4, blur: 8, spread: 0, color: "#000", opacity: 0.5 }}
        >
          x
        </SmoothCorners>
      );
    }

    act(() => root.render(<Tester strategy="svg" />));
    const wrapper = container.querySelector("[data-slot='smooth-corners']")!.parentElement as HTMLElement;
    const hasDropShadowSvg = (): boolean =>
      Array.from(wrapper.querySelectorAll("svg")).some((svg) => (svg as SVGElement).style.zIndex === "-1");
    expect(hasDropShadowSvg()).toBe(true);
    expect(wrapper.style.isolation).toBe("isolate");

    act(() => root.render(<Tester strategy="box-shadow" />));
    expect(hasDropShadowSvg()).toBe(false);
    expect(wrapper.querySelector("[data-slot='smooth-corners-box-shadow']")).not.toBeNull();
  });

  it("flipping strategy box-shadow→svg reattaches the SVG drop-shadow handle", () => {
    function Tester(props: { strategy: "svg" | "box-shadow" }): unknown {
      return (
        <SmoothCorners
          autoEffects={false}
          corners={{ radius: 8 }}
          shadowStrategy={props.strategy}
          shadow={{ offsetX: 0, offsetY: 4, blur: 8, spread: 0, color: "#000", opacity: 0.5 }}
        >
          x
        </SmoothCorners>
      );
    }

    act(() => root.render(<Tester strategy="box-shadow" />));
    const wrapper = container.querySelector("[data-slot='smooth-corners']")!.parentElement as HTMLElement;
    expect(wrapper.querySelector("[data-slot='smooth-corners-box-shadow']")).not.toBeNull();

    act(() => root.render(<Tester strategy="svg" />));
    expect(Array.from(wrapper.querySelectorAll("svg")).some((svg) => (svg as SVGElement).style.zIndex === "-1")).toBe(true);
    expect(wrapper.querySelector("[data-slot='smooth-corners-box-shadow']")).toBeNull();
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
    const inner = container.querySelector<HTMLElement>("[data-slot='smooth-corners']")!;
    expect(inner.style.boxShadow).toBe("none");
    const sibling = container.querySelector<HTMLElement>("[data-slot='smooth-corners-box-shadow']");
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
    const sibling = container.querySelector<HTMLElement>("[data-slot='smooth-corners-box-shadow']")!;
    expect(sibling.style.boxShadow).toBe("0px 2px 4px 0px rgba(255,0,0,0.5)");
  });
});

describe("<SmoothCorners /> - ref forwarding", () => {
  it("forwards the external ref to the inner element", () => {
    const ref = { current: null as HTMLElement | null };
    act(() => {
      root.render(
        <SmoothCorners ref={ref} autoEffects={false} corners={{ radius: 8 }} id="forwarded">
          x
        </SmoothCorners>,
      );
    });
    expect(ref.current).not.toBeNull();
    expect(ref.current?.id).toBe("forwarded");
  });
});
