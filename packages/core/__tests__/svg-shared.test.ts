import { describe, it, expect } from "vitest";
import { SVG_NS, nextUid, hexToRgb, DEFAULT_SHADOW } from "../src/svg-shared.js";

describe("SVG_NS", () => {
  it("equals the SVG namespace URI", () => {
    expect(SVG_NS).toBe("http://www.w3.org/2000/svg");
  });
});

describe("nextUid", () => {
  it("returns incrementing numbers on successive calls", () => {
    const a = nextUid();
    const b = nextUid();
    const c = nextUid();
    expect(b).toBe(a + 1);
    expect(c).toBe(b + 1);
  });
});

describe("hexToRgb", () => {
  it("converts #ff0000 to rgb(255,0,0)", () => {
    expect(hexToRgb("#ff0000")).toBe("rgb(255,0,0)");
  });

  it("converts #00ff00 to rgb(0,255,0)", () => {
    expect(hexToRgb("#00ff00")).toBe("rgb(0,255,0)");
  });

  it("converts #0000ff to rgb(0,0,255)", () => {
    expect(hexToRgb("#0000ff")).toBe("rgb(0,0,255)");
  });

  it("converts hex without # prefix", () => {
    expect(hexToRgb("ff00aa")).toBe("rgb(255,0,170)");
  });

  it("converts #000000 to rgb(0,0,0)", () => {
    expect(hexToRgb("#000000")).toBe("rgb(0,0,0)");
  });

  it("converts #ffffff to rgb(255,255,255)", () => {
    expect(hexToRgb("#ffffff")).toBe("rgb(255,255,255)");
  });
});

describe("DEFAULT_SHADOW", () => {
  it("has all zeroed fields with color #000", () => {
    expect(DEFAULT_SHADOW).toEqual({
      offsetX: 0,
      offsetY: 0,
      blur: 0,
      spread: 0,
      color: "#000",
      opacity: 0,
    });
  });
});
