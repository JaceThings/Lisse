// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import {
  parseCornerRadius,
  isElliptical,
  boxShadowToFilter,
  hasInsetShadow,
  computeElementPlan,
  pseudoEscapesBox,
  isDefaultCorner,
  uniformSolidBorder,
  borderStrokeLayer,
  snapStroke,
  type PlanInput,
  type BorderInput,
  type BackgroundInput,
} from "../src/plan.js";

/** A border where every side shares the same width/style/colour. */
function uniform(width: number, style = "solid", color = "rgb(220, 38, 38)"): BorderInput {
  const side = { width, style, color };
  return { top: side, right: side, bottom: side, left: side };
}

const noBorder = uniform(0, "none");
const noBackground: BackgroundInput = {
  image: "none",
  origin: "padding-box",
  clip: "border-box",
  repeat: "repeat",
  size: "auto",
  position: "0% 0%",
};

describe("isDefaultCorner", () => {
  it("treats round (keyword or superellipse(1)) as default", () => {
    for (const v of ["round", "superellipse(1)", "round round round round"]) {
      expect(isDefaultCorner(v), v).toBe(true);
    }
  });

  it("treats every explicit shape as the site's own choice", () => {
    for (const v of ["squircle", "superellipse(2)", "scoop", "bevel", "notch", "square",
      "superellipse(0.5)", "superellipse(-1)", "squircle round round round"]) {
      expect(isDefaultCorner(v), v).toBe(false);
    }
  });
});

describe("pseudoEscapesBox", () => {
  const box = { width: 75, height: 32 };
  const o = (p: Partial<Parameters<typeof pseudoEscapesBox>[0]>) => ({
    top: NaN, right: NaN, bottom: NaN, left: NaN, width: NaN, height: NaN, ...p,
  });

  it("flags a negative inset (active-tab underline at bottom: -9px)", () => {
    expect(pseudoEscapesBox(o({ right: 0, bottom: -9, left: 0 }), box)).toBe(true);
  });

  it("flags a far-edge escape via positive top (underline at top: 38px on a 32px tab)", () => {
    expect(pseudoEscapesBox(o({ top: 38, height: 2, left: 0 }), box)).toBe(true);
  });

  it("flags a bottom-anchored pseudo whose height pushes past the top", () => {
    expect(pseudoEscapesBox(o({ bottom: 30, height: 8 }), box)).toBe(true);
  });

  it("passes when the pseudo sits inside the box", () => {
    expect(pseudoEscapesBox(o({ top: 0, bottom: 4, width: 20, height: 20, left: 2 }), box)).toBe(false);
  });
});

describe("parseCornerRadius", () => {
  it("parses a px value into equal h/v", () => {
    expect(parseCornerRadius("12px", 100, 40)).toEqual({ h: 12, v: 12 });
  });

  it("parses a percentage against each axis", () => {
    // 50% of 100 wide, 50% of 40 tall
    expect(parseCornerRadius("50%", 100, 40)).toEqual({ h: 50, v: 20 });
  });

  it("parses an elliptical two-token value", () => {
    expect(parseCornerRadius("10px 20px", 100, 100)).toEqual({ h: 10, v: 20 });
  });

  it("returns null for unparseable input", () => {
    expect(parseCornerRadius("", 100, 100)).toBeNull();
    expect(parseCornerRadius("auto", 100, 100)).toBeNull();
  });
});

describe("isElliptical", () => {
  it("is false when radii match", () => {
    expect(isElliptical({ h: 12, v: 12 })).toBe(false);
  });
  it("is true when radii differ", () => {
    expect(isElliptical({ h: 10, v: 20 })).toBe(true);
  });
});

