// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import {
  parseColor,
  parseBorder,
  parseBoxShadow,
  extractAndStripEffects,
  restoreStyles,
} from "../src/extract-effects.js";

function freshDiv(): HTMLElement {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return el;
}

/**
 * Fastest of three runs, so one scheduler hiccup on a shared CI runner doesn't
 * decide the result.
 */
function fastest(run: () => void): number {
  let best = Infinity;
  for (let i = 0; i < 3; i++) {
    const start = performance.now();
    run();
    best = Math.min(best, performance.now() - start);
  }
  return best;
}

/**
 * Doubling the input must not more than triple the time. A wall-clock ceiling
 * measures the runner, not the parser: 50ms failed CI on a slow one while the
 * quadratic blowups these guard against cost seconds.
 */
function scalesLinearly(build: (size: number) => string, parse: (input: string) => unknown): void {
  const half = fastest(() => parse(build(1)));
  const full = fastest(() => parse(build(2)));
  if (full < 5) return;
  expect(full).toBeLessThan(half * 3);
}

describe("parseColor", () => {
  it("parses rgb() to hex + opacity 1", () => {
    const result = parseColor("rgb(255, 0, 0)");
    expect(result).toEqual({ hex: "#ff0000", opacity: 1 });
  });

  it("parses rgba() with alpha", () => {
    const result = parseColor("rgba(0, 128, 255, 0.5)");
    expect(result).toEqual({ hex: "#0080ff", opacity: 0.5 });
  });

  it("parses rgba() with alpha 0", () => {
    const result = parseColor("rgba(0, 0, 0, 0)");
    expect(result).toEqual({ hex: "#000000", opacity: 0 });
  });

  it("parses black", () => {
    const result = parseColor("rgb(0, 0, 0)");
    expect(result).toEqual({ hex: "#000000", opacity: 1 });
  });

  it("parses white", () => {
    const result = parseColor("rgb(255, 255, 255)");
    expect(result).toEqual({ hex: "#ffffff", opacity: 1 });
  });

  it("parses space-separated rgb() (CSS Color Level 4)", () => {
    const result = parseColor("rgb(255 0 0)");
    expect(result).toEqual({ hex: "#ff0000", opacity: 1 });
  });

  it("parses space-separated rgb() with slash alpha (CSS Color Level 4)", () => {
    const result = parseColor("rgb(255 0 0 / 0.5)");
    expect(result).toEqual({ hex: "#ff0000", opacity: 0.5 });
  });

  it("parses space-separated rgba() with slash alpha", () => {
    const result = parseColor("rgba(0 128 255 / 1)");
    expect(result).toEqual({ hex: "#0080ff", opacity: 1 });
  });

  it("returns undefined for invalid input", () => {
    expect(parseColor("red")).toBeUndefined();
    expect(parseColor("")).toBeUndefined();
    expect(parseColor("#ff0000")).toBeUndefined();
    expect(parseColor("hsl(0, 100%, 50%)")).toBeUndefined();
  });

  it("rejects a ReDoS attack string in linear time", () => {
    // Adjacent `\s*` quantifiers used to make this O(n^2); a long run of
    // whitespace before a missing `)` would hang the matcher.
    const attack = (size: number) => "rgb(9\t9\t9" + "\t".repeat(size * 100_000);
    expect(parseColor(attack(2))).toBeUndefined();
    scalesLinearly(attack, parseColor);
  });
});

