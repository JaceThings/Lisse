// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createDropShadow } from "../src/drop-shadow.js";
import { DEFAULT_SHADOW } from "../src/svg-shared.js";
import type { SmoothCornerOptions, ShadowConfig } from "../src/types.js";

let anchor: HTMLElement;
const opts: SmoothCornerOptions = { radius: 16 };

beforeEach(() => {
  vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 0);
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  anchor = document.createElement("div");
  document.body.appendChild(anchor);
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

function shadowPaths(svg: SVGElement): Element[] {
  return [...svg.querySelectorAll("path")].filter((p) => !p.closest("defs"));
}

describe("createDropShadow", () => {
  it("creates SVG child with defs; filter and path are created on first update", () => {
    const handle = createDropShadow(anchor);
    const svg = anchor.querySelector("svg")!;
    expect(svg).not.toBeNull();
    expect(svg.querySelector("defs")).not.toBeNull();

    expect(svg.querySelector("filter")).toBeNull();
    expect(svg.querySelector("path")).toBeNull();

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

  it("SVG carries width/height='100%' so it doesn't fall back to the 300x150 intrinsic default", () => {
    // Without explicit width/height attributes the SVG renders at its
    // 300×150 replaced-element default, overflowing narrow anchors
    // (e.g. ~110 px toggle pills on mobile) and forcing horizontal
    // scroll. CSS `inset: 0` is not enough to override the intrinsic
    // size on an SVG.
    createDropShadow(anchor);
    const svg = anchor.querySelector("svg")!;
    expect(svg.getAttribute("width")).toBe("100%");
    expect(svg.getAttribute("height")).toBe("100%");
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

  it("update() with blur=0 & spread > 0 — rendered as a filled spread-expanded silhouette", () => {
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
    // Filled spread-expanded squircle: the path is rendered at
    // (width + 2*spread)×(height + 2*spread) with radius + spread on each
    // corner, then translated by (offset − spread) so it sits centred
    // around the original silhouette. Strokes can't represent this
    // geometry when stroke-width exceeds the inner curvature radius
    // (they self-intersect at corners), so we always use fill.
    expect(path.getAttribute("transform")).toBe("translate(-10,-10)");
    expect(path.getAttribute("fill")).toBe("rgb(0,0,0)");
    expect(path.getAttribute("fill-opacity")).toBe("1");
    expect(path.getAttribute("stroke")).toBeNull();
    expect(path.getAttribute("filter")).toBeNull();
    expect(path.getAttribute("d")).toBeTruthy();
  });

  it("blur=0 + spread that exceeds the inner radius — four corners stay symmetric", () => {
    // A stroked ring self-intersects at corners when stroke-width exceeds
    // 2 × inner radius (radius=20, spread=40 here), which used to drop a
    // notch out of one corner. The filled spread-expanded path instead
    // generates a uniformly-enlarged squircle whose four corner arcs share
    // identical curvature.
    const handle = createDropShadow(anchor);
    const cornerOpts: SmoothCornerOptions = { radius: 20, smoothing: 0.6 };
    handle.update(
      cornerOpts,
      { offsetX: 0, offsetY: 2, blur: 0, spread: 40, color: "#000", opacity: 1 },
      100,
      100,
    );

    const path = anchor.querySelector("path")!;
    const d = path.getAttribute("d")!;

    // Pull every elliptical-arc command out of the path. A symmetric
    // squircle has four arcs, one per corner, all sharing the same
    // (rx, ry, x-axis-rot, large-arc, sweep) plus an identical arc
    // section length in both deltas (sign-flipped per direction).
    const arcs = [...d.matchAll(/a\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([01])\s+([01])\s+(-?[\d.]+)\s+(-?[\d.]+)/g)];
    expect(arcs).toHaveLength(4);

    const radii = arcs.map((m) => [+m[1], +m[2]]);
    const xAxisRot = arcs.map((m) => +m[3]);
    const largeArc = arcs.map((m) => +m[4]);
    const sweep = arcs.map((m) => +m[5]);
    const arcLen = arcs.map((m) => [Math.abs(+m[6]), Math.abs(+m[7])]);

    for (let i = 1; i < 4; i++) {
      expect(radii[i]).toEqual(radii[0]);
      expect(xAxisRot[i]).toBe(xAxisRot[0]);
      expect(largeArc[i]).toBe(largeArc[0]);
      expect(sweep[i]).toBe(sweep[0]);
      expect(arcLen[i]).toEqual(arcLen[0]);
    }

    // Path must close (any stray subpath would let stroke linecaps
    // butt-cut a corner — same failure mode as the original bug).
    expect(d.trim().endsWith("Z")).toBe(true);
  });

  it("blur × spread sweep — fill spread-expanded path renders for every legal combo", () => {
    const handle = createDropShadow(anchor);
    const cornerOpts: SmoothCornerOptions = { radius: 20, smoothing: 0.6 };
    const blurs = [0, 4, 16];
    const spreads = [0, 8, 20, 40];

    for (const blur of blurs) {
      for (const spread of spreads) {
        handle.update(
          cornerOpts,
          { offsetX: 0, offsetY: 2, blur, spread, color: "#000", opacity: 1 },
          100,
          100,
        );
        const path = anchor.querySelector("path")!;
        expect(path.getAttribute("fill")).toBe("rgb(0,0,0)");
        expect(path.getAttribute("stroke")).toBeNull();
        const d = path.getAttribute("d")!;
        expect(d).toBeTruthy();
        const arcs = [...d.matchAll(/a\s/g)];
        expect(arcs).toHaveLength(4);
      }
    }
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
    handle.update(opts, { offsetX: 0, offsetY: 0, blur: 8, spread: 0, color: "#000", opacity: 1 }, 200, 100);
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
    expect(shadowPaths(svg)).toHaveLength(2);
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
    expect(shadowPaths(svg)).toHaveLength(2);

    const oneShadow: ShadowConfig = {
      offsetX: 0, offsetY: 0, blur: 4, spread: 0, color: "#000000", opacity: 1,
    };
    handle.update(opts, oneShadow, 200, 100);

    expect(shadowPaths(svg)).toHaveLength(1);
    expect(svg.querySelectorAll("filter")).toHaveLength(1);
  });
});
