// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import {
  parseColor,
  parseBorder,
  parseBoxShadow,
  extractAndStripEffects,
  restoreStyles,
} from "../src/extract-effects.js";

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

  it("returns undefined for invalid input", () => {
    expect(parseColor("red")).toBeUndefined();
    expect(parseColor("")).toBeUndefined();
    expect(parseColor("#ff0000")).toBeUndefined();
    expect(parseColor("hsl(0, 100%, 50%)")).toBeUndefined();
  });
});

describe("parseBorder", () => {
  let el: HTMLElement;

  beforeEach(() => {
    el = document.createElement("div");
    document.body.appendChild(el);
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
    expect(result.shadow).toEqual({
      offsetX: 2,
      offsetY: 4,
      blur: 8,
      spread: 0,
      color: "#000000",
      opacity: 1,
    });
    expect(result.innerShadow).toBeUndefined();
  });

  it("parses a single inset shadow", () => {
    const result = parseBoxShadow("rgba(0, 0, 0, 0.5) 1px 2px 3px 4px inset");
    expect(result.innerShadow).toEqual({
      offsetX: 1,
      offsetY: 2,
      blur: 3,
      spread: 4,
      color: "#000000",
      opacity: 0.5,
    });
    expect(result.shadow).toBeUndefined();
  });

  it("parses outer + inset combined", () => {
    const result = parseBoxShadow(
      "rgb(255, 0, 0) 1px 2px 3px 0px, rgba(0, 0, 255, 0.8) 0px 0px 5px 2px inset",
    );
    expect(result.shadow).toBeDefined();
    expect(result.shadow!.color).toBe("#ff0000");
    expect(result.innerShadow).toBeDefined();
    expect(result.innerShadow!.color).toBe("#0000ff");
    expect(result.innerShadow!.opacity).toBe(0.8);
  });

  it("takes only the first outer and first inset from multiple shadows", () => {
    const result = parseBoxShadow(
      "rgb(255, 0, 0) 1px 2px 3px 0px, rgb(0, 255, 0) 4px 5px 6px 0px, rgba(0, 0, 255, 0.5) 7px 8px 9px 0px inset, rgba(128, 128, 128, 0.3) 10px 11px 12px 0px inset",
    );
    expect(result.shadow!.offsetX).toBe(1);
    expect(result.innerShadow!.offsetX).toBe(7);
  });

  it("skips shadows with zero opacity", () => {
    const result = parseBoxShadow("rgba(0, 0, 0, 0) 2px 4px 8px 0px");
    expect(result.shadow).toBeUndefined();
  });

  it("parses shadow with only offsetX and offsetY", () => {
    const result = parseBoxShadow("rgb(0, 0, 0) 5px 10px");
    expect(result.shadow).toEqual({
      offsetX: 5,
      offsetY: 10,
      blur: 0,
      spread: 0,
      color: "#000000",
      opacity: 1,
    });
  });
});

describe("extractAndStripEffects", () => {
  let el: HTMLElement;

  beforeEach(() => {
    el = document.createElement("div");
    document.body.appendChild(el);
  });

  it("extracts border and strips CSS", () => {
    el.style.border = "2px solid rgb(255, 0, 0)";
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
});

describe("restoreStyles", () => {
  let el: HTMLElement;

  beforeEach(() => {
    el = document.createElement("div");
    document.body.appendChild(el);
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
    el = document.createElement("div");
    document.body.appendChild(el);
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