describe("boxShadowToFilter", () => {
  it("returns null when there is no shadow", () => {
    expect(boxShadowToFilter("none")).toBeNull();
    expect(boxShadowToFilter("")).toBeNull();
  });

  it("converts an outer shadow to drop-shadow", () => {
    const out = boxShadowToFilter("rgba(0, 0, 0, 0.5) 2px 4px 6px 0px");
    expect(out).toBe("drop-shadow(2px 4px 6px rgba(0, 0, 0, 0.5))");
  });

  it("folds spread into blur", () => {
    const out = boxShadowToFilter("rgb(0, 0, 0) 0px 0px 4px 2px");
    expect(out).toBe("drop-shadow(0px 0px 6px rgba(0, 0, 0, 1))");
  });

  it("ignores inset shadows (they stay inside the clip)", () => {
    expect(boxShadowToFilter("rgba(0, 0, 0, 0.5) 0px 0px 4px 0px inset")).toBeNull();
  });

  it("detects an inset layer", () => {
    expect(hasInsetShadow("rgba(1, 4, 9, 0.24) 0px 1px 0px 0px inset")).toBe(true);
    expect(hasInsetShadow("rgba(0, 0, 0, 0.25) 0px 2px 8px 0px")).toBe(false);
    expect(hasInsetShadow("none")).toBe(false);
  });

  it("skips when spread is too large to approximate", () => {
    expect(boxShadowToFilter("rgb(0, 0, 0) 0px 0px 2px 10px")).toBe("skip");
  });

  it("skips spread-only rings (avatar borders) — no drop-shadow equivalent", () => {
    expect(boxShadowToFilter("rgba(255, 255, 255, 0.15) 0px 0px 0px 1px")).toBe("skip");
  });

  it("skips oklch spread-only rings (Cloudflare input borders)", () => {
    expect(
      boxShadowToFilter(
        "rgba(0, 0, 0, 0) 0px 0px 0px 0px, oklch(0.32 0 0) 0px 0px 0px 1px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px",
      ),
    ).toBe("skip");
  });

  it("passes wide-gamut colors through to drop-shadow raw", () => {
    const out = boxShadowToFilter("oklch(0.32 0 0 / 0.5) 0px 2px 4px 0px");
    expect(out).toBe("drop-shadow(0px 2px 4px oklch(0.32 0 0 / 0.5))");
  });
});

describe("uniformSolidBorder", () => {
  it("accepts four matching solid sides in range", () => {
    expect(uniformSolidBorder(uniform(2))).toEqual({ width: 2, color: "rgb(220, 38, 38)" });
  });

  it("rejects a non-solid style", () => {
    expect(uniformSolidBorder(uniform(2, "dotted"))).toBeNull();
  });

  it("rejects mismatched colours", () => {
    const b = uniform(2);
    b.left = { ...b.left, color: "rgb(0, 0, 0)" };
    expect(uniformSolidBorder(b)).toBeNull();
  });

  it("rejects widths outside 0.5–6px", () => {
    expect(uniformSolidBorder(uniform(0.25))).toBeNull();
    expect(uniformSolidBorder(uniform(7))).toBeNull();
  });
});

describe("borderStrokeLayer", () => {
  it("prepends its layer to existing background longhands", () => {
    const layer = borderStrokeLayer("M 0 0 Z", 100, 40, 0.5, 0.5, 1, "rgb(0, 0, 0)", {
      image: "url(x.png)",
      origin: "padding-box",
      clip: "border-box",
      repeat: "repeat-x",
      size: "cover",
      position: "right 8px center",
    });
    expect(layer.backgroundImage).toBe(`url("data:image/svg+xml,${
      encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='100' height='40' viewBox='0 0 100 40' preserveAspectRatio='none'><g transform='translate(0.5 0.5)'><path d='M 0 0 Z' fill='none' stroke='rgb(0, 0, 0)' stroke-width='1'/></g></svg>")
    }"), url(x.png)`);
    expect(layer.backgroundOrigin).toBe("border-box, padding-box");
    expect(layer.backgroundClip).toBe("border-box, border-box");
    expect(layer.backgroundRepeat).toBe("no-repeat, repeat-x");
    expect(layer.backgroundSize).toBe("100% 100%, cover");
    expect(layer.backgroundPosition).toBe("0% 0%, right 8px center");
  });

  it("is the sole layer when there is no existing background", () => {
    const layer = borderStrokeLayer("M 0 0 Z", 10, 10, 0.5, 0.5, 1, "rgb(0, 0, 0)", noBackground);
    expect(layer.backgroundOrigin).toBe("border-box");
    expect(layer.backgroundSize).toBe("100% 100%");
    expect(layer.backgroundPosition).toBe("0% 0%");
  });
});

