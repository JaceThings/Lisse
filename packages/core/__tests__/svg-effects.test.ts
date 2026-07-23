// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createSvgEffects } from "../src/svg-effects.js";
import type { SvgEffectsHandle } from "../src/svg-effects.js";
import * as generatePathModule from "../src/generate-path.js";
import type { SmoothCornerOptions, EffectsConfig, LinearGradientConfig, RadialGradientConfig } from "../src/types.js";

// Wrap generatePath with a spy that still calls through. This lets the new
// path-cache regression test count unique (w, h, spread) invocations while
// leaving the output identical for all other tests.
vi.mock("../src/generate-path.js", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../src/generate-path.js")>();
  return { ...mod, generatePath: vi.fn(mod.generatePath) };
});

let anchor: HTMLElement;
const opts: SmoothCornerOptions = { radius: 16 };

function visibleInnerStroke(svg: SVGElement): SVGPathElement | undefined {
  return [...svg.querySelectorAll("path")].find(
    (p) => p.getAttribute("clip-path") !== null && p.style.display !== "none",
  );
}

function visibleOuterStroke(svg: SVGElement): SVGPathElement | undefined {
  return [...svg.querySelectorAll("path")].find(
    (p) => p.getAttribute("mask") !== null && p.style.display !== "none",
  );
}

beforeEach(() => {
  anchor = document.createElement("div");
  document.body.appendChild(anchor);
});

