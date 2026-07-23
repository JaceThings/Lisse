import type { CurveBuilder, CurveType } from "./types.js";
import { buildArc } from "./arc.js";
import { buildSquircle } from "./squircle.js";
import { buildSuperellipse } from "./superellipse.js";
import { buildClothoid } from "./clothoid.js";

export type { CurveType, CurveBuilder, CurveBuilderInput, CurveBuilderOutput, Orient } from "./types.js";
export { buildArc, buildSquircle, buildSuperellipse, buildClothoid };

/** Default superellipse exponent. Matches CSS `corner-shape: squircle` (Lamé n = 4). */
export const DEFAULT_EXPONENT = 4;

// The `Record<CurveType, …>` constraint makes a missing builder a compile error.
const CURVE_BUILDERS: Record<CurveType, CurveBuilder> = {
  arc: buildArc,
  squircle: buildSquircle,
  superellipse: buildSuperellipse,
  clothoid: buildClothoid,
};

/** Registered curve types — iterate this rather than the union literal. */
export const CURVE_TYPES: readonly CurveType[] = Object.keys(CURVE_BUILDERS) as CurveType[];

export function getCurveBuilder(type: CurveType): CurveBuilder {
  return CURVE_BUILDERS[type];
}
