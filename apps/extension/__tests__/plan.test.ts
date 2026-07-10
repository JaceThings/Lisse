// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import {
  parseCornerRadius,
  isElliptical,
  boxShadowToFilter,
  computeElementPlan,
  pseudoEscapesBox,
  isOverridableCornerShape,
  uniformSolidBorder,
  borderStrokeLayer,
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
};

describe("isOverridableCornerShape", () => {
  it("overrides the smooth convex family", () => {
    for (const v of ["round", "squircle", "superellipse(1)", "superellipse(2)", "superellipse(4)",
      "squircle round superellipse(1.5) squircle"]) {
      expect(isOverridableCornerShape(v), v).toBe(true);
    }
  });

  it("leaves decorative and concave shapes alone", () => {
    for (const v of ["scoop", "bevel", "notch", "square", "superellipse(0.5)", "superellipse(-1)",
      "superellipse(infinity)", "superellipse(5)", "squircle scoop round round"]) {
      expect(isOverridableCornerShape(v), v).toBe(false);
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

  it("skips when spread is too large to approximate", () => {
    expect(boxShadowToFilter("rgb(0, 0, 0) 0px 0px 2px 10px")).toBe("skip");
  });

  it("skips spread-only rings (avatar borders) — no drop-shadow equivalent", () => {
    expect(boxShadowToFilter("rgba(255, 255, 255, 0.15) 0px 0px 0px 1px")).toBe("skip");
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
    const layer = borderStrokeLayer("M 0 0 Z", 100, 40, 1, "rgb(0, 0, 0)", {
      image: "url(x.png)",
      origin: "padding-box",
      clip: "border-box",
      repeat: "repeat-x",
      size: "cover",
    });
    expect(layer.backgroundImage).toBe(`url("data:image/svg+xml,${
      encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='100' height='40' viewBox='0 0 100 40' preserveAspectRatio='none'><path d='M 0 0 Z' fill='none' stroke='rgb(0, 0, 0)' stroke-width='2'/></svg>")
    }"), url(x.png)`);
    expect(layer.backgroundOrigin).toBe("border-box, padding-box");
    expect(layer.backgroundClip).toBe("border-box, border-box");
    expect(layer.backgroundRepeat).toBe("no-repeat, repeat-x");
    expect(layer.backgroundSize).toBe("100% 100%, cover");
  });

  it("is the sole layer when there is no existing background", () => {
    const layer = borderStrokeLayer("M 0 0 Z", 10, 10, 1, "rgb(0, 0, 0)", noBackground);
    expect(layer.backgroundOrigin).toBe("border-box");
    expect(layer.backgroundSize).toBe("100% 100%");
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
    if (plan.action === "apply") {
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
    if (plan.action === "apply") {
      expect(plan.border).toBeDefined();
      // stroke-width is 2× the border width; the clip removes the outer half.
      expect(plan.border!.backgroundImage).toContain("stroke-width%3D'2'");
      expect(plan.border!.backgroundImage).toContain("rgb(220%2C%2038%2C%2038)");
      expect(plan.border!.backgroundImage).toMatch(/^url\("data:image\/svg\+xml,/);
      // No existing background → our layer is the only one.
      expect(plan.border!.backgroundSize).toBe("100% 100%");
      expect(plan.border!.backgroundOrigin).toBe("border-box");
    }
  });

  it("scales stroke width to a 4px border", () => {
    const plan = computeElementPlan({ ...base, border: uniform(4) });
    if (plan.action === "apply") {
      expect(plan.border!.backgroundImage).toContain("stroke-width%3D'8'");
    }
  });

  it("layers the border over an existing background gradient", () => {
    const bg: BackgroundInput = {
      image: "linear-gradient(rgb(0, 0, 0), rgb(255, 255, 255))",
      origin: "padding-box",
      clip: "border-box",
      repeat: "repeat",
      size: "auto",
    };
    const plan = computeElementPlan({ ...base, border: uniform(2), background: bg });
    if (plan.action === "apply") {
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
    if (plan.action === "apply") {
      expect(plan.filter).toBe("drop-shadow(0px 2px 8px rgba(0, 0, 0, 0.25))");
    }
  });

  it("preserves an existing filter after the drop-shadow", () => {
    const plan = computeElementPlan({
      ...base,
      boxShadow: "rgba(0, 0, 0, 0.25) 0px 2px 8px 0px",
      existingFilter: "blur(2px)",
    });
    if (plan.action === "apply") {
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
    if (plan.action === "apply") expect(plan.clipPath).toMatch(/^path\("M /);
  });
});