describe("createSvgEffects", () => {
  it("creates SVG child with defs containing clipPath, mask; filter created on demand", () => {
    const handle = createSvgEffects(anchor);
    const svg = anchor.querySelector("svg")!;
    expect(svg).not.toBeNull();

    const defs = svg.querySelector("defs")!;
    expect(defs.querySelector("clipPath")).not.toBeNull();
    expect(defs.querySelector("mask")).not.toBeNull();

    expect(defs.querySelector("filter")).toBeNull();

    handle.update(opts, {
      innerShadow: { offsetX: 0, offsetY: 0, blur: 4, spread: 0, color: "#000", opacity: 1 },
    }, 200, 100);
    expect(defs.querySelector("filter")).not.toBeNull();
  });

  it("SVG has correct positioning styles", () => {
    createSvgEffects(anchor);
    const svg = anchor.querySelector("svg")!;
    expect(svg.style.position).toBe("absolute");
    expect(svg.style.inset).toBe("0");
    expect(svg.style.pointerEvents).toBe("none");
    expect(svg.style.zIndex).toBe("1");
  });

  it("two instances produce unique IDs", () => {
    const handle1 = createSvgEffects(anchor);
    const anchor2 = document.createElement("div");
    document.body.appendChild(anchor2);
    const handle2 = createSvgEffects(anchor2);

    const clip1 = anchor.querySelector("clipPath")!;
    const clip2 = anchor2.querySelector("clipPath")!;
    expect(clip1.getAttribute("id")).not.toBe(clip2.getAttribute("id"));

    const mask1 = anchor.querySelector("mask")!;
    const mask2 = anchor2.querySelector("mask")!;
    expect(mask1.getAttribute("id")).not.toBe(mask2.getAttribute("id"));

    const effects = {
      innerShadow: { offsetX: 0, offsetY: 0, blur: 4, spread: 0, color: "#000", opacity: 1 },
    };
    handle1.update(opts, effects, 200, 100);
    handle2.update(opts, effects, 200, 100);

    const filter1 = anchor.querySelector("filter")!;
    const filter2 = anchor2.querySelector("filter")!;
    expect(filter1.getAttribute("id")).not.toBe(filter2.getAttribute("id"));
  });

  it("update() with visible inner border — stroke path displayed", () => {
    const handle = createSvgEffects(anchor);
    const effects: EffectsConfig = {
      innerBorder: { width: 2, color: "#ff0000", opacity: 1 },
    };
    handle.update(opts, effects, 200, 100);

    const svg = anchor.querySelector("svg")!;
    const innerStroke = visibleInnerStroke(svg);
    expect(innerStroke).not.toBeUndefined();
    expect(innerStroke!.getAttribute("stroke")).toBe("#ff0000");
    expect(innerStroke!.getAttribute("stroke-width")).toBe("4");
  });

  it("update() with width: 0 inner border — stroke path hidden", () => {
    const handle = createSvgEffects(anchor);
    const effects: EffectsConfig = {
      innerBorder: { width: 0, color: "#ff0000", opacity: 1 },
    };
    handle.update(opts, effects, 200, 100);

    const svg = anchor.querySelector("svg")!;
    const paths = svg.querySelectorAll("path");
    const innerStroke = [...paths].find(
      (p) => p.getAttribute("clip-path") !== null
    );
    expect(innerStroke!.style.display).toBe("none");
  });

  it("update() with visible outer border — stroke path displayed, mask rect extended", () => {
    const handle = createSvgEffects(anchor);
    const effects: EffectsConfig = {
      outerBorder: { width: 3, color: "#00ff00", opacity: 0.8 },
    };
    handle.update(opts, effects, 200, 100);

    const svg = anchor.querySelector("svg")!;
    const outerStroke = visibleOuterStroke(svg);
    expect(outerStroke).not.toBeUndefined();
    expect(outerStroke!.getAttribute("stroke")).toBe("#00ff00");

    const maskRect = svg.querySelector("mask rect")!;
    expect(maskRect.getAttribute("x")).toBe("-3");
    expect(maskRect.getAttribute("y")).toBe("-3");
    expect(maskRect.getAttribute("width")).toBe("206");
    expect(maskRect.getAttribute("height")).toBe("106");
  });

  it("update() with visible inner shadow — mask and blur set correctly", () => {
    const handle = createSvgEffects(anchor);
    const effects: EffectsConfig = {
      innerShadow: {
        offsetX: 2,
        offsetY: 4,
        blur: 8,
        spread: 3,
        color: "#ff0000",
        opacity: 0.5,
      },
    };
    handle.update(opts, effects, 200, 100);

    const svg = anchor.querySelector("svg")!;

    const feBlur = svg.querySelector("feGaussianBlur")!;
    expect(feBlur.getAttribute("stdDeviation")).toBe("8");

    const rects = svg.querySelectorAll("rect");
    const shadowRect = [...rects].find(
      (r) => r.getAttribute("mask") !== null && r.style.display !== "none"
    );
    expect(shadowRect).not.toBeUndefined();
    expect(shadowRect!.getAttribute("fill")).toBe("rgb(255,0,0)");
    expect(shadowRect!.getAttribute("fill-opacity")).toBe("0.5");

    const masks = svg.querySelectorAll("mask");
    const isMask = [...masks].find(
      (m) => m.getAttribute("id")?.includes("ishadow-mask")
    );
    expect(isMask).not.toBeUndefined();
    const cutout = isMask!.querySelector('path[fill="black"]');
    expect(cutout).not.toBeNull();
  });

  it("update() with spread adjusts cutout dimensions", () => {
    const handle = createSvgEffects(anchor);
    const effects: EffectsConfig = {
      innerShadow: {
        offsetX: 5,
        offsetY: 10,
        blur: 4,
        spread: -2,
        color: "#000000",
        opacity: 0.5,
      },
    };
    handle.update(opts, effects, 200, 100);

    const svg = anchor.querySelector("svg")!;
    const masks = svg.querySelectorAll("mask");
    const isMask = [...masks].find(
      (m) => m.getAttribute("id")?.includes("ishadow-mask")
    );
    expect(isMask).not.toBeUndefined();
    const cutout = isMask!.querySelector('path[fill="black"]');
    expect(cutout).not.toBeNull();
    expect(cutout!.getAttribute("d")).toBeTruthy();
    expect(cutout!.getAttribute("transform")).toContain("translate(");
  });

  it("update() with zero dimensions — no crash, nothing rendered", () => {
    const handle = createSvgEffects(anchor);
    const effects: EffectsConfig = {
      innerBorder: { width: 2, color: "#ff0000", opacity: 1 },
    };
    expect(() => handle.update(opts, effects, 0, 0)).not.toThrow();

    const svg = anchor.querySelector("svg")!;
    expect(svg.getAttribute("width")).toBeNull();
  });

  it("update() sets SVG width/height/viewBox", () => {
    const handle = createSvgEffects(anchor);
    handle.update(opts, {}, 300, 150);

    const svg = anchor.querySelector("svg")!;
    expect(svg.getAttribute("width")).toBe("300");
    expect(svg.getAttribute("height")).toBe("150");
    expect(svg.getAttribute("viewBox")).toBe("0 0 300 150");
  });

  it("destroy() removes SVG from DOM", () => {
    const handle = createSvgEffects(anchor);
    expect(anchor.querySelector("svg")).not.toBeNull();

    handle.destroy();
    expect(anchor.querySelector("svg")).toBeNull();
  });

  it("effects hidden by default before first update()", () => {
    createSvgEffects(anchor);
    const svg = anchor.querySelector("svg")!;
    const paths = svg.querySelectorAll("path");
    for (const path of paths) {
      // Paths in defs (clipPath/mask children) don't have display style
      if (path.parentElement?.tagName !== "defs" && !path.closest("clipPath") && !path.closest("mask")) {
        expect(path.style.display).toBe("none");
      }
    }
  });

  it("two inner shadows produce correct structure", () => {
    const handle = createSvgEffects(anchor);
    const effects: EffectsConfig = {
      innerShadow: [
        { offsetX: 2, offsetY: 4, blur: 8, spread: 0, color: "#ff0000", opacity: 0.5 },
        { offsetX: 0, offsetY: 0, blur: 4, spread: 2, color: "#0000ff", opacity: 0.8 },
      ],
    };
    handle.update(opts, effects, 200, 100);

    const svg = anchor.querySelector("svg")!;

    const masks = [...svg.querySelectorAll("mask")].filter(
      (m) => m.getAttribute("id")?.includes("ishadow-mask"),
    );
    expect(masks).toHaveLength(2);
    expect(masks[0].getAttribute("id")).not.toBe(masks[1].getAttribute("id"));

    const filters = [...svg.querySelectorAll("filter")].filter(
      (f) => f.getAttribute("id")?.includes("ishadow-blur"),
    );
    expect(filters).toHaveLength(2);

    const rects = [...svg.querySelectorAll("rect")].filter(
      (r) => r.getAttribute("mask")?.includes("ishadow-mask") && r.style.display !== "none",
    );
    expect(rects).toHaveLength(2);
    expect(rects[0].getAttribute("fill")).toBe("rgb(255,0,0)");
    expect(rects[1].getAttribute("fill")).toBe("rgb(0,0,255)");
  });

  it("reducing inner shadow count cleans up", () => {
    const handle = createSvgEffects(anchor);
    const twoShadows: EffectsConfig = {
      innerShadow: [
        { offsetX: 2, offsetY: 4, blur: 8, spread: 0, color: "#ff0000", opacity: 0.5 },
        { offsetX: 0, offsetY: 0, blur: 4, spread: 2, color: "#0000ff", opacity: 0.8 },
      ],
    };
    handle.update(opts, twoShadows, 200, 100);

    const svg = anchor.querySelector("svg")!;
    let masks = [...svg.querySelectorAll("mask")].filter(
      (m) => m.getAttribute("id")?.includes("ishadow-mask"),
    );
    expect(masks).toHaveLength(2);

    const oneShadow: EffectsConfig = {
      innerShadow: { offsetX: 2, offsetY: 4, blur: 8, spread: 0, color: "#ff0000", opacity: 0.5 },
    };
    handle.update(opts, oneShadow, 200, 100);

    masks = [...svg.querySelectorAll("mask")].filter(
      (m) => m.getAttribute("id")?.includes("ishadow-mask"),
    );
    expect(masks).toHaveLength(1);

    const filters = [...svg.querySelectorAll("filter")].filter(
      (f) => f.getAttribute("id")?.includes("ishadow-blur"),
    );
    expect(filters).toHaveLength(1);
  });
});

