// @vitest-environment happy-dom
//
// Phase 4 of the curve-type rollout — effects verification. These tests
// confirm that drop shadows, inner shadows, and borders all render
// against the four curve types (arc / squircle / superellipse /
// clothoid) without any per-effect changes. They cover the integration
// risk that effects machinery might silently drop `curve` (risk #1) or
// fail to invalidate caches (risk #4). The actual cubic-arc-cubic
// content is unit-tested in curves.test.ts; here we look at the
// rendered DOM and the path strings that the effects pipeline emits.
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
    it(`renders with ${curve}: shadow path matches a regenerated path with the same curve`, () => {
      const opts: SmoothCornerOptions = { radius: 40, curve, smoothing: 0.6 };
      const shadow: ShadowConfig = {
        offsetX: 0, offsetY: 4, blur: 8, spread: 0, color: "#000", opacity: 0.5,
      };
      const handle = createDropShadow(anchor);
      handle.update(opts, shadow, 200, 200);

      const svgPath = anchor.querySelector("svg path");
      expect(svgPath).not.toBeNull();
      // The drop-shadow path is the corner path at the requested curve.
      expect(svgPath!.getAttribute("d")).toBe(generatePath(200, 200, opts));
    });

    it(`renders with ${curve} at positive spread: shadow uses adjusted curve+radius on expanded canvas`, () => {
      const opts: SmoothCornerOptions = { radius: 40, curve, smoothing: 0.6 };
      const shadow: ShadowConfig = {
        offsetX: 0, offsetY: 0, blur: 8, spread: 4, color: "#000", opacity: 0.4,
      };
      const handle = createDropShadow(anchor);
      handle.update(opts, shadow, 200, 200);
      const d = anchor.querySelector("svg path")!.getAttribute("d")!;
      // Drop shadow expands the canvas by 2*spread and grows the radius
      // by spread — risk #1 manifests here if the shadow falls back to
      // squircle because adjustOptions dropped the curve field.
      expect(d).toBe(generatePath(208, 208, { ...opts, radius: 44 }));
    });
  }
});

describe("inner shadow per curve type", () => {
  for (const curve of CURVES) {
    it(`renders with ${curve}: cutout path uses the same curve`, () => {
      const opts: SmoothCornerOptions = { radius: 40, curve, smoothing: 0.6 };
      const effects: EffectsConfig = {
        innerShadow: {
          offsetX: 0, offsetY: 2, blur: 6, spread: 0, color: "#000", opacity: 0.4,
        },
      };
      const handle = createSvgEffects(anchor);
      handle.update(opts, effects, 200, 200);
      // The inner-shadow mask cuts out the corner path. Find the
      // cutout path inside a <mask>.
      const masks = anchor.querySelectorAll("svg mask path");
      expect(masks.length).toBeGreaterThan(0);
      const expected = generatePath(200, 200, opts);
      // At least one of the mask paths should be the corner shape at
      // the chosen curve (others may be the rect-fill mask).
      const matches = Array.from(masks).some((p) => p.getAttribute("d") === expected);
      expect(matches).toBe(true);
    });
  }
});

describe("borders per curve type", () => {
  for (const curve of CURVES) {
    it(`renders an inner border with ${curve}: stroke path uses the same curve`, () => {
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

    it(`thick border (12px) does not introduce NaN/Infinity with ${curve}`, () => {
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
  it("changing the curve mid-update updates the rendered drop-shadow path", () => {
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