describe("parseBorder", () => {
  let el: HTMLElement;

  beforeEach(() => {
    el = freshDiv();
  });

  it("parses a solid border", () => {
    el.style.border = "2px solid rgb(255, 0, 0)";
    const result = parseBorder(el);
    expect(result).toBeDefined();
    expect(result!.width).toBe(2);
    expect(result!.color).toBe("#ff0000");
    expect(result!.opacity).toBe(1);
  });

  it("returns undefined for border: none", () => {
    el.style.borderStyle = "none";
    expect(parseBorder(el)).toBeUndefined();
  });

  it("returns undefined for width: 0", () => {
    el.style.border = "0px solid red";
    expect(parseBorder(el)).toBeUndefined();
  });

  it("returns undefined for transparent border", () => {
    el.style.border = "2px solid rgba(0, 0, 0, 0)";
    expect(parseBorder(el)).toBeUndefined();
  });

  // jsdom drops `oklch(…)` declarations outright, so the computed style is
  // supplied directly — the same shape `getComputedStyle` returns in a browser.
  const cs = (borderTopColor: string) => ({
    borderTopStyle: "solid",
    borderTopWidth: "2px",
    borderTopColor,
  });

  it("keeps a wide-gamut border color raw instead of dropping the border", () => {
    expect(parseBorder(el, cs("oklch(0.623 0.214 259.815)"))).toEqual({
      width: 2,
      color: "oklch(0.623 0.214 259.815)",
      opacity: 1,
    });
  });

  it("leaves wide-gamut alpha embedded rather than double-applying it", () => {
    expect(parseBorder(el, cs("oklch(0.623 0.214 259.815 / 0.5)"))).toEqual({
      width: 2,
      color: "oklch(0.623 0.214 259.815 / 0.5)",
      opacity: 1,
    });
  });

  it("returns undefined for a wide-gamut border with zero alpha", () => {
    expect(parseBorder(el, cs("oklch(0.623 0.214 259.815 / 0)"))).toBeUndefined();
  });

  it("returns undefined for a border color that isn't a color", () => {
    expect(parseBorder(el, cs("currentColor"))).toBeUndefined();
    expect(parseBorder(el, cs("oklch(0.5 0.1 200) extra"))).toBeUndefined();
  });

  it("extracts dashed border style", () => {
    el.style.border = "2px dashed rgb(255, 0, 0)";
    const result = parseBorder(el);
    expect(result).toBeDefined();
    expect(result!.style).toBe("dashed");
  });

  it("extracts dotted border style", () => {
    el.style.border = "2px dotted rgb(0, 128, 0)";
    const result = parseBorder(el);
    expect(result!.style).toBe("dotted");
  });

  it("extracts double border style", () => {
    el.style.border = "3px double rgb(0, 0, 255)";
    const result = parseBorder(el);
    expect(result!.style).toBe("double");
  });

  it("extracts groove border style", () => {
    el.style.border = "4px groove rgb(128, 128, 128)";
    const result = parseBorder(el);
    expect(result!.style).toBe("groove");
  });

  it("extracts ridge border style", () => {
    el.style.border = "4px ridge rgb(128, 128, 128)";
    const result = parseBorder(el);
    expect(result!.style).toBe("ridge");
  });

  it("does not include style for solid borders", () => {
    el.style.border = "2px solid rgb(255, 0, 0)";
    const result = parseBorder(el);
    expect(result!.style).toBeUndefined();
  });

  it("treats unsupported styles (inset, outset) as solid", () => {
    el.style.border = "2px inset rgb(255, 0, 0)";
    const result = parseBorder(el);
    expect(result).toBeDefined();
    expect(result!.style).toBeUndefined();
  });
});

