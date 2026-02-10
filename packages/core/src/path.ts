// Pure, DOM-free exports for SSR and path-generation-only use cases.
export { generatePath, generateClipPath } from "./generate-path.js";
export { DEFAULT_SMOOTHING, DEFAULT_PRESERVE_SMOOTHING } from "./generate-path.js";
export { getPathParamsForCorner } from "./corner-params.js";
export { distributeAndNormalize } from "./distribute.js";
export { getSVGPathFromPathParams } from "./draw.js";
export { toRadians, rounded } from "./utils.js";
export { SVG_NS, nextUid, hexToRgb, DEFAULT_SHADOW } from "./svg-shared.js";

export type {
  CornerConfig,
  PerCornerConfig,
  UniformCornerOptions,
  SmoothCornerOptions,
  CornerPathParams,
  CornerParams,
  NormalizedCorner,
  NormalizedCorners,
  BorderConfig,
  ShadowConfig,
  EffectsConfig,
} from "./types.js";