describe("snapStroke", () => {
  it("is a no-op without page coordinates", () => {
    expect(snapStroke(100, 40, 1)).toEqual({
      left: 0, top: 0, right: 0, bottom: 0, strokeWidth: 1,
    });
  });

  it("leaves device-aligned boxes untouched", () => {
    expect(snapStroke(100, 40, 1, 20, 84, 1)).toEqual({
      left: 0, top: 0, right: 0, bottom: 0, strokeWidth: 1,
    });
  });

  it("shifts a fractional bottom edge onto the device grid (dpr 1)", () => {
    // top at 84 (aligned), height 40.5 → bottom at 124.5 → band moves up 0.5.
    expect(snapStroke(100, 40.5, 1, 20, 84, 1)).toEqual({
      left: 0, top: 0, right: 0, bottom: 0.5, strokeWidth: 1,
    });
  });

  it("shifts a fractional position onto the grid from the near edge", () => {
    // top at 84.5 → near edge snaps down (inward) by 0.5; bottom at 125 aligned.
    expect(snapStroke(100, 40.5, 1, 20, 84.5, 1)).toEqual({
      left: 0, top: 0.5, right: 0, bottom: 0, strokeWidth: 1,
    });
  });

  it("snaps at the device grid, not the CSS grid, for dpr 2", () => {
    // bottom at 124.25 → nearest half-pixel below is 124 → inset 0.25.
    expect(snapStroke(100, 40.25, 1, 20, 84, 2)).toEqual({
      left: 0, top: 0, right: 0, bottom: 0.25, strokeWidth: 1,
    });
  });

  it("rounds sub-pixel border widths up to one device pixel", () => {
    expect(snapStroke(100, 40, 0.5, 20, 84, 1).strokeWidth).toBe(1);
    expect(snapStroke(100, 40, 0.5, 20, 84, 2).strokeWidth).toBe(0.5);
  });

  it("snaps to the nearest device line, not always inward (matches native)", () => {
    // left at 20.7 → native rounds the edge inward to 21 → inset 0.3 (nearest).
    // The old inward-only rule would have snapped to 21 too here, but for an
    // edge that rounds the other way it over-inset by nearly a whole px.
    expect(snapStroke(100, 40, 1, 20.7, 84, 1).left).toBeCloseTo(0.3, 5);
  });

  it("sits on the box edge when the native edge rounds outside the box", () => {
    // left at 20.1 → native rounds to 20 (outside the box); we can't paint
    // there, so we stay on the edge (0) rather than jumping a px inward (0.9).
    expect(snapStroke(100, 40, 1, 20.1, 84, 1).left).toBe(0);
  });
});

const base: PlanInput = {
  width: 100,
  height: 40,
  radii: { tl: 12, tr: 12, br: 12, bl: 12 },
  elliptical: false,
  border: noBorder,
  hasBorderImage: false,
  background: noBackground,
  paintsNothing: false,
  hasOutline: false,
  pseudoOutside: false,
  childOutside: false,
  boxShadow: "none",
  existingFilter: "none",
  smoothing: 0.6,
};

