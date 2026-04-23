import type {
  RoundedRectangle,
  NormalizedCorners,
  Corner,
} from "./types.js";
import { adjacentsByCorner } from "./utils.js";

/**
 * Distribute available space among corners, normalizing radii so they
 * don't exceed the rectangle dimensions. Larger corners get priority.
 */
export function distributeAndNormalize({
  topLeftCornerRadius,
  topRightCornerRadius,
  bottomRightCornerRadius,
  bottomLeftCornerRadius,
  width,
  height,
}: RoundedRectangle): NormalizedCorners {
  const roundingAndSmoothingBudgetMap: Record<Corner, number> = {
    topLeft: -1,
    topRight: -1,
    bottomLeft: -1,
    bottomRight: -1,
  };

  const cornerRadiusMap: Record<Corner, number> = {
    topLeft: topLeftCornerRadius,
    topRight: topRightCornerRadius,
    bottomLeft: bottomLeftCornerRadius,
    bottomRight: bottomRightCornerRadius,
  };

  (Object.entries(cornerRadiusMap) as [Corner, number][])
    // Let bigger corners choose first
    .sort(([, r1], [, r2]) => r2 - r1)
    .forEach(([corner, radius]) => {
      const adjacents = adjacentsByCorner[corner];

      const budget = Math.min(
        ...adjacents.map((adjacent) => {
          const adjacentCornerRadius = cornerRadiusMap[adjacent.corner];
          if (radius === 0 && adjacentCornerRadius === 0) {
            return 0;
          }

          const adjacentCornerBudget =
            roundingAndSmoothingBudgetMap[adjacent.corner];

          const sideLength =
            adjacent.side === "top" || adjacent.side === "bottom"
              ? width
              : height;

          if (adjacentCornerBudget >= 0) {
            return sideLength - adjacentCornerBudget;
          } else {
            return (radius / (radius + adjacentCornerRadius)) * sideLength;
          }
        })
      );

      roundingAndSmoothingBudgetMap[corner] = budget;
      cornerRadiusMap[corner] = Math.min(radius, budget);
    });

  const toCorner = (c: Corner) => ({
    radius: cornerRadiusMap[c],
    roundingAndSmoothingBudget: roundingAndSmoothingBudgetMap[c],
  });

  return {
    topLeft: toCorner("topLeft"),
    topRight: toCorner("topRight"),
    bottomLeft: toCorner("bottomLeft"),
    bottomRight: toCorner("bottomRight"),
  };
}
