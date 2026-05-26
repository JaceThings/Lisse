// @vitest-environment happy-dom
//
// Effects-pipeline coverage per curve type. Curve geometry is unit-tested
// in curves.test.ts; here we assert that drop shadows, inner shadows, and
// borders all read the requested curve through to the rendered path.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createDropShadow } from "../src/drop-shadow.js";
import { createSvgEffects } from "../src/svg-effects.js";
import { generatePath } from "../src/generate-path.js";
import type {
  SmoothCornerOptions,
  ShadowConfig,
  EffectsConfig,
  CurveType,
} from "../src/types.js";

const CURVES: CurveType[] = ["arc", "squircle", "superellipse", "clothoid"];

let anchor: HTMLElement;

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

describe("drop shadow per curve type", () => {
  for (const curve of CURVES) {
    it(`${curve}: shadow path matches a regenerated path at the same curve`, () => {
      const opts: SmoothCornerOptions = { radius: 40, curve, smoothing: 0.6 };
      const shadow: ShadowConfig = {
        offsetX: 0, offsetY: 4, blur: 8, spread: 0, color: "#000", opacity: 0.5,
      };
      const handle = createDropShadow(anchor);
      handle.update(opts, shadow, 200, 200);

      const svgPath = anchor.querySelector("svg path");
      expect(svgPath).not.toBeNull();
      expect(svgPath!.getAttribute("d")).toBe(generatePath(200, 200, opts));
    });

    it(`${curve} at positive spread: shadow uses adjusted curve+radius on expanded canvas`, () => {
      const opts: SmoothCornerOptions = { radius: 40, curve, smoothing: 0.6 };
      const shadow: ShadowConfig = {
        offsetX: 0, offsetY: 0, blur: 8, spread: 4, color: "#000", opacity: 0.4,
      };
      const handle = createDropShadow(anchor);
      handle.update(opts, shadow, 200, 200);
      const d = anchor.querySelector("svg path")!.getAttribute("d")!;
      // Risk #1: if adjustOptions drops `curve`, this falls back to
      // squircle silently. Lock the spread-expanded geometry explicitly.
      expect(d).toBe(generatePath(208, 208, { ...opts, radius: 44 }));
    });
  }
});

describe("inner shadow per curve type", () => {
  for (const curve of CURVES) {
    it(`${curve}: cutout path uses the same curve`, () => {
      const opts: SmoothCornerOptions = { radius: 40, curve, smoothing: 0.6 };
      const effects: EffectsConfig = {
        innerShadow: {
          offsetX: 0, offsetY: 2, blur: 6, spread: 0, color: "#000", opacity: 0.4,
        },
      };
      const handle = createSvgEffects(anchor);
      handle.update(opts, effects, 200, 200);
      const masks = anchor.querySelectorAll("svg mask path");
      expect(masks.length).toBeGreaterThan(0);
      const expected = generatePath(200, 200, opts);
      // One of the mask paths is the corner cutout; others are the rect fill.
      const matches = Array.from(masks).some((p) => p.getAttribute("d") === expected);
      expect(matches).toBe(true);
    });
  }
});

describe("borders per curve type", () => {
  for (const curve of CURVES) {
    it(`${curve}: inner-border stroke path uses the same curve`, () => {
      const opts: SmoothCornerOptions = { radius: 40, curve, smoothing: 0.6 };
      const effects: EffectsConfig = {
        innerBorder: { width: 4, color: "#f00", opacity: 1 },
      };
      const handle = createSvgEffects(anchor);
      handle.update(opts, effects, 200, 200);
      const strokePaths = anchor.querySelectorAll("svg path[stroke]");
      expect(strokePaths.length).toBeGreaterThan(0);
      const expected = generatePath(200, 200, opts);
      const matches = Array.from(strokePaths).some(
        (p) => p.getAttribute("d") === expected,
      );
      expect(matches).toBe(true);
    });

    it(`${curve}: 12px border stays NaN/Infinity-free`, () => {
      const opts: SmoothCornerOptions = { radius: 50, curve, smoothing: 0.6 };
      const effects: EffectsConfig = {
        innerBorder: { width: 12, color: "#000", opacity: 1 },
      };
      const handle = createSvgEffects(anchor);
      handle.update(opts, effects, 200, 200);
      for (const path of anchor.querySelectorAll("svg path")) {
        const d = path.getAttribute("d") ?? "";
        expect(d).not.toContain("NaN");
        expect(d).not.toContain("Infinity");
      }
    });
  }
});

describe("curve switch invalidates cached paths", () => {
  it("changing the curve mid-update re-renders the drop-shadow path", () => {
    const handle = createDropShadow(anchor);
    const shadow: ShadowConfig = {
      offsetX: 0, offsetY: 0, blur: 8, spread: 0, color: "#000", opacity: 0.5,
    };
    handle.update({ radius: 40, curve: "squircle" }, shadow, 200, 200);
    const before = anchor.querySelector("svg path")!.getAttribute("d");
    handle.update({ radius: 40, curve: "clothoid" }, shadow, 200, 200);
    const after = anchor.querySelector("svg path")!.getAttribute("d");
    expect(before).not.toBe(after);
  });
});
