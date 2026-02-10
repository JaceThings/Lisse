// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import { acquirePosition, releasePosition } from "../src/position-ref-count.js";

describe("acquirePosition", () => {
  let anchor: HTMLElement;

  beforeEach(() => {
    anchor = document.createElement("div");
    document.body.appendChild(anchor);
  });

  it("sets position: relative on a static element and returns true", () => {
    // happy-dom returns "" for static position; real browsers return "static"
    const pos = getComputedStyle(anchor).position;
    expect(pos === "static" || pos === "").toBe(true);
    const result = acquirePosition(anchor);
    expect(result).toBe(true);
    expect(anchor.style.position).toBe("relative");
  });

  it("does not touch an already-positioned element and returns false", () => {
    anchor.style.position = "absolute";
    const result = acquirePosition(anchor);
    expect(result).toBe(false);
    expect(anchor.style.position).toBe("absolute");
  });

  it("keeps position after first releasePosition when two acquires exist", () => {
    acquirePosition(anchor);
    acquirePosition(anchor);
    expect(anchor.style.position).toBe("relative");

    releasePosition(anchor);
    expect(anchor.style.position).toBe("relative");
  });

  it("resets position when both acquires are released", () => {
    acquirePosition(anchor);
    acquirePosition(anchor);

    releasePosition(anchor);
    releasePosition(anchor);
    expect(anchor.style.position).toBe("");
  });

  it("handles releasePosition without prior acquire gracefully", () => {
    // Should not throw; resets position to ""
    releasePosition(anchor);
    expect(anchor.style.position).toBe("");
  });
});
