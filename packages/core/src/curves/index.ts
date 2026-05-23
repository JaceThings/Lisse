import type { CurveBuilder, CurveType } from "./types.js";
import { buildArc } from "./arc.js";
import { buildSquircle } from "./squircle.js";
import { buildSuperellipse } from "./superellipse.js";
import { buildClothoid } from "./clothoid.js";

export type { CurveType, CurveBuilder, CurveBuilderInput, CurveBuilderOutput, Orient } from "./types.js";
export { buildArc, buildSquircle, buildSuperellipse, buildClothoid };

/**
 * Default exponent for the superellipse curve. Matches the value that
 * CSS `corner-shape: squircle` resolves to (a Lamé curve with n = 4).
 */
export const DEFAULT_EXPONENT = 4;

/** Dispatch table — single source of truth for which builder runs for each curve. */
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
  }
}
