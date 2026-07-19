// Pure, DOM-free exports for SSR and path-generation-only use cases.
export { generatePath, generateClipPath } from "./generate-path.js";
export { DEFAULT_SMOOTHING, DEFAULT_PRESERVE_SMOOTHING, DEFAULT_CURVE } from "./generate-path.js";

export type {
  CornerConfig,
  PerCornerConfig,
  SmoothCornerOptions,
  CurveType,
  BorderConfig,
  BorderStyle,
  ShadowConfig,
  EffectsConfig,
} from "./types.js";
