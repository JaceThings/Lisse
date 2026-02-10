export { generatePath, generateClipPath } from "./generate-path.js";
export { getPathParamsForCorner } from "./corner-params.js";
export { distributeAndNormalize } from "./distribute.js";
export { getSVGPathFromPathParams } from "./draw.js";
export { toRadians, rounded } from "./utils.js";

export type {
  CornerConfig,
  PerCornerConfig,
  UniformCornerOptions,
  SmoothCornerOptions,
  CornerPathParams,
  CornerParams,
  NormalizedCorner,
  NormalizedCorners,
} from "./types.js";
