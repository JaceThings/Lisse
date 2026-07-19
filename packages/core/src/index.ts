export { generatePath, generateClipPath } from "./generate-path.js";
export { getPathParamsForCorner } from "./corner-params.js";
export { createSvgEffects, type SvgEffectsHandle } from "./svg-effects.js";
export { createDropShadow, type DropShadowHandle } from "./drop-shadow.js";
export { observeResize } from "./observe-resize.js";
export { getLayoutSize } from "./layout-size.js";
export { DEFAULT_SMOOTHING, DEFAULT_PRESERVE_SMOOTHING, DEFAULT_CURVE } from "./generate-path.js";
export { parseColor, parseBoxShadow, hasEffects } from "./extract-effects.js";
export {
  createSmoothCornersController,
  type SmoothCornersController,
  type SmoothCornersControllerConfig,
} from "./smooth-corners-controller.js";

export type {
  CornerConfig,
  PerCornerConfig,
  SmoothCornerOptions,
  CurveType,
  BorderConfig,
  BorderStyle,
  ShadowConfig,
  EffectsConfig,
  CornerPathParams,
} from "./types.js";