describe("parseBoxShadow", () => {
  it('returns empty for "none"', () => {
    const result = parseBoxShadow("none");
    expect(result).toEqual({});
  });

  it("returns empty for empty string", () => {
    const result = parseBoxShadow("");
    expect(result).toEqual({});
  });

  it("parses a single outer shadow", () => {
    const result = parseBoxShadow("rgb(0, 0, 0) 2px 4px 8px 0px");
    expect(result.shadow).toEqual([{
      offsetX: 2,
      offsetY: 4,
      blur: 8,
      spread: 0,
      color: "#000000",
      opacity: 1,
    }]);
    expect(result.innerShadow).toBeUndefined();
  });

  it("parses a single inset shadow", () => {
    const result = parseBoxShadow("rgba(0, 0, 0, 0.5) 1px 2px 3px 4px inset");
    expect(result.innerShadow).toEqual([{
      offsetX: 1,
      offsetY: 2,
      blur: 3,
      spread: 4,
      color: "#000000",
      opacity: 0.5,
    }]);
    expect(result.shadow).toBeUndefined();
  });

  it("parses outer + inset combined", () => {
    const result = parseBoxShadow(
      "rgb(255, 0, 0) 1px 2px 3px 0px, rgba(0, 0, 255, 0.8) 0px 0px 5px 2px inset",
    );
    expect(result.shadow).toBeDefined();
    expect(result.shadow![0].color).toBe("#ff0000");
    expect(result.innerShadow).toBeDefined();
    expect(result.innerShadow![0].color).toBe("#0000ff");
    expect(result.innerShadow![0].opacity).toBe(0.8);
  });

  it("keeps wide-gamut colors raw instead of dropping the layer", () => {
    const result = parseBoxShadow("oklch(0.32 0 0) 0px 0px 0px 1px");
    expect(result.shadow).toEqual([{
      offsetX: 0,
      offsetY: 0,
      blur: 0,
      spread: 1,
      color: "oklch(0.32 0 0)",
      opacity: 1,
    }]);
  });

  it("drops wide-gamut layers with zero alpha", () => {
    expect(parseBoxShadow("oklch(0.32 0 0 / 0) 0px 0px 4px 0px")).toEqual({});
  });

  it("keeps a nested colour function whole", () => {
    // Matching the inner colour instead would leave the wrapper's `60%` to be
    // read as offsetX, shifting every geometry value along by one.
    const color = "color-mix(in oklab, oklch(0.628 0.2577 29.23) 60%, transparent)";
    expect(parseBoxShadow(`${color} 2px 4px 6px 0px`)).toEqual({
      shadow: [{ offsetX: 2, offsetY: 4, blur: 6, spread: 0, color, opacity: 1 }],
      innerShadow: undefined,
    });
  });

  it("rejects a ReDoS attack string in linear time", () => {
    // Allowing `(` inside the colour-function argument run made this ~2s.
    const attack = (size: number) => "color(".repeat(size * 32_000);
    expect(parseBoxShadow(attack(2))).toEqual({});
    scalesLinearly(attack, parseBoxShadow);
  });

  it("returns all outer and all inset shadows from multiple shadows", () => {
    const result = parseBoxShadow(
      "rgb(255, 0, 0) 1px 2px 3px 0px, rgb(0, 255, 0) 4px 5px 6px 0px, rgba(0, 0, 255, 0.5) 7px 8px 9px 0px inset, rgba(128, 128, 128, 0.3) 10px 11px 12px 0px inset",
    );
    expect(result.shadow).toHaveLength(2);
    expect(result.shadow![0].offsetX).toBe(1);
    expect(result.shadow![1].offsetX).toBe(4);
    expect(result.innerShadow).toHaveLength(2);
    expect(result.innerShadow![0].offsetX).toBe(7);
    expect(result.innerShadow![1].offsetX).toBe(10);
  });

  it("parses 3 outer shadows", () => {
    const result = parseBoxShadow(
      "rgb(255, 0, 0) 1px 2px 3px 0px, rgb(0, 255, 0) 4px 5px 6px 0px, rgb(0, 0, 255) 7px 8px 9px 0px",
    );
    expect(result.shadow).toHaveLength(3);
    expect(result.shadow![0].color).toBe("#ff0000");
    expect(result.shadow![1].color).toBe("#00ff00");
    expect(result.shadow![2].color).toBe("#0000ff");
  });

  it("parses 2 inset shadows", () => {
    const result = parseBoxShadow(
      "rgba(255, 0, 0, 0.5) 1px 2px 3px 0px inset, rgba(0, 0, 255, 0.8) 4px 5px 6px 0px inset",
    );
    expect(result.innerShadow).toHaveLength(2);
    expect(result.innerShadow![0].color).toBe("#ff0000");
    expect(result.innerShadow![0].opacity).toBe(0.5);
    expect(result.innerShadow![1].color).toBe("#0000ff");
    expect(result.innerShadow![1].opacity).toBe(0.8);
  });

  it("skips shadows with zero opacity", () => {
    const result = parseBoxShadow("rgba(0, 0, 0, 0) 2px 4px 8px 0px");
    expect(result.shadow).toBeUndefined();
  });

  it("parses shadow with only offsetX and offsetY", () => {
    const result = parseBoxShadow("rgb(0, 0, 0) 5px 10px");
    expect(result.shadow).toEqual([{
      offsetX: 5,
      offsetY: 10,
      blur: 0,
      spread: 0,
      color: "#000000",
      opacity: 1,
    }]);
  });
});

