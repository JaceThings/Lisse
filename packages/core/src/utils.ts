import type { Corner, Adjacent } from "./types.js";

/** Convert an angle in degrees to radians. */
export function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Tagged-template helper that formats interpolated numbers to 4 decimal
 * places. Used to keep generated SVG path strings compact and stable
 * across re-renders.
 */
export function rounded(
  strings: TemplateStringsArray,
  ...values: number[]
): string {
  return strings.reduce((acc, str, i) => {
    const value = values[i];
    if (typeof value === "number") {
      return acc + str + value.toFixed(4);
    } else {
      return acc + str + (value ?? "");
    }
  }, "");
}

/**
 * Adjacency map used when distributing per-corner radii under space
 * constraints: each corner's two adjacent corners (share an edge) and
 * the side they share.
 */
export const adjacentsByCorner: Record<Corner, Array<Adjacent>> = {
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
