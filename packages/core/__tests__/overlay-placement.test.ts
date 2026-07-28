// @vitest-environment happy-dom
//
// Placement arithmetic against stubbed geometry — happy-dom does no layout.
// Painted pixels are covered by tests/browser-smoke/outer-border-direct.
import { describe, it, expect, beforeEach } from "vitest";
import { createSvgEffects } from "../src/svg-effects.js";
import { createDropShadow } from "../src/drop-shadow.js";
import type { SmoothCornerOptions, EffectsConfig } from "../src/types.js";

const opts: SmoothCornerOptions = { radius: 16 };
const OUTER: EffectsConfig = { outerBorder: { width: 3, color: "#f00", opacity: 1 } };

let anchor: HTMLElement;
let target: HTMLElement;

function stubRect(el: HTMLElement, rect: { left: number; top: number; width: number; height: number }) {
  const full = {
    ...rect,
    right: rect.left + rect.width,
    bottom: rect.top + rect.height,
    x: rect.left,
    y: rect.top,
  } as DOMRect;
  el.getBoundingClientRect = () => full;
}

/** getLayoutSize reads computed px, so the anchor needs a resolvable size. */
function sizeAnchor(el: HTMLElement, width: number, height: number) {
  el.style.boxSizing = "border-box";
  el.style.width = `${width}px`;
  el.style.height = `${height}px`;
}

beforeEach(() => {
  anchor = document.createElement("div");
  target = document.createElement("button");
  anchor.appendChild(target);
  document.body.appendChild(anchor);
  sizeAnchor(anchor, 400, 200);
});

describe("overlay placement", () => {
  it("sizes the overlay to the target, not the anchor", () => {
    stubRect(anchor, { left: 0, top: 0, width: 400, height: 200 });
    stubRect(target, { left: 0, top: 0, width: 72, height: 72 });

    const handle = createSvgEffects(anchor, target);
    handle.update(opts, OUTER, 72, 72);

    const svg = anchor.querySelector("svg")!;
    expect(svg.getAttribute("width")).toBe("72");
    expect(svg.getAttribute("height")).toBe("72");
    expect(svg.getAttribute("viewBox")).toBe("0 0 72 72");
  });

  it("offsets the overlay to the target's position inside the anchor", () => {
    // Target sits in the second column / second row of its parent.
    stubRect(anchor, { left: 10, top: 20, width: 400, height: 200 });
    stubRect(target, { left: 108, top: 118, width: 72, height: 72 });

    const handle = createSvgEffects(anchor, target);
    handle.update(opts, OUTER, 72, 72);

    const svg = anchor.querySelector("svg")!;
    expect(svg.style.left).toBe("98px");
    expect(svg.style.top).toBe("98px");
  });

  it("measures from the anchor's padding edge, not its border edge", () => {
    anchor.style.borderLeft = "7px solid #000";
    anchor.style.borderTop = "11px solid #000";
    stubRect(anchor, { left: 0, top: 0, width: 400, height: 200 });
    stubRect(target, { left: 47, top: 51, width: 72, height: 72 });

    const handle = createSvgEffects(anchor, target);
    handle.update(opts, OUTER, 72, 72);

    const svg = anchor.querySelector("svg")!;
    expect(svg.style.left).toBe("40px");
    expect(svg.style.top).toBe("40px");
  });

  it("adds the anchor's scroll offset back", () => {
    stubRect(anchor, { left: 0, top: 0, width: 400, height: 200 });
    stubRect(target, { left: 30, top: 10, width: 72, height: 72 });
    Object.defineProperty(anchor, "scrollLeft", { value: 15, configurable: true });
    Object.defineProperty(anchor, "scrollTop", { value: 40, configurable: true });

    const handle = createSvgEffects(anchor, target);
    handle.update(opts, OUTER, 72, 72);

    const svg = anchor.querySelector("svg")!;
    expect(svg.style.left).toBe("45px");
    expect(svg.style.top).toBe("50px");
  });

  it("un-scales the rect delta under an ancestor transform", () => {
    // Rendered 800x400 vs getLayoutSize's untransformed 400x200 => scale(2).
    stubRect(anchor, { left: 0, top: 0, width: 800, height: 400 });
    stubRect(target, { left: 200, top: 100, width: 144, height: 144 });

    const handle = createSvgEffects(anchor, target);
    handle.update(opts, OUTER, 72, 72);

    const svg = anchor.querySelector("svg")!;
    expect(svg.style.left).toBe("100px");
    expect(svg.style.top).toBe("50px");
  });

  it("places at the origin when the anchor is the target (dedicated wrapper)", () => {
    stubRect(anchor, { left: 33, top: 44, width: 72, height: 72 });

    const handle = createSvgEffects(anchor);
    handle.update(opts, OUTER, 72, 72);

    const svg = anchor.querySelector("svg")!;
    expect(svg.style.left).toBe("0px");
    expect(svg.style.top).toBe("0px");
  });

  it("positions the drop-shadow overlay the same way", () => {
    stubRect(anchor, { left: 0, top: 0, width: 400, height: 200 });
    stubRect(target, { left: 98, top: 98, width: 72, height: 72 });

    const handle = createDropShadow(anchor, target);
    handle.update(opts, { offsetX: 0, offsetY: 0, blur: 4, spread: 0, color: "#000", opacity: 1 }, 72, 72);

    const svg = anchor.querySelector("svg")!;
    expect(svg.style.left).toBe("98px");
    expect(svg.style.top).toBe("98px");
    expect(svg.getAttribute("width")).toBe("72");
  });

  it("two targets sharing one anchor get their own positions", () => {
    const second = document.createElement("button");
    anchor.appendChild(second);
    stubRect(anchor, { left: 0, top: 0, width: 400, height: 200 });
    stubRect(target, { left: 0, top: 0, width: 72, height: 72 });
    stubRect(second, { left: 98, top: 0, width: 72, height: 72 });

    createSvgEffects(anchor, target).update(opts, OUTER, 72, 72);
    createSvgEffects(anchor, second).update(opts, OUTER, 72, 72);

    const [svgA, svgB] = [...anchor.querySelectorAll("svg")];
    expect(svgA.style.left).toBe("0px");
    expect(svgB.style.left).toBe("98px");
  });
});
