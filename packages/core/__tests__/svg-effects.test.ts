// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import { createSvgEffects } from "../src/svg-effects.js";
import type { SvgEffectsHandle } from "../src/svg-effects.js";
import type { SmoothCornerOptions, EffectsConfig } from "../src/types.js";

let anchor: HTMLElement;
const opts: SmoothCornerOptions = { radius: 16 };

beforeEach(() => {
  anchor = document.createElement("div");
  document.body.appendChild(anchor);
});

describe("createSvgEffects", () => {
  it("creates SVG child with defs containing clipPath, mask, filter", () => {
    createSvgEffects(anchor);
    const svg = anchor.querySelector("svg")!;
    expect(svg).not.toBeNull();

    const defs = svg.querySelector("defs")!;
    expect(defs.querySelector("clipPath")).not.toBeNull();
    expect(defs.querySelector("mask")).not.toBeNull();
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
    createSvgEffects(anchor);
    const anchor2 = document.createElement("div");
    document.body.appendChild(anchor2);
    createSvgEffects(anchor2);

    const clip1 = anchor.querySelector("clipPath")!;
    const clip2 = anchor2.querySelector("clipPath")!;
    expect(clip1.getAttribute("id")).not.toBe(clip2.getAttribute("id"));

    const mask1 = anchor.querySelector("mask")!;
    const mask2 = anchor2.querySelector("mask")!;
    expect(mask1.getAttribute("id")).not.toBe(mask2.getAttribute("id"));

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
    const paths = svg.querySelectorAll("path");
    const innerStroke = [...paths].find(
      (p) => p.getAttribute("clip-path") !== null && p.style.display !== "none"
    );
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
    const paths = svg.querySelectorAll("path");
    const outerStroke = [...paths].find(
      (p) => p.getAttribute("mask") !== null && p.style.display !== "none"
    );
    expect(outerStroke).not.toBeUndefined();
    expect(outerStroke!.getAttribute("stroke")).toBe("#00ff00");

    const maskRect = svg.querySelector("mask rect")!;
    expect(maskRect.getAttribute("x")).toBe("-3");
    expect(maskRect.getAttribute("y")).toBe("-3");
    expect(maskRect.getAttribute("width")).toBe("206");
    expect(maskRect.getAttribute("height")).toBe("106");
  });

  it("update() with visible inner shadow — filter attributes set correctly", () => {
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
    const filter = svg.querySelector("filter")!;
    const feFlood = filter.querySelector("feFlood")!;
    expect(feFlood.getAttribute("flood-color")).toBe("rgb(255,0,0)");
    expect(feFlood.getAttribute("flood-opacity")).toBe("0.5");

    const feBlur = filter.querySelector("feGaussianBlur")!;
    expect(feBlur.getAttribute("stdDeviation")).toBe("8");

    const feOffset = filter.querySelector("feOffset")!;
    expect(feOffset.getAttribute("dx")).toBe("2");
    expect(feOffset.getAttribute("dy")).toBe("4");

    const feMorph = filter.querySelector("feMorphology")!;
    expect(feMorph.getAttribute("operator")).toBe("dilate");
    expect(feMorph.getAttribute("radius")).toBe("3");
  });

  it("update() with negative spread uses erode operator", () => {
    const handle = createSvgEffects(anchor);
    const effects: EffectsConfig = {
      innerShadow: {
        offsetX: 0,
        offsetY: 0,
        blur: 4,
        spread: -2,
        color: "#000000",
        opacity: 0.5,
      },
    };
    handle.update(opts, effects, 200, 100);

    const svg = anchor.querySelector("svg")!;
    const feMorph = svg.querySelector("feMorphology")!;
    expect(feMorph.getAttribute("operator")).toBe("erode");
    expect(feMorph.getAttribute("radius")).toBe("2");
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
});

describe("border styles", () => {
  it("dashed inner border sets stroke-dasharray", () => {
    const handle = createSvgEffects(anchor);
    const effects: EffectsConfig = {
      innerBorder: { width: 4, color: "#ff0000", opacity: 1, style: "dashed" },
    };
    handle.update(opts, effects, 200, 100);

    const svg = anchor.querySelector("svg")!;
    const paths = svg.querySelectorAll("path");
    const innerStroke = [...paths].find(
      (p) => p.getAttribute("clip-path") !== null && p.style.display !== "none"
    );
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
    const paths = svg.querySelectorAll("path");
    const innerStroke = [...paths].find(
      (p) => p.getAttribute("clip-path") !== null && p.style.display !== "none"
    );
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
    const paths = svg.querySelectorAll("path");
    const innerStroke = [...paths].find(
      (p) => p.getAttribute("clip-path") !== null && p.style.display !== "none"
    );
    expect(innerStroke).not.toBeUndefined();
    // The parent <g> should have a mask attribute for the knockout
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
    const paths = svg.querySelectorAll("path");
    const innerStroke = [...paths].find(
      (p) => p.getAttribute("clip-path") !== null && p.style.display !== "none"
    );
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
    const paths = svg.querySelectorAll("path");
    const innerStroke = [...paths].find(
      (p) => p.getAttribute("clip-path") !== null && p.style.display !== "none"
    );
    expect(innerStroke).not.toBeUndefined();
    // Base stroke should be darkened
    expect(innerStroke!.getAttribute("stroke")).toBe("#aaaaaa");

    // Overlay should be visible with original color
    const group = innerStroke!.parentElement!;
    const overlay = group.querySelectorAll("path")[1]; // second path in group
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
    const paths = svg.querySelectorAll("path");
    const innerStroke = [...paths].find(
      (p) => p.getAttribute("clip-path") !== null && p.style.display !== "none"
    );
    expect(innerStroke).not.toBeUndefined();
    // Base stroke keeps original color
    expect(innerStroke!.getAttribute("stroke")).toBe("#ffffff");

    // Overlay should have darkened color
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
    const paths = svg.querySelectorAll("path");
    const innerStroke = [...paths].find(
      (p) => p.getAttribute("clip-path") !== null && p.style.display !== "none"
    );
    expect(innerStroke!.getAttribute("stroke-dasharray")).toBe("12 8");

    // Switch to solid
    handle.update(opts, {
      innerBorder: { width: 4, color: "#ff0000", opacity: 1 },
    }, 200, 100);

    expect(innerStroke!.getAttribute("stroke-dasharray")).toBeNull();
  });

  it("outer border with dashed style sets stroke-dasharray", () => {
    const handle = createSvgEffects(anchor);
    const effects: EffectsConfig = {
      outerBorder: { width: 3, color: "#00ff00", opacity: 0.8, style: "dashed" },
    };
    handle.update(opts, effects, 200, 100);

    const svg = anchor.querySelector("svg")!;
    const paths = svg.querySelectorAll("path");
    const outerStroke = [...paths].find(
      (p) => p.getAttribute("mask") !== null && p.style.display !== "none"
    );
    expect(outerStroke).not.toBeUndefined();
    expect(outerStroke!.getAttribute("stroke-dasharray")).toBe("9 6");
  });
});
