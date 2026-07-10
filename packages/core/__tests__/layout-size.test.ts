// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from "vitest";
import { getLayoutSize } from "../src/layout-size.js";

function stub(el: HTMLElement, offsetWidth: number, offsetHeight: number): void {
  Object.defineProperty(el, "offsetWidth", { value: offsetWidth, configurable: true });
  Object.defineProperty(el, "offsetHeight", { value: offsetHeight, configurable: true });
}

afterEach(() => vi.restoreAllMocks());

describe("getLayoutSize", () => {
  it("trusts resolved px values on border-box", () => {
    const el = document.createElement("div");
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      width: "160.5px", height: "48.25px", boxSizing: "border-box",
    } as CSSStyleDeclaration);
    expect(getLayoutSize(el)).toEqual({ width: 160.5, height: 48.25 });
  });

  it("does not parse a percentage as pixels (inline elements keep computed values)", () => {
    // Reddit's community-icon wrapper: display:inline + w/h 100% resolved
    // as the literal "100%" — parseFloat would fabricate a 100px box.
    const el = document.createElement("span");
    stub(el, 32, 24);
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      width: "100%", height: "100%", boxSizing: "content-box",
    } as CSSStyleDeclaration);
    expect(getLayoutSize(el)).toEqual({ width: 32, height: 24 });
  });

  it("falls back to offsets on auto", () => {
    const el = document.createElement("div");
    stub(el, 200, 80);
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      width: "auto", height: "auto", boxSizing: "content-box",
    } as CSSStyleDeclaration);
    expect(getLayoutSize(el)).toEqual({ width: 200, height: 80 });
  });
});
