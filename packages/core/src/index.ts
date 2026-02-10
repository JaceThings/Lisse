export { generatePath, generateClipPath } from "./generate-path.js";
export { getPathParamsForCorner } from "./corner-params.js";
export { distributeAndNormalize } from "./distribute.js";
export { getSVGPathFromPathParams } from "./draw.js";
export { toRadians, rounded } from "./utils.js";
export { createSvgEffects, type SvgEffectsHandle } from "./svg-effects.js";
export { createDropShadow, type DropShadowHandle } from "./drop-shadow.js";
export { observeResize } from "./observe-resize.js";
export { DEFAULT_SMOOTHING, DEFAULT_PRESERVE_SMOOTHING } from "./generate-path.js";
export { DEFAULT_SHADOW } from "./svg-shared.js";
export {
  extractAndStripEffects,
  restoreStyles,
  parseColor,
  parseBorder,
  parseBoxShadow,
  type ExtractedEffects,
} from "./extract-effects.js";
export { acquirePosition, releasePosition } from "./position-ref-count.js";

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
