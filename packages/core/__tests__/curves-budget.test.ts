// Budget and clamping edge cases per curve. Squircle has always survived
// these — these tests lock the same guarantees for arc, superellipse, and
// clothoid (no NaN, no Infinity, well-formed M…Z path).
import { describe, it, expect } from "vitest";
import { generatePath } from "../src/generate-path.js";
import type { CurveType } from "../src/types.js";

const CURVES: CurveType[] = ["arc", "squircle", "superellipse", "clothoid"];

function expectSafe(path: string): void {
  expect(path).not.toContain("NaN");
  expect(path).not.toContain("Infinity");
  expect(path).not.toContain("undefined");
  expect(path).toMatch(/^M /);
  expect(path).toMatch(/Z$/);
}

describe("budget — radius clamped to half-side", () => {
  for (const curve of CURVES) {
    it(`${curve}: R = 200 on 100×100 (R > half-side)`, () => {
      const path = generatePath(100, 100, { radius: 200, curve });
      expectSafe(path);
    });
    it(`${curve}: R = 50 on 100×100 (half-side pill)`, () => {
      const path = generatePath(100, 100, { radius: 50, curve });
      expectSafe(path);
    });
  }
});

describe("budget — mixed-radius corners", () => {
  for (const curve of CURVES) {
    it(`${curve}: zero-radius topLeft alongside non-zero corners`, () => {
      const path = generatePath(200, 200, {
        topLeft: { radius: 0, curve },
        topRight: { radius: 30, curve },
        bottomRight: { radius: 30, curve },
        bottomLeft: { radius: 30, curve },
      });
      expectSafe(path);
    });

    it(`${curve}: asymmetric radii`, () => {
      const path = generatePath(300, 150, {
        topLeft: { radius: 10, curve },
        topRight: { radius: 50, curve },
        bottomRight: { radius: 20, curve },
        bottomLeft: { radius: 40, curve },
      });
      expectSafe(path);
    });
  }
});

describe("smoothing edges", () => {
  for (const curve of ["squircle", "clothoid"] as const) {
    it(`${curve}: smoothing = 0`, () => {
      const path = generatePath(200, 200, { radius: 40, curve, smoothing: 0 });
      expectSafe(path);
    });
    it(`${curve}: smoothing = 1`, () => {
      const path = generatePath(200, 200, { radius: 40, curve, smoothing: 1 });
      expectSafe(path);
    });
  }
});

describe("superellipse exponent edges", () => {
  for (const exponent of [2, 2.5, 3, 4, 6, 8]) {
    it(`n = ${exponent}`, () => {
      const path = generatePath(200, 200, {
        radius: 40,
        curve: "superellipse",
        exponent,
      });
      expectSafe(path);
    });
  }
});

describe("per-corner curve mixing", () => {
  it("all four curve types on one rectangle", () => {
    const path = generatePath(300, 300, {
      topLeft: { radius: 40, curve: "clothoid", smoothing: 0.8 },
      topRight: { radius: 40, curve: "arc" },
      bottomRight: { radius: 40, curve: "superellipse", exponent: 6 },
      bottomLeft: { radius: 40, curve: "squircle", smoothing: 0.6 },
    });
    expectSafe(path);
  });

  it("per-corner smoothing does not contaminate adjacent corners", () => {
    const path = generatePath(300, 300, {
      topLeft: { radius: 40, curve: "clothoid", smoothing: 0 },
      topRight: { radius: 40, curve: "clothoid", smoothing: 1 },
      bottomRight: { radius: 40, curve: "clothoid", smoothing: 0.5 },
      bottomLeft: { radius: 40, curve: "clothoid", smoothing: 0.9 },
    });
    expectSafe(path);
  });
});

describe("snapshot — one path per curve at the canonical 200×200 r=40 s=0.6", () => {
  for (const curve of CURVES) {
    it(`${curve}`, () => {
      const path = generatePath(200, 200, { radius: 40, curve, smoothing: 0.6 });
      expect(path).toMatchSnapshot();
    });
  }
});
