// Pure, DOM-free exports for SSR and path-generation-only use cases.
export { generatePath, generateClipPath } from "./generate-path.js";
export {
  APPLE_SMOOTHING,
  FIGMA_SMOOTHING,
  DEFAULT_SMOOTHING,
  DEFAULT_PRESERVE_SMOOTHING,
  DEFAULT_CURVE,
} from "./generate-path.js";
export { DEFAULT_EXPONENT, CURVE_TYPES, getCurveBuilder, buildArc, buildSquircle, buildSuperellipse, buildClothoid } from "./curves/index.js";
export { getPathParamsForCorner } from "./corner-params.js";
export { distributeAndNormalize } from "./distribute.js";
export { DEFAULT_SHADOW } from "./svg-shared.js";

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
