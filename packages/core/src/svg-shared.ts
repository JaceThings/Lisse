import type { ShadowConfig, SmoothCornerOptions, CornerConfig } from "./types.js";
import { generatePath } from "./generate-path.js";

/** SVG namespace URI for document.createElementNS. */
export const SVG_NS = "http://www.w3.org/2000/svg";

/** Shared counter for unique SVG element IDs across svg-effects and drop-shadow. */
let uid = 0;
export function nextUid(): number { return ++uid; }

/**
 * Convert a hex color (3 or 6 digit) to an `rgb(...)` CSS string.
 * Non-hex input (oklch, lab, color()…) is already a valid CSS color —
 * passed through untouched.
 */
export function hexToRgb(hex: string): string {
  if (!/^#?[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(hex)) return hex;
  const h = hex.replace("#", "");
  const expanded = h.length === 3
    ? h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
    : h;
  return `rgb(${parseInt(expanded.substring(0, 2), 16)},${parseInt(expanded.substring(2, 4), 16)},${parseInt(expanded.substring(4, 6), 16)})`;
}

/** A ShadowConfig with all values zeroed — no visible shadow. */
export const DEFAULT_SHADOW: ShadowConfig = {
  offsetX: 0, offsetY: 0, blur: 0, spread: 0, color: "#000", opacity: 0,
};

function serializeCorner(c: CornerConfig | number | undefined): string {
  if (c === undefined) return "";
  if (typeof c === "number") return String(c);
  return [
    c.radius,
    c.smoothing ?? "",
    c.curve ?? "",
    c.exponent ?? "",
    c.preserveSmoothing ?? "",
  ].join(",");
}

/** Stable cache key for corner options (uniform or per-corner). */
export function serializeSmoothCornerOptions(opts: SmoothCornerOptions): string {
  if ("radius" in opts) {
    return `u:${serializeCorner(opts)}`;
  }
  return [
    "p",
    serializeCorner(opts.topLeft),
    serializeCorner(opts.topRight),
    serializeCorner(opts.bottomRight),
    serializeCorner(opts.bottomLeft),
  ].join("|");
}

/**
 * Per-dispatch path memo. Both `createDropShadow` and `createSvgEffects`
 * generate paths multiple times per `update()` for the same
 * `(width, height, opts, spread)` tuple. Keys on the call-time `opts`
 * (including spread-adjusted radii) so memo entries stay correct when
 * `adjustOptions` is applied. Scoped to a single `update()`; stale entries
 * can't leak.
 */
export function createPathCache(): (
  w: number,
  h: number,
  opts: SmoothCornerOptions,
  spread: number,
) => string {
  const cache = new Map<string, string>();
  return (w, h, opts, spread) => {
    const key = `${w}:${h}:${spread}:${serializeSmoothCornerOptions(opts)}`;
    let cached = cache.get(key);
    if (cached === undefined) {
      cached = generatePath(w, h, opts);
      cache.set(key, cached);
    }
    return cached;
  };
}

/** Adjust corner radii by a spread offset (clamped to zero). */
export function adjustOptions(options: SmoothCornerOptions, spread: number): SmoothCornerOptions {
  if (spread === 0) return options;
  if ("radius" in options) {
    return { ...options, radius: Math.max(0, options.radius + spread) };
  }
  const adjust = (v: CornerConfig | number | undefined): CornerConfig | number | undefined => {
    if (v === undefined) return undefined;
    if (typeof v === "number") return Math.max(0, v + spread);
    return { ...v, radius: Math.max(0, v.radius + spread) };
  };
  return {
    topLeft: adjust(options.topLeft),
    topRight: adjust(options.topRight),
    bottomRight: adjust(options.bottomRight),
    bottomLeft: adjust(options.bottomLeft),
  };
}