describe("extractAndStripEffects", () => {
  let el: HTMLElement;

  beforeEach(() => {
    el = freshDiv();
  });

  it("extracts border and strips CSS", () => {
    el.style.border = "2px solid rgb(255, 0, 0)";
    // Use a parseable (rgb) shadow so the guarded strip clears boxShadow too.
    el.style.boxShadow = "rgb(0, 0, 0) 2px 4px 8px 0px";
    const result = extractAndStripEffects(el);

    expect(result.effects.innerBorder).toBeDefined();
    expect(result.effects.innerBorder!.width).toBe(2);
    expect(result.effects.innerBorder!.color).toBe("#ff0000");

    // CSS should be stripped (happy-dom normalizes "0" to "0px")
    expect(el.style.border).toMatch(/^0(px)?$/);
    expect(el.style.boxShadow).toBe("none");
  });

  it("saves original inline styles", () => {
    el.style.border = "3px solid blue";
    el.style.boxShadow = "1px 1px 5px black";

    const result = extractAndStripEffects(el);

    expect(result.savedStyles.border).toBe("3px solid blue");
    expect(result.savedStyles.boxShadow).toBe("1px 1px 5px black");
  });

  it("saves empty strings when no inline styles set", () => {
    const result = extractAndStripEffects(el);
    expect(result.savedStyles.border).toBe("");
    expect(result.savedStyles.boxShadow).toBe("");
  });

  it("returns empty effects for element without border/shadow", () => {
    const result = extractAndStripEffects(el);
    expect(result.effects.innerBorder).toBeUndefined();
    expect(result.effects.shadow).toBeUndefined();
    expect(result.effects.innerShadow).toBeUndefined();
  });

  it("does not strip an unparseable border (currentcolor)", () => {
    // `currentcolor` is not an rgb/rgba value, so parseBorder bails. The
    // inline border must survive -- we would otherwise wipe a visible
    // border with no SVG replacement.
    el.style.border = "2px solid currentcolor";
    const before = el.style.border;

    const result = extractAndStripEffects(el);

    expect(result.effects.innerBorder).toBeUndefined();
    expect(el.style.border).toBe(before);
  });

  it("strips a parseable border (rgb) as before", () => {
    // happy-dom returns named colours verbatim from getComputedStyle, so
    // we use rgb() to exercise the successful parse path in tests.
    el.style.border = "2px solid rgb(255, 0, 0)";

    const result = extractAndStripEffects(el);

    expect(result.effects.innerBorder).toBeDefined();
    expect(result.effects.innerBorder!.width).toBe(2);
    // happy-dom normalises "0" to "0px" on read.
    expect(el.style.border).toMatch(/^0(px)?$/);
  });

  it("does not strip box-shadow when parsing yields no shadows", () => {
    // An invalid shadow string (no rgb/rgba colour) parses to no shadows;
    // we should leave the inline box-shadow untouched.
    el.style.boxShadow = "0 0 10px #abc";
    const before = el.style.boxShadow;

    const result = extractAndStripEffects(el);

    expect(result.effects.shadow).toBeUndefined();
    expect(result.effects.innerShadow).toBeUndefined();
    expect(el.style.boxShadow).toBe(before);
  });

  it("does not compensate padding when the border could not be parsed", () => {
    el.style.boxSizing = "content-box";
    el.style.border = "2px solid currentcolor";
    el.style.padding = "5px";

    extractAndStripEffects(el);

    expect(el.style.paddingTop).toBe("5px");
    expect(el.style.paddingRight).toBe("5px");
    expect(el.style.paddingBottom).toBe("5px");
    expect(el.style.paddingLeft).toBe("5px");
  });
});

