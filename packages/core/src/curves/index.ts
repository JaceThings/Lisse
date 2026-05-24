import type { CurveBuilder, CurveType } from "./types.js";
import { buildArc } from "./arc.js";
import { buildSquircle } from "./squircle.js";
import { buildSuperellipse } from "./superellipse.js";
import { buildClothoid } from "./clothoid.js";

export type { CurveType, CurveBuilder, CurveBuilderInput, CurveBuilderOutput, Orient } from "./types.js";
export { buildArc, buildSquircle, buildSuperellipse, buildClothoid };

/** Default superellipse exponent. Matches CSS `corner-shape: squircle` (Lamé n = 4). */
export const DEFAULT_EXPONENT = 4;

/** Registered curve types. UI lists and tests should iterate this
 *  rather than hardcoding the union literal. */
export const CURVE_TYPES: readonly CurveType[] = [
  "arc",
  "squircle",
  "superellipse",
  "clothoid",
];

/** Single source of truth for which builder runs per curve type. */
export function getCurveBuilder(type: CurveType): CurveBuilder {
  switch (type) {
    case "arc":
      return buildArc;
    case "squircle":
      return buildSquircle;
    case "superellipse":
      return buildSuperellipse;
    case "clothoid":
      return buildClothoid;
    default: {
      // Adding a fifth CurveType without wiring its builder here is a
      // compile error at this site.
      const _exhaustive: never = type;
      throw new Error(`Unknown curve type: ${String(_exhaustive)}`);
    }
  }
}
