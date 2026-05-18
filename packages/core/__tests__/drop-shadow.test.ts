// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createDropShadow } from "../src/drop-shadow.js";
import { DEFAULT_SHADOW } from "../src/svg-shared.js";
import type { SmoothCornerOptions, ShadowConfig } from "../src/types.js";

let anchor: HTMLElement;
const opts: SmoothCornerOptions = { radius: 16 };

// happy-dom's default UA contains "AppleWebKit" (and lacks "Chrome"), so
// `IS_WEBKIT` evaluates to true when the module is first loaded under test.
// That means every `createDropShadow` call schedules a rAF loop. Without
// the no-op stub below, the loops accumulate across tests and bleed
// device-pixel-snap writes into later assertions. The UA-stub tests near
// the bottom of this file install their own rAF behaviour and re-import
// the module via `vi.resetModules()`, so this stub is the safe default.
beforeEach(() => {
  vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 0);
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  anchor = document.createElement("div");
  document.body.appendChild(anchor);
});

afterEach(() => {
  vi.restoreAllMocks();
  // Clear DOM between tests so previous test's anchor children don't
  // confuse document-wide queries.
  document.body.innerHTML = "";
});

describe("createDropShadow", () => {
  it("creates SVG child with defs; filter and path are created on first update", () => {
    const handle = createDropShadow(anchor);
    const svg = anchor.querySelector("svg")!;
    expect(svg).not.toBeNull();
    expect(svg.querySelector("defs")).not.toBeNull();

    // No filter/path before first update (pool is empty)
    expect(svg.querySelector("filter")).toBeNull();
    expect(svg.querySelector("path")).toBeNull();

    // After update, filter and path are created
    handle.update(opts, { offsetX: 0, offsetY: 0, blur: 4, spread: 0, color: "#000", opacity: 1 }, 200, 100);
    expect(svg.querySelector("filter")).not.toBeNull();
    expect(svg.querySelector("filter")!.querySelector("feGaussianBlur")).not.toBeNull();
    expect(svg.querySelector("path")).not.toBeNull();
  });

  it("sets isolation: isolate on anchor", () => {
    createDropShadow(anchor);
    expect(anchor.style.isolation).toBe("isolate");
  });

  it("saves and restores the prior anchor.style.isolation across create/destroy", () => {
    anchor.style.isolation = "auto";
    const handle = createDropShadow(anchor);
    expect(anchor.style.isolation).toBe("isolate");

    handle.destroy();
    expect(anchor.style.isolation).toBe("auto");
  });

  it("restores to empty string when the anchor had no prior inline isolation", () => {
    // No pre-set inline value -- destroy should leave the slot empty,
    // not leak "isolate" onto the anchor.
    expect(anchor.style.isolation).toBe("");
    const handle = createDropShadow(anchor);
    expect(anchor.style.isolation).toBe("isolate");

    handle.destroy();
    expect(anchor.style.isolation).toBe("");
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

  it("update() with blur=0 & spread > 0 — rendered as a stroked ring on the original silhouette", () => {
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
    // Ring layer: stroke on the original silhouette (no spread expansion in
    // the transform), stroke-width = spread * 2 (half outside = visible
    // ring of width `spread`, half inside hidden by content). Bypasses the
    // filter entirely.
    expect(path.getAttribute("transform")).toBe("translate(0,0)");
    expect(path.getAttribute("fill")).toBe("none");
    expect(path.getAttribute("stroke")).toBeTruthy();
    expect(path.getAttribute("stroke-width")).toBe("20");
    expect(path.getAttribute("stroke-opacity")).toBe("1");
    expect(path.getAttribute("filter")).toBeNull();
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

  it("filter element declares color-interpolation-filters=sRGB for cross-browser parity", () => {
    const handle = createDropShadow(anchor);
    handle.update(opts, { offsetX: 0, offsetY: 0, blur: 4, spread: 0, color: "#000", opacity: 1 }, 200, 100);

    const svg = anchor.querySelector("svg")!;
    const filter = svg.querySelector("filter")!;
    expect(filter.getAttribute("color-interpolation-filters")).toBe("sRGB");
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

  it("two outer shadows produce two path elements", () => {
    const handle = createDropShadow(anchor);
    const shadows: ShadowConfig[] = [
      { offsetX: 2, offsetY: 4, blur: 0, spread: 0, color: "#ff0000", opacity: 0.8 },
      { offsetX: 0, offsetY: 0, blur: 8, spread: 0, color: "#0000ff", opacity: 0.5 },
    ];
    handle.update(opts, shadows, 200, 100);

    const svg = anchor.querySelector("svg")!;
    // Paths outside <defs>
    const paths = [...svg.querySelectorAll("path")].filter(
      (p) => !p.closest("defs"),
    );
    expect(paths).toHaveLength(2);
    // Each filter should be unique
    const filters = svg.querySelectorAll("filter");
    expect(filters).toHaveLength(2);
    expect(filters[0].getAttribute("id")).not.toBe(filters[1].getAttribute("id"));
  });

  it("filter uses userSpaceOnUse units (Safari rasterisation defence)", () => {
    const handle = createDropShadow(anchor);
    handle.update(opts, { offsetX: 0, offsetY: 0, blur: 4, spread: 0, color: "#000", opacity: 1 }, 200, 100);

    const filter = anchor.querySelector("filter")!;
    expect(filter.getAttribute("filterUnits")).toBe("userSpaceOnUse");
  });

  it("filter region pad = ceil(3*blur + |spread| + 1) on every side", () => {
    const handle = createDropShadow(anchor);
    // blur=8, spread=3 => pad = ceil(24 + 3 + 1) = 28
    handle.update(
      opts,
      { offsetX: 0, offsetY: 0, blur: 8, spread: 3, color: "#000", opacity: 1 },
      200,
      100,
    );

    const filter = anchor.querySelector("filter")!;
    const pad = 28;
    const shadowWidth = 200 + 2 * 3;
    const shadowHeight = 100 + 2 * 3;
    expect(filter.getAttribute("x")).toBe(String(-pad));
    expect(filter.getAttribute("y")).toBe(String(-pad));
    expect(filter.getAttribute("width")).toBe(String(shadowWidth + 2 * pad));
    expect(filter.getAttribute("height")).toBe(String(shadowHeight + 2 * pad));
  });

  it("filter region pad handles negative spread via absolute value", () => {
    const handle = createDropShadow(anchor);
    // blur=2, spread=-4 => pad = ceil(6 + 4 + 1) = 11
    handle.update(
      opts,
      { offsetX: 0, offsetY: 0, blur: 2, spread: -4, color: "#000", opacity: 1 },
      200,
      100,
    );
    const filter = anchor.querySelector("filter")!;
    expect(filter.getAttribute("x")).toBe("-11");
    expect(filter.getAttribute("y")).toBe("-11");
  });

  it("reducing shadow count removes DOM elements", () => {
    const handle = createDropShadow(anchor);
    const twoShadows: ShadowConfig[] = [
      { offsetX: 2, offsetY: 4, blur: 0, spread: 0, color: "#ff0000", opacity: 0.8 },
      { offsetX: 0, offsetY: 0, blur: 8, spread: 0, color: "#0000ff", opacity: 0.5 },
    ];
    handle.update(opts, twoShadows, 200, 100);

    const svg = anchor.querySelector("svg")!;
    let paths = [...svg.querySelectorAll("path")].filter(
      (p) => !p.closest("defs"),
    );
    expect(paths).toHaveLength(2);

    // Reduce to one shadow
    const oneShadow: ShadowConfig = {
      offsetX: 0, offsetY: 0, blur: 4, spread: 0, color: "#000000", opacity: 1,
    };
    handle.update(opts, oneShadow, 200, 100);

    paths = [...svg.querySelectorAll("path")].filter(
      (p) => !p.closest("defs"),
    );
    expect(paths).toHaveLength(1);
    expect(svg.querySelectorAll("filter")).toHaveLength(1);
  });
});