describe("restoreStyles", () => {
  let el: HTMLElement;

  beforeEach(() => {
    el = freshDiv();
  });

  it("restores original inline values", () => {
    const saved = {
      border: "2px solid red",
      boxShadow: "1px 1px 5px black",
      paddingTop: "5px",
      paddingRight: "5px",
      paddingBottom: "5px",
      paddingLeft: "5px",
    };
    el.style.border = "0";
    el.style.boxShadow = "none";

    restoreStyles(el, saved);

    expect(el.style.border).toBe("2px solid red");
    expect(el.style.boxShadow).toBe("1px 1px 5px black");
    expect(el.style.paddingTop).toBe("5px");
    expect(el.style.paddingRight).toBe("5px");
    expect(el.style.paddingBottom).toBe("5px");
    expect(el.style.paddingLeft).toBe("5px");
  });

  it("removes inline override when saved value was empty", () => {
    el.style.border = "0";
    el.style.boxShadow = "none";

    restoreStyles(el, {
      border: "",
      boxShadow: "",
      paddingTop: "",
      paddingRight: "",
      paddingBottom: "",
      paddingLeft: "",
    });

    expect(el.style.border).toBe("");
    expect(el.style.boxShadow).toBe("");
    expect(el.style.paddingTop).toBe("");
    expect(el.style.paddingRight).toBe("");
  });
});

describe("extractAndStripEffects -- content-box compensation", () => {
  let el: HTMLElement;

  beforeEach(() => {
    el = freshDiv();
  });

  it("increases padding by border width for content-box elements", () => {
    el.style.boxSizing = "content-box";
    el.style.border = "2px solid rgb(255, 0, 0)";
    el.style.padding = "0px";

    extractAndStripEffects(el);

    expect(el.style.paddingTop).toBe("2px");
    expect(el.style.paddingRight).toBe("2px");
    expect(el.style.paddingBottom).toBe("2px");
    expect(el.style.paddingLeft).toBe("2px");
  });

  it("does NOT adjust padding for border-box elements", () => {
    el.style.boxSizing = "border-box";
    el.style.border = "2px solid rgb(255, 0, 0)";
    el.style.padding = "0px";

    extractAndStripEffects(el);

    expect(el.style.paddingTop).toBe("0px");
    expect(el.style.paddingRight).toBe("0px");
    expect(el.style.paddingBottom).toBe("0px");
    expect(el.style.paddingLeft).toBe("0px");
  });

  it("adds border width to existing padding for content-box", () => {
    el.style.boxSizing = "content-box";
    el.style.border = "3px solid rgb(255, 0, 0)";
    el.style.padding = "10px";

    extractAndStripEffects(el);

    expect(el.style.paddingTop).toBe("13px");
    expect(el.style.paddingRight).toBe("13px");
    expect(el.style.paddingBottom).toBe("13px");
    expect(el.style.paddingLeft).toBe("13px");
  });

  it("restores original padding values via restoreStyles", () => {
    el.style.boxSizing = "content-box";
    el.style.border = "2px solid rgb(255, 0, 0)";
    el.style.padding = "5px";

    const result = extractAndStripEffects(el);
    expect(el.style.paddingTop).toBe("7px");

    restoreStyles(el, result.savedStyles);
    expect(el.style.paddingTop).toBe("5px");
    expect(el.style.paddingRight).toBe("5px");
    expect(el.style.paddingBottom).toBe("5px");
    expect(el.style.paddingLeft).toBe("5px");
  });

  it("does not adjust padding when there is no border", () => {
    el.style.boxSizing = "content-box";
    el.style.padding = "10px";

    extractAndStripEffects(el);

    expect(el.style.paddingTop).toBe("10px");
    expect(el.style.paddingRight).toBe("10px");
    expect(el.style.paddingBottom).toBe("10px");
    expect(el.style.paddingLeft).toBe("10px");
  });

  it("saves original padding inline styles for restoration", () => {
    el.style.boxSizing = "content-box";
    el.style.border = "2px solid rgb(255, 0, 0)";
    el.style.paddingTop = "4px";
    el.style.paddingRight = "8px";
    el.style.paddingBottom = "12px";
    el.style.paddingLeft = "16px";

    const result = extractAndStripEffects(el);

    expect(result.savedStyles.paddingTop).toBe("4px");
    expect(result.savedStyles.paddingRight).toBe("8px");
    expect(result.savedStyles.paddingBottom).toBe("12px");
    expect(result.savedStyles.paddingLeft).toBe("16px");
  });
});
