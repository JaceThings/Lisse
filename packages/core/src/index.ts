export { generatePath, generateClipPath } from "./generate-path.js";
export { getPathParamsForCorner } from "./corner-params.js";
export { distributeAndNormalize } from "./distribute.js";
export { createSvgEffects, type SvgEffectsHandle } from "./svg-effects.js";
export { createDropShadow, type DropShadowHandle } from "./drop-shadow.js";
export { observeResize } from "./observe-resize.js";
export { getLayoutSize } from "./layout-size.js";
export {
  APPLE_SMOOTHING,
  FIGMA_SMOOTHING,
  DEFAULT_SMOOTHING,
  DEFAULT_PRESERVE_SMOOTHING,
  DEFAULT_CURVE,
} from "./generate-path.js";
export { DEFAULT_EXPONENT, CURVE_TYPES, getCurveBuilder, buildArc, buildSquircle, buildSuperellipse, buildClothoid } from "./curves/index.js";
export { clearCurveCache } from "./curves/cache.js";
export { DEFAULT_SHADOW, cornerOptionsToBorderRadius } from "./svg-shared.js";
export {
  extractAndStripEffects,
  restoreStyles,
  parseColor,
  parseBorder,
  parseBoxShadow,
  hasEffects,
  mergeEffects,
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
  CurveType,
  BorderConfig,
  BorderStyle,
  ShadowConfig,
  EffectsConfig,
  GradientStop,
  LinearGradientConfig,
  RadialGradientConfig,
  GradientConfig,
} from "./types.js";
export type { CurveBuilder, CurveBuilderInput, CurveBuilderOutput, Orient } from "./curves/index.js";
