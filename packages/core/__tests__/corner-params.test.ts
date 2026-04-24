import { describe, it, expect } from "vitest";
import { getPathParamsForCorner } from "../src/corner-params.js";

describe("getPathParamsForCorner", () => {
  it("returns a fully-zeroed struct when cornerRadius is 0", () => {
    // Without the zero-radius short-circuit this path divides
    // `roundingAndSmoothingBudget / cornerRadius`, which produces a
    // non-finite `maxCornerSmoothing` and poisons downstream fields.
    const params = getPathParamsForCorner({
      cornerRadius: 0,
      cornerSmoothing: 0.6,
      preserveSmoothing: false,
      roundingAndSmoothingBudget: 10,
    });

    expect(params).toEqual({
      a: 0,
      b: 0,
      c: 0,
      d: 0,
      p: 0,
      arcSectionLength: 0,
      cornerRadius: 0,
    });

    for (const value of Object.values(params)) {
      expect(Number.isFinite(value)).toBe(true);
    }
  });

  it("returns a fully-zeroed struct when cornerRadius is 0 with preserveSmoothing: true", () => {
    const params = getPathParamsForCorner({
      cornerRadius: 0,
      cornerSmoothing: 0.6,
      preserveSmoothing: true,
      roundingAndSmoothingBudget: 10,
    });

    for (const value of Object.values(params)) {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBe(0);
    }
  });

  it("produces finite fields for a non-zero radius", () => {
    const params = getPathParamsForCorner({
      cornerRadius: 16,
      cornerSmoothing: 0.6,
      preserveSmoothing: false,
      roundingAndSmoothingBudget: 24,
    });

    for (const value of Object.values(params)) {
      expect(Number.isFinite(value)).toBe(true);
    }
    expect(params.cornerRadius).toBe(16);
    expect(params.p).toBeGreaterThan(0);
  });
});
