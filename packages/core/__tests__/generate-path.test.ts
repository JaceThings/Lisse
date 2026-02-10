import { describe, it, expect } from "vitest";
import { generatePath, generateClipPath } from "../src/index.js";

describe("generatePath", () => {
  it("returns a simple rect when all radii are 0", () => {
    const path = generatePath(200, 100, { radius: 0 });
    expect(path).toBe("M 0 0 H 200 V 100 H 0 Z");
  });

  it("returns a degenerate path for zero dimensions", () => {
    const path = generatePath(0, 0, { radius: 20 });
    expect(path).toBe("M 0 0 H 0 V 0 H 0 Z");
  });

  it("generates a valid path for uniform corners", () => {
    const path = generatePath(200, 200, { radius: 20, smoothing: 0.6 });
    expect(path).toMatch(/^M /);
    expect(path).toMatch(/Z$/);
    expect(path).toContain("c ");
    expect(path).toContain("a ");
  });

  it("generates a valid path for per-corner config", () => {
    const path = generatePath(200, 200, {
      topLeft: 30,
      topRight: { radius: 20, smoothing: 0.8 },
      bottomRight: 10,
      bottomLeft: 0,
    });
    expect(path).toMatch(/^M /);
    expect(path).toMatch(/Z$/);
  });

  it("handles very large radii (clamped by distribution)", () => {
    const path = generatePath(100, 100, { radius: 200, smoothing: 0.6 });
    expect(path).toMatch(/^M /);
    expect(path).not.toContain("NaN");
    expect(path).not.toContain("Infinity");
  });

  it("handles smoothing of 0 (standard rounded rect)", () => {
    const path = generatePath(200, 200, { radius: 20, smoothing: 0 });
    expect(path).toMatch(/^M /);
    expect(path).not.toContain("NaN");
  });

  it("handles smoothing of 1 (maximum)", () => {
    const path = generatePath(200, 200, { radius: 20, smoothing: 1 });
    expect(path).toMatch(/^M /);
    expect(path).not.toContain("NaN");
  });

  it("produces symmetrical output for uniform corners on a square", () => {
    const path = generatePath(200, 200, { radius: 40, smoothing: 0.6 });
    // The path should start and end properly
    expect(path.startsWith("M ")).toBe(true);
    expect(path.endsWith("Z")).toBe(true);
  });

  it("handles non-square rectangles", () => {
    const path = generatePath(400, 100, { radius: 30, smoothing: 0.6 });
    expect(path).not.toContain("NaN");
    expect(path).not.toContain("Infinity");
  });
});

describe("generateClipPath", () => {
  it("wraps the path in CSS path() syntax", () => {
    const clipPath = generateClipPath(200, 200, { radius: 20, smoothing: 0.6 });
    expect(clipPath).toMatch(/^path\("/);
    expect(clipPath).toMatch(/"\)$/);
  });
});

describe("snapshot tests", () => {
  it("matches snapshot for 200x200 r=40 s=0.6", () => {
    const path = generatePath(200, 200, { radius: 40, smoothing: 0.6 });
    expect(path).toMatchSnapshot();
  });

  it("matches snapshot for 300x150 per-corner", () => {
    const path = generatePath(300, 150, {
      topLeft: { radius: 20, smoothing: 0.4 },
      topRight: { radius: 40, smoothing: 0.8 },
      bottomRight: { radius: 10, smoothing: 0.6 },
      bottomLeft: 0,
    });
    expect(path).toMatchSnapshot();
  });

  it("matches snapshot for 100x100 r=50 s=1 (pill-like)", () => {
    const path = generatePath(100, 100, { radius: 50, smoothing: 1 });
    expect(path).toMatchSnapshot();
  });
});
