import { describe, it, expect } from "vitest";
import type { RoundedRectangle } from "../src/types.js";
import { distributeAndNormalize } from "../src/index.js";

/**
 * Reference implementation: the pre-optimization general algorithm, kept here
 * verbatim so the uniform fast path can be proven bit-identical to it across
 * representative and degenerate inputs.
 */
type Corner = "topLeft" | "topRight" | "bottomLeft" | "bottomRight";
type Side = "top" | "left" | "right" | "bottom";
interface Adjacent {
  side: Side;
  corner: Corner;
}
const adjacentsByCorner: Record<Corner, Adjacent[]> = {
  topLeft: [
    { corner: "topRight", side: "top" },
    { corner: "bottomLeft", side: "left" },
  ],
  topRight: [
    { corner: "topLeft", side: "top" },
    { corner: "bottomRight", side: "right" },
  ],
  bottomLeft: [
    { corner: "bottomRight", side: "bottom" },
    { corner: "topLeft", side: "left" },
  ],
  bottomRight: [
    { corner: "bottomLeft", side: "bottom" },
    { corner: "topRight", side: "right" },
  ],
};

function reference(input: RoundedRectangle) {
  const { width, height } = input;
  const budget: Record<Corner, number> = {
    topLeft: -1,
    topRight: -1,
    bottomLeft: -1,
    bottomRight: -1,
  };
  const radiusMap: Record<Corner, number> = {
    topLeft: input.topLeftCornerRadius,
    topRight: input.topRightCornerRadius,
    bottomLeft: input.bottomLeftCornerRadius,
    bottomRight: input.bottomRightCornerRadius,
  };
  (Object.entries(radiusMap) as [Corner, number][])
    .sort(([, r1], [, r2]) => r2 - r1)
    .forEach(([corner, radius]) => {
      const b = Math.min(
        ...adjacentsByCorner[corner].map((adjacent) => {
          const adjacentCornerRadius = radiusMap[adjacent.corner];
          if (radius === 0 && adjacentCornerRadius === 0) return 0;
          const adjacentCornerBudget = budget[adjacent.corner];
          const sideLength =
            adjacent.side === "top" || adjacent.side === "bottom"
              ? width
              : height;
          if (adjacentCornerBudget >= 0) return sideLength - adjacentCornerBudget;
          return (radius / (radius + adjacentCornerRadius)) * sideLength;
        })
      );
      budget[corner] = b;
      radiusMap[corner] = Math.min(radius, b);
    });
  const toCorner = (c: Corner) => ({
    radius: radiusMap[c],
    roundingAndSmoothingBudget: budget[c],
  });
  return {
    topLeft: toCorner("topLeft"),
    topRight: toCorner("topRight"),
    bottomLeft: toCorner("bottomLeft"),
    bottomRight: toCorner("bottomRight"),
  };
}

const uniform = (r: number, width: number, height: number): RoundedRectangle => ({
  topLeftCornerRadius: r,
  topRightCornerRadius: r,
  bottomRightCornerRadius: r,
  bottomLeftCornerRadius: r,
  width,
  height,
});

describe("distributeAndNormalize uniform fast path", () => {
  const cases: Array<[string, RoundedRectangle]> = [
    ["square, radius fits", uniform(20, 200, 200)],
    ["square, radius larger than box", uniform(100, 100, 100)],
    ["square, radius far larger than box", uniform(500, 100, 100)],
    ["wide box", uniform(100, 200, 100)],
    ["tall box", uniform(30, 100, 200)],
    ["wide box, radius exceeds", uniform(100, 200, 100)],
    ["tall box, radius exceeds", uniform(120, 100, 200)],
    ["fractional radius and box", uniform(17.5, 133.25, 88.4)],
    ["tiny radius", uniform(0.0001, 100, 100)],
    ["zero radius (degenerate)", uniform(0, 200, 200)],
    ["zero width (degenerate)", uniform(50, 0, 100)],
    ["zero height (degenerate)", uniform(50, 100, 0)],
    ["zero size (degenerate)", uniform(50, 0, 0)],
    ["zero radius and zero size", uniform(0, 0, 0)],
  ];

  for (const [name, input] of cases) {
    it(`matches the general algorithm: ${name}`, () => {
      expect(distributeAndNormalize(input)).toEqual(reference(input));
    });
  }

  it("returns the closed-form min(w,h)/2 budget for a positive uniform box", () => {
    const result = distributeAndNormalize(uniform(100, 200, 120));
    for (const corner of [
      result.topLeft,
      result.topRight,
      result.bottomLeft,
      result.bottomRight,
    ]) {
      expect(corner.roundingAndSmoothingBudget).toBe(60);
      expect(corner.radius).toBe(60);
    }
  });

  it("matches the general algorithm for non-uniform inputs too", () => {
    const inputs: RoundedRectangle[] = [
      {
        topLeftCornerRadius: 80,
        topRightCornerRadius: 20,
        bottomRightCornerRadius: 20,
        bottomLeftCornerRadius: 20,
        width: 100,
        height: 100,
      },
      {
        topLeftCornerRadius: 10,
        topRightCornerRadius: 40,
        bottomRightCornerRadius: 0,
        bottomLeftCornerRadius: 90,
        width: 150,
        height: 80,
      },
      {
        topLeftCornerRadius: 0,
        topRightCornerRadius: 60,
        bottomRightCornerRadius: 60,
        bottomLeftCornerRadius: 0,
        width: 120,
        height: 200,
      },
    ];
    for (const input of inputs) {
      expect(distributeAndNormalize(input)).toEqual(reference(input));
    }
  });
});
