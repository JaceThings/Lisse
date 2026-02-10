// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import { createDropShadow } from "../src/drop-shadow.js";
import { DEFAULT_SHADOW } from "../src/svg-shared.js";
import type { SmoothCornerOptions, ShadowConfig } from "../src/types.js";

let anchor: HTMLElement;
const opts: SmoothCornerOptions = { radius: 16 };

beforeEach(() => {
  anchor = document.createElement("div");
  document.body.appendChild(anchor);
});

describe("createDropShadow", () => {
  it("creates SVG child with defs/filter/feGaussianBlur and a path element", () => {
    createDropShadow(anchor);
    const svg = anchor.querySelector("svg")!;
    expect(svg).not.toBeNull();

    const filter = svg.querySelector("filter")!;
    expect(filter).not.toBeNull();
    expect(filter.querySelector("feGaussianBlur")).not.toBeNull();

    const path = svg.querySelector("path");
    expect(path).not.toBeNull();
  });

  it("sets isolation: isolate on anchor", () => {
    createDropShadow(anchor);
    expect(anchor.style.isolation).toBe("isolate");
  });

  it("SVG has correct z-index:-1 positioning", () => {
    createDropShadow(anchor);
    const svg = anchor.querySelector("svg")!;
    expect(svg.style.zIndex).toBe("-1");
    expect(svg.style.position).toBe("absolute");
    expect(svg.style.pointerEvents).toBe("none");
  });

  it("update() with visible shadow — path has correct fill, fill-opacity, transform", () => {
    const handle = createDropShadow(anchor);
    const shadow: ShadowConfig = {
      offsetX: 5,
      offsetY: 10,
      blur: 0,
      spread: 0,
      color: "#ff0000",
      opacity: 0.8,
    };
    handle.update(opts, shadow, 200, 100);

    const svg = anchor.querySelector("svg")!;
    const path = svg.querySelector("path")!;
    expect(path.getAttribute("fill")).toBe("rgb(255,0,0)");
    expect(path.getAttribute("fill-opacity")).toBe("0.8");
    expect(path.getAttribute("transform")).toBe("translate(5,10)");
  });

  it("update() with opacity: 0 — SVG hidden", () => {
    const handle = createDropShadow(anchor);
    const shadow: ShadowConfig = {
      offsetX: 5,
      offsetY: 10,
      blur: 4,
      spread: 0,
      color: "#ff0000",
      opacity: 0,
    };
    handle.update(opts, shadow, 200, 100);

    const svg = anchor.querySelector("svg")!;
    expect(svg.style.display).toBe("none");
  });

  it("update() with zero dimensions — SVG hidden", () => {
    const handle = createDropShadow(anchor);
    const shadow: ShadowConfig = {
      offsetX: 0,
      offsetY: 0,
      blur: 4,
      spread: 0,
      color: "#ff0000",
      opacity: 0.5,
    };
    handle.update(opts, shadow, 0, 0);

    const svg = anchor.querySelector("svg")!;
    expect(svg.style.display).toBe("none");
  });

  it("update() with spread > 0 — path generated at expanded dimensions, transform offset includes spread", () => {
    const handle = createDropShadow(anchor);
    const shadow: ShadowConfig = {
      offsetX: 0,
      offsetY: 0,
      blur: 0,
      spread: 10,
      color: "#000000",
      opacity: 1,
    };
    handle.update(opts, shadow, 200, 100);

    const svg = anchor.querySelector("svg")!;
    const path = svg.querySelector("path")!;
    // Transform should offset by -spread
    expect(path.getAttribute("transform")).toBe("translate(-10,-10)");
    // Path d should exist (generated at expanded dimensions 220x120)
    expect(path.getAttribute("d")).toBeTruthy();
  });

  it("update() with negative spread making dimensions <= 0 — SVG hidden", () => {
    const handle = createDropShadow(anchor);
    const shadow: ShadowConfig = {
      offsetX: 0,
      offsetY: 0,
      blur: 0,
      spread: -60,
      color: "#000000",
      opacity: 1,
    };
    handle.update(opts, shadow, 100, 100);

    const svg = anchor.querySelector("svg")!;
    expect(svg.style.display).toBe("none");
  });

  it("update() with blur > 0 — filter attribute applied, stdDeviation set", () => {
    const handle = createDropShadow(anchor);
    const shadow: ShadowConfig = {
      offsetX: 0,
      offsetY: 0,
      blur: 8,
      spread: 0,
      color: "#000000",
      opacity: 0.5,
    };
    handle.update(opts, shadow, 200, 100);

    const svg = anchor.querySelector("svg")!;
    const path = svg.querySelector("path")!;
    expect(path.getAttribute("filter")).toContain("url(#");

    const feBlur = svg.querySelector("feGaussianBlur")!;
    expect(feBlur.getAttribute("stdDeviation")).toBe("8");
  });

  it("update() with blur: 0 — filter attribute removed", () => {
    const handle = createDropShadow(anchor);
    // First apply blur
    handle.update(opts, { offsetX: 0, offsetY: 0, blur: 8, spread: 0, color: "#000", opacity: 1 }, 200, 100);
    // Then remove blur
    handle.update(opts, { offsetX: 0, offsetY: 0, blur: 0, spread: 0, color: "#000", opacity: 1 }, 200, 100);

    const svg = anchor.querySelector("svg")!;
    const path = svg.querySelector("path")!;
    expect(path.getAttribute("filter")).toBeNull();
  });

  it("destroy() removes SVG from DOM", () => {
    const handle = createDropShadow(anchor);
    expect(anchor.querySelector("svg")).not.toBeNull();

    handle.destroy();
    expect(anchor.querySelector("svg")).toBeNull();
  });

  it("update() with DEFAULT_SHADOW — SVG hidden (opacity is 0)", () => {
    const handle = createDropShadow(anchor);
    handle.update(opts, DEFAULT_SHADOW, 200, 100);

    const svg = anchor.querySelector("svg")!;
    expect(svg.style.display).toBe("none");
  });
});