describe("computeElementPlan", () => {
  it("skips when a pseudo-element escapes the box", () => {
    expect(computeElementPlan({ ...base, pseudoOutside: true })).toEqual({
      action: "skip",
      reason: "pseudo-outside",
    });
  });

  it("skips paint-less containers whose radius is visually inert (X poll wrappers)", () => {
    expect(computeElementPlan({ ...base, paintsNothing: true })).toEqual({
      action: "skip",
      reason: "paints-nothing",
    });
  });

  it("still clips a paint-less box when a border makes the radius visible", () => {
    const plan = computeElementPlan({ ...base, paintsNothing: true, border: uniform(1) });
    expect(plan.action).toBe("apply");
  });

  it("skips while a visible outline is present (focus rings paint outside the clip)", () => {
    expect(computeElementPlan({ ...base, hasOutline: true })).toEqual({
      action: "skip",
      reason: "outline",
    });
  });

  it("skips when a visible child escapes the box (avatar stacks)", () => {
    expect(computeElementPlan({ ...base, childOutside: true })).toEqual({
      action: "skip",
      reason: "child-outside",
    });
  });

  it("applies a clip-path for a plain rounded box", () => {
    const plan = computeElementPlan(base);
    expect(plan.action).toBe("apply");
    if (plan.action === "apply" && "clipPath" in plan) {
      expect(plan.clipPath).toMatch(/^path\("M /);
      expect(plan.filter).toBeUndefined();
    }
  });

  it("skips elliptical corners", () => {
    expect(computeElementPlan({ ...base, elliptical: true })).toEqual({
      action: "skip",
      reason: "elliptical",
    });
  });

  it("skips radii below the visibility threshold", () => {
    const plan = computeElementPlan({ ...base, radii: { tl: 2, tr: 2, br: 2, bl: 2 } });
    expect(plan).toEqual({ action: "skip", reason: "radius-too-small" });
  });

  it("skips tiny elements", () => {
    expect(computeElementPlan({ ...base, width: 6 })).toEqual({
      action: "skip",
      reason: "too-small",
    });
  });

  it("draws a uniform solid border as a stroked SVG background layer", () => {
    const plan = computeElementPlan({ ...base, border: uniform(1) });
    expect(plan.action).toBe("apply");
    if (plan.action === "apply" && "border" in plan) {
      expect(plan.border).toBeDefined();
      // Stroke sits fully inside the box, centerline inset by half its width.
      expect(plan.border!.backgroundImage).toContain("stroke-width%3D'1'");
      expect(plan.border!.backgroundImage).toContain(
        encodeURIComponent("<g transform='translate(0.5 0.5)'>"),
      );
      expect(plan.border!.backgroundImage).toContain("rgb(220%2C%2038%2C%2038)");
      expect(plan.border!.backgroundImage).toMatch(/^url\("data:image\/svg\+xml,/);
      // No existing background → our layer is the only one.
      expect(plan.border!.backgroundSize).toBe("100% 100%");
      expect(plan.border!.backgroundOrigin).toBe("border-box");
    }
  });

  it("scales stroke width to a 4px border", () => {
    const plan = computeElementPlan({ ...base, border: uniform(4) });
    if (plan.action === "apply" && "border" in plan) {
      expect(plan.border!.backgroundImage).toContain("stroke-width%3D'4'");
      expect(plan.border!.backgroundImage).toContain(
        encodeURIComponent("<g transform='translate(2 2)'>"),
      );
    }
  });

  it("insets the border band onto the device grid at fractional bottom edges", () => {
    const plan = computeElementPlan({
      ...base, height: 40.5, border: uniform(1), pageLeft: 20, pageTop: 84, dpr: 1,
    });
    if (plan.action === "apply" && "border" in plan) {
      // bottom band shifts up 0.5px: translate y stays 0.5, inner height 39.
      expect(plan.border!.backgroundImage).toContain(
        encodeURIComponent("<g transform='translate(0.5 0.5)'>"),
      );
      expect(decodeURIComponent(plan.border!.backgroundImage)).toContain("L 0 ");
      // inner path height = 40.5 - 0 - 0.5 - 1 = 39 → path bottom edge at 39.
      expect(decodeURIComponent(plan.border!.backgroundImage)).toContain(" 39.0000");
    }
  });

  it("layers the border over an existing background gradient", () => {
    const bg: BackgroundInput = {
      image: "linear-gradient(rgb(0, 0, 0), rgb(255, 255, 255))",
      origin: "padding-box",
      clip: "border-box",
      repeat: "repeat",
      size: "auto",
      position: "0% 0%",
    };
    const plan = computeElementPlan({ ...base, border: uniform(2), background: bg });
    if (plan.action === "apply" && "border" in plan) {
      // Our stroke is prepended (painted on top); the gradient survives after it.
      expect(plan.border!.backgroundImage).toMatch(/^url\("data:image\/svg\+xml,.*"\), linear-gradient\(/);
      expect(plan.border!.backgroundSize).toBe("100% 100%, auto");
      expect(plan.border!.backgroundRepeat).toBe("no-repeat, repeat");
    }
  });

  it("skips a dashed border", () => {
    expect(computeElementPlan({ ...base, border: uniform(2, "dashed") })).toEqual({
      action: "skip",
      reason: "non-uniform-border",
    });
  });

  it("skips a border with mismatched side widths", () => {
    const border = uniform(2);
    border.top = { ...border.top, width: 4 };
    expect(computeElementPlan({ ...base, border })).toEqual({
      action: "skip",
      reason: "non-uniform-border",
    });
  });

  it("skips a border wider than the supported range", () => {
    expect(computeElementPlan({ ...base, border: uniform(8) })).toEqual({
      action: "skip",
      reason: "non-uniform-border",
    });
  });

  it("skips border-image", () => {
    expect(computeElementPlan({ ...base, hasBorderImage: true })).toEqual({
      action: "skip",
      reason: "border-image",
    });
  });

  it("converts an outer box-shadow into a drop-shadow filter", () => {
    const plan = computeElementPlan({ ...base, boxShadow: "rgba(0, 0, 0, 0.25) 0px 2px 8px 0px" });
    expect(plan.action).toBe("apply");
    if (plan.action === "apply" && "filter" in plan) {
      expect(plan.filter).toBe("drop-shadow(0px 2px 8px rgba(0, 0, 0, 0.25))");
    }
  });

  it("preserves an existing filter after the drop-shadow", () => {
    const plan = computeElementPlan({
      ...base,
      boxShadow: "rgba(0, 0, 0, 0.25) 0px 2px 8px 0px",
      existingFilter: "blur(2px)",
    });
    if (plan.action === "apply" && "filter" in plan) {
      expect(plan.filter).toBe("drop-shadow(0px 2px 8px rgba(0, 0, 0, 0.25)) blur(2px)");
    }
  });

  it("skips when a shadow spread can't be approximated", () => {
    expect(computeElementPlan({ ...base, boxShadow: "rgb(0, 0, 0) 0px 0px 2px 10px" })).toEqual({
      action: "skip",
      reason: "shadow-spread",
    });
  });

  it("handles a capsule radius via core (radius >= half the short side)", () => {
    const plan = computeElementPlan({ ...base, radii: { tl: 9999, tr: 9999, br: 9999, bl: 9999 } });
    expect(plan.action).toBe("apply");
    if (plan.action === "apply" && "clipPath" in plan) expect(plan.clipPath).toMatch(/^path\("M /);
  });

  it("redraws a top inset highlight on the Lisse path", () => {
    const plan = computeElementPlan({
      ...base,
      border: uniform(1),
      boxShadow: "rgba(1, 4, 9, 0.24) 0px 1px 0px 0px inset",
    });
    expect(plan.action).toBe("apply");
    if (plan.action === "apply" && "clipPath" in plan) {
      expect(plan.clipPath).toMatch(/^path\("M /);
      expect(plan.boxShadow).toBe("none");
      expect(plan.border?.backgroundImage).toContain("clipPath");
      expect(decodeURIComponent(plan.border!.backgroundImage)).toContain("rgba(1, 4, 9, 0.24)");
    }
  });

  it("redraws an inset focus ring on the Lisse path", () => {
    const plan = computeElementPlan({
      ...base,
      border: uniform(1),
      boxShadow: "rgb(9, 105, 218) 0px 0px 0px 1px inset",
    });
    expect(plan.action).toBe("apply");
    if (plan.action === "apply" && "border" in plan) {
      expect(plan.boxShadow).toBe("none");
      expect(decodeURIComponent(plan.border!.backgroundImage)).toContain("rgba(9, 105, 218, 1)");
    }
  });

  it("skips a blurred inset", () => {
    expect(computeElementPlan({
      ...base,
      boxShadow: "rgba(0, 0, 0, 0.4) 0px 1px 4px 0px inset",
    })).toEqual({ action: "skip", reason: "inset-blur" });
  });
});