describe("border styles", () => {
  it("dashed inner border sets stroke-dasharray", () => {
    const handle = createSvgEffects(anchor);
    const effects: EffectsConfig = {
      innerBorder: { width: 4, color: "#ff0000", opacity: 1, style: "dashed" },
    };
    handle.update(opts, effects, 200, 100);

    const svg = anchor.querySelector("svg")!;
    const innerStroke = visibleInnerStroke(svg);
    expect(innerStroke).not.toBeUndefined();
    expect(innerStroke!.getAttribute("stroke-dasharray")).toBe("12 8");
  });

  it("dotted inner border sets stroke-linecap round and dasharray", () => {
    const handle = createSvgEffects(anchor);
    const effects: EffectsConfig = {
      innerBorder: { width: 4, color: "#ff0000", opacity: 1, style: "dotted" },
    };
    handle.update(opts, effects, 200, 100);

    const svg = anchor.querySelector("svg")!;
    const innerStroke = visibleInnerStroke(svg);
    expect(innerStroke).not.toBeUndefined();
    expect(innerStroke!.getAttribute("stroke-dasharray")).toBe("0 8");
    expect(innerStroke!.getAttribute("stroke-linecap")).toBe("round");
  });

  it("double inner border (width=6) applies knockout mask to stroke group", () => {
    const handle = createSvgEffects(anchor);
    const effects: EffectsConfig = {
      innerBorder: { width: 6, color: "#0000ff", opacity: 1, style: "double" },
    };
    handle.update(opts, effects, 200, 100);

    const svg = anchor.querySelector("svg")!;
    const innerStroke = visibleInnerStroke(svg);
    expect(innerStroke).not.toBeUndefined();
    const group = innerStroke!.parentElement!;
    expect(group.tagName.toLowerCase()).toBe("g");
    expect(group.getAttribute("mask")).toMatch(/url\(#sc-dbl-inner-/);
  });

  it("double inner border (width=2) does NOT apply knockout mask (falls back to solid)", () => {
    const handle = createSvgEffects(anchor);
    const effects: EffectsConfig = {
      innerBorder: { width: 2, color: "#0000ff", opacity: 1, style: "double" },
    };
    handle.update(opts, effects, 200, 100);

    const svg = anchor.querySelector("svg")!;
    const innerStroke = visibleInnerStroke(svg);
    expect(innerStroke).not.toBeUndefined();
    const group = innerStroke!.parentElement!;
    expect(group.getAttribute("mask")).toBeNull();
  });

  it("groove inner border shows overlay with original color and darkens base", () => {
    const handle = createSvgEffects(anchor);
    const effects: EffectsConfig = {
      innerBorder: { width: 4, color: "#ffffff", opacity: 1, style: "groove" },
    };
    handle.update(opts, effects, 200, 100);

    const svg = anchor.querySelector("svg")!;
    const innerStroke = visibleInnerStroke(svg);
    expect(innerStroke).not.toBeUndefined();
    expect(innerStroke!.getAttribute("stroke")).toBe("#aaaaaa");

    const group = innerStroke!.parentElement!;
    const overlay = group.querySelectorAll("path")[1];
    expect(overlay).not.toBeUndefined();
    expect(overlay.style.display).not.toBe("none");
    expect(overlay.getAttribute("stroke")).toBe("#ffffff");
  });

  it("ridge inner border has overlay with darkened color and base with original", () => {
    const handle = createSvgEffects(anchor);
    const effects: EffectsConfig = {
      innerBorder: { width: 4, color: "#ffffff", opacity: 1, style: "ridge" },
    };
    handle.update(opts, effects, 200, 100);

    const svg = anchor.querySelector("svg")!;
    const innerStroke = visibleInnerStroke(svg);
    expect(innerStroke).not.toBeUndefined();
    expect(innerStroke!.getAttribute("stroke")).toBe("#ffffff");

    const group = innerStroke!.parentElement!;
    const overlay = group.querySelectorAll("path")[1];
    expect(overlay).not.toBeUndefined();
    expect(overlay.style.display).not.toBe("none");
    expect(overlay.getAttribute("stroke")).toBe("#aaaaaa");
  });

  it("switching from dashed to solid removes stroke-dasharray", () => {
    const handle = createSvgEffects(anchor);
    handle.update(opts, {
      innerBorder: { width: 4, color: "#ff0000", opacity: 1, style: "dashed" },
    }, 200, 100);

    const svg = anchor.querySelector("svg")!;
    const innerStroke = visibleInnerStroke(svg);
    expect(innerStroke!.getAttribute("stroke-dasharray")).toBe("12 8");

    handle.update(opts, {
      innerBorder: { width: 4, color: "#ff0000", opacity: 1 },
    }, 200, 100);

    expect(innerStroke!.getAttribute("stroke-dasharray")).toBeNull();
  });

  it("middle border — stroke path displayed with correct color and width", () => {
    const handle = createSvgEffects(anchor);
    const effects: EffectsConfig = {
      middleBorder: { width: 2, color: "#ff00ff", opacity: 1 },
    };
    handle.update(opts, effects, 200, 100);

    const svg = anchor.querySelector("svg")!;
    const paths = svg.querySelectorAll("path");
    // Middle border has no clip-path and no mask (it's centered on the path)
    const middleStroke = [...paths].find(
      (p) =>
        p.getAttribute("clip-path") === null &&
        p.getAttribute("mask") === null &&
        p.style.display !== "none" &&
        p.getAttribute("stroke") === "#ff00ff"
    );
    expect(middleStroke).not.toBeUndefined();
    expect(middleStroke!.getAttribute("stroke-width")).toBe("2");
  });

  it("outer border with dashed style sets stroke-dasharray", () => {
    const handle = createSvgEffects(anchor);
    const effects: EffectsConfig = {
      outerBorder: { width: 3, color: "#00ff00", opacity: 0.8, style: "dashed" },
    };
    handle.update(opts, effects, 200, 100);

    const svg = anchor.querySelector("svg")!;
    const outerStroke = visibleOuterStroke(svg);
    expect(outerStroke).not.toBeUndefined();
    expect(outerStroke!.getAttribute("stroke-dasharray")).toBe("9 6");
  });
});

describe("gradient borders", () => {
  const linearGrad: LinearGradientConfig = {
    type: "linear",
    angle: 90,
    stops: [
      { offset: 0, color: "#ff0000" },
      { offset: 1, color: "#0000ff" },
    ],
  };

  const radialGrad: RadialGradientConfig = {
    type: "radial",
    cx: 0.5,
    cy: 0.5,
    r: 0.5,
    stops: [
      { offset: 0, color: "#ffffff" },
      { offset: 1, color: "#000000", opacity: 0.5 },
    ],
  };

  it("linear gradient border creates <linearGradient> in defs with correct stops", () => {
    const handle = createSvgEffects(anchor);
    handle.update(opts, {
      innerBorder: { width: 2, color: linearGrad, opacity: 1 },
    }, 200, 100);

    const svg = anchor.querySelector("svg")!;
    const defs = svg.querySelector("defs")!;
    const lg = defs.querySelector("linearGradient")!;
    expect(lg).not.toBeNull();
    expect(lg.getAttribute("x1")).not.toBeNull();
    expect(lg.getAttribute("y1")).not.toBeNull();
    expect(lg.getAttribute("x2")).not.toBeNull();
    expect(lg.getAttribute("y2")).not.toBeNull();

    const stops = lg.querySelectorAll("stop");
    expect(stops).toHaveLength(2);
    expect(stops[0].getAttribute("offset")).toBe("0");
    expect(stops[0].getAttribute("stop-color")).toBe("#ff0000");
    expect(stops[1].getAttribute("offset")).toBe("1");
    expect(stops[1].getAttribute("stop-color")).toBe("#0000ff");
  });

  it("radial gradient border creates <radialGradient> in defs", () => {
    const handle = createSvgEffects(anchor);
    handle.update(opts, {
      innerBorder: { width: 2, color: radialGrad, opacity: 1 },
    }, 200, 100);

    const svg = anchor.querySelector("svg")!;
    const defs = svg.querySelector("defs")!;
    const rg = defs.querySelector("radialGradient")!;
    expect(rg).not.toBeNull();
    expect(rg.getAttribute("cx")).toBe("0.5");
    expect(rg.getAttribute("cy")).toBe("0.5");
    expect(rg.getAttribute("r")).toBe("0.5");

    const stops = rg.querySelectorAll("stop");
    expect(stops).toHaveLength(2);
    expect(stops[1].getAttribute("stop-opacity")).toBe("0.5");
  });

  it("stroke uses url(#...) reference for gradient color", () => {
    const handle = createSvgEffects(anchor);
    handle.update(opts, {
      innerBorder: { width: 2, color: linearGrad, opacity: 1 },
    }, 200, 100);

    const svg = anchor.querySelector("svg")!;
    const innerStroke = visibleInnerStroke(svg);
    expect(innerStroke).not.toBeUndefined();
    expect(innerStroke!.getAttribute("stroke")).toMatch(/^url\(#sc-grad-inner-/);
  });

  it("gradient + dashed style works (stroke-dasharray still applies)", () => {
    const handle = createSvgEffects(anchor);
    handle.update(opts, {
      innerBorder: { width: 4, color: linearGrad, opacity: 1, style: "dashed" },
    }, 200, 100);

    const svg = anchor.querySelector("svg")!;
    const innerStroke = visibleInnerStroke(svg);
    expect(innerStroke).not.toBeUndefined();
    expect(innerStroke!.getAttribute("stroke")).toMatch(/^url\(#/);
    expect(innerStroke!.getAttribute("stroke-dasharray")).toBe("12 8");
  });

  it("gradient + groove creates two gradient defs (normal + darkened)", () => {
    const handle = createSvgEffects(anchor);
    handle.update(opts, {
      innerBorder: { width: 4, color: linearGrad, opacity: 1, style: "groove" },
    }, 200, 100);

    const svg = anchor.querySelector("svg")!;
    const defs = svg.querySelector("defs")!;
    const grads = defs.querySelectorAll("linearGradient");
    expect(grads.length).toBe(2);

    const allStops = [...grads].map(g =>
      [...g.querySelectorAll("stop")].map(s => s.getAttribute("stop-color"))
    );
    const flatColors = allStops.flat();
    expect(flatColors).toContain("#ff0000");
    expect(flatColors).toContain("#aa0000");
  });

  it("switching from gradient to solid color removes gradient def", () => {
    const handle = createSvgEffects(anchor);

    handle.update(opts, {
      innerBorder: { width: 2, color: linearGrad, opacity: 1 },
    }, 200, 100);

    const svg = anchor.querySelector("svg")!;
    const defs = svg.querySelector("defs")!;
    expect(defs.querySelector("linearGradient")).not.toBeNull();

    handle.update(opts, {
      innerBorder: { width: 2, color: "#ff0000", opacity: 1 },
    }, 200, 100);

    expect(defs.querySelector("linearGradient")).toBeNull();

    const innerStroke = visibleInnerStroke(svg);
    expect(innerStroke!.getAttribute("stroke")).toBe("#ff0000");
  });

  it("switching from solid to gradient works", () => {
    const handle = createSvgEffects(anchor);

    handle.update(opts, {
      innerBorder: { width: 2, color: "#ff0000", opacity: 1 },
    }, 200, 100);

    const svg = anchor.querySelector("svg")!;
    const defs = svg.querySelector("defs")!;
    expect(defs.querySelector("linearGradient")).toBeNull();

    handle.update(opts, {
      innerBorder: { width: 2, color: linearGrad, opacity: 1 },
    }, 200, 100);

    expect(defs.querySelector("linearGradient")).not.toBeNull();

    const innerStroke = visibleInnerStroke(svg);
    expect(innerStroke!.getAttribute("stroke")).toMatch(/^url\(#/);
  });
});

describe("generatePath memoisation across update dispatches (R7)", () => {
  it("calls generatePath once per unique (width, height, spread, options) combo within a dispatch", () => {
    const spy = vi.mocked(generatePathModule.generatePath);
    spy.mockClear();

    const handle = createSvgEffects(anchor);

    // Three inner shadows: two at spread 0 share the same (w, h, options)
    // as the main path, and one at spread 4 distinguishes a second combo.
    // Unique (w, h, spread, optionsKey) combos expected: 2 — (200,100,0,...)
    // and (192,92,4,...).
    const effects: EffectsConfig = {
      innerShadow: [
        { offsetX: 0, offsetY: 0, blur: 4, spread: 0, color: "#000", opacity: 0.5 },
        { offsetX: 0, offsetY: 0, blur: 4, spread: 0, color: "#f00", opacity: 0.5 },
        { offsetX: 0, offsetY: 0, blur: 4, spread: 4, color: "#00f", opacity: 0.5 },
      ],
    };

    handle.update(opts, effects, 200, 100);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("persists the cache across dispatches: a second identical dispatch regenerates nothing", () => {
    const spy = vi.mocked(generatePathModule.generatePath);
    spy.mockClear();

    const handle = createSvgEffects(anchor);
    const effects: EffectsConfig = {
      innerShadow: [
        { offsetX: 0, offsetY: 0, blur: 4, spread: 0, color: "#000", opacity: 0.5 },
        { offsetX: 0, offsetY: 0, blur: 4, spread: 4, color: "#00f", opacity: 0.5 },
      ],
    };

    handle.update(opts, effects, 200, 100);
    expect(spy).toHaveBeenCalledTimes(2);

    // The per-handle cache Map survives — the identical second dispatch is
    // served entirely from it, so generatePath is not called again.
    spy.mockClear();
    handle.update(opts, effects, 200, 100);
    expect(spy).toHaveBeenCalledTimes(0);
  });

  it("re-serialises options every dispatch, so an in-place mutation is picked up", () => {
    const spy = vi.mocked(generatePathModule.generatePath);
    const handle = createSvgEffects(anchor);
    // A local, mutable options object (idiomatic in Vue reactive props, which
    // mutate a retained object in place rather than allocating a new one).
    const localOpts: SmoothCornerOptions = { radius: 16 };
    const effects: EffectsConfig = {
      innerBorder: { width: 2, color: "#000", opacity: 1 },
    };

    handle.update(localOpts, effects, 200, 100);
    const svg = anchor.querySelector("svg")!;
    const firstStroke = visibleInnerStroke(svg)!.getAttribute("d");
    expect(firstStroke).toBeTruthy();

    // Mutate the SAME reference and re-dispatch. A reference-only serialization
    // guard would miss this and keep serving the radius-16 border path; always
    // re-serialising in setOptions busts the cache and regenerates the shape.
    spy.mockClear();
    (localOpts as { radius: number }).radius = 48;
    handle.update(localOpts, effects, 200, 100);

    const secondStroke = visibleInnerStroke(svg)!.getAttribute("d");
    expect(secondStroke).not.toBe(firstStroke);
    expect(spy).toHaveBeenCalled();
  });
});

