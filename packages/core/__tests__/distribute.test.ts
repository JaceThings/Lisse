import { describe, it, expect } from "vitest";
import { distributeAndNormalize } from "../src/index.js";

describe("distributeAndNormalize", () => {
  it("returns original radii when they fit", () => {
    const result = distributeAndNormalize({
      topLeftCornerRadius: 20,
      topRightCornerRadius: 20,
      bottomRightCornerRadius: 20,
      bottomLeftCornerRadius: 20,
      width: 200,
      height: 200,
    });

    expect(result.topLeft.radius).toBe(20);
    expect(result.topRight.radius).toBe(20);
    expect(result.bottomLeft.radius).toBe(20);
    expect(result.bottomRight.radius).toBe(20);
  });

  it("clamps radii when they exceed available space", () => {
    const result = distributeAndNormalize({
      topLeftCornerRadius: 100,
      topRightCornerRadius: 100,
      bottomRightCornerRadius: 100,
      bottomLeftCornerRadius: 100,
      width: 100,
      height: 100,
    });

    // Each corner should be clamped to at most 50 on a 100x100 square
    expect(result.topLeft.radius).toBeLessThanOrEqual(50);
    expect(result.topRight.radius).toBeLessThanOrEqual(50);
    expect(result.bottomLeft.radius).toBeLessThanOrEqual(50);
    expect(result.bottomRight.radius).toBeLessThanOrEqual(50);
  });

  it("handles all-zero radii", () => {
    const result = distributeAndNormalize({
      topLeftCornerRadius: 0,
      topRightCornerRadius: 0,
      bottomRightCornerRadius: 0,
      bottomLeftCornerRadius: 0,
      width: 200,
      height: 200,
    });

    expect(result.topLeft.radius).toBe(0);
    expect(result.topRight.radius).toBe(0);
  });

  it("distributes asymmetric radii fairly", () => {
    const result = distributeAndNormalize({
      topLeftCornerRadius: 80,
      topRightCornerRadius: 20,
      bottomRightCornerRadius: 20,
      bottomLeftCornerRadius: 20,
      width: 100,
      height: 100,
    });

    // The large corner should get proportionally more space
    expect(result.topLeft.radius).toBeGreaterThan(result.topRight.radius);
    // But not exceed the budget
    expect(
      result.topLeft.radius + result.topRight.radius
    ).toBeLessThanOrEqual(100);
  });
});
