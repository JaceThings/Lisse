import type { ShadowConfig, SmoothCornerOptions, CornerConfig, GradientConfig, GradientStop } from "./types.js";
import { generatePath } from "./generate-path.js";

export const SVG_NS = "http://www.w3.org/2000/svg";

/** Shared counter for unique SVG element IDs across svg-effects and drop-shadow. */
let uid = 0;
export function nextUid(): number { return ++uid; }

/** Expand 3-char hex (`"#f00"` → `"#ff0000"`); 6-char passes through. */
function expandHex(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length === 3) return "#" + h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return "#" + h;
}

/**
 * Convert a hex color (3 or 6 digit) to an `rgb(...)` CSS string.
 * Non-hex input (oklch, lab, color()…) is already a valid CSS color —
 * passed through untouched.
 */
export function hexToRgb(hex: string): string {
  if (!/^#?[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(hex)) return hex;
  const h = expandHex(hex).replace("#", "");
  return `rgb(${parseInt(h.substring(0, 2), 16)},${parseInt(h.substring(2, 4), 16)},${parseInt(h.substring(4, 6), 16)})`;
}

/** A ShadowConfig with all values zeroed — no visible shadow. */
export const DEFAULT_SHADOW: ShadowConfig = {
  offsetX: 0, offsetY: 0, blur: 0, spread: 0, color: "#000", opacity: 0,
};

/**
 * Persistent path memo. Both `createDropShadow` and `createSvgEffects`
 * generate paths multiple times per `update()` for the same
 * `(width, height, options)` tuple, differing only by spread. Spread is
 * folded into the key so spread-only variants memoise independently.
 *
 * The cache Map and the serialized options key live on the handle: create
 * one per effects/shadow handle and reuse it across `update()` calls.
 * `setOptions` clears the per-size entries whenever the serialized shape
 * changes; they're bounded by an LRU cap so a resize animation can't grow the
 * map without limit.
 */
export interface PathCache {
  (w: number, h: number, opts: SmoothCornerOptions, spread: number): string;
  /** Set the base options for the current dispatch; clears the cache when the serialized shape changes. */
  setOptions(options: SmoothCornerOptions): void;
  /** Internal (tests only): current number of memoised path entries. */
  _size(): number;
}

/** Per-handle path-cache cap. One entry per unique (w, h, spread); a resize
 *  animation sweeps many sizes, so bound it LRU-style like curves/cache.ts. */
export const PATH_CACHE_CAPACITY = 128;

export function createPathCache(options?: SmoothCornerOptions): PathCache {
  const cache = new Map<string, string>();
  let optionsKey: string | undefined;

  const setOptions = (opts: SmoothCornerOptions): void => {
    // Always re-serialise and compare the key. Options objects are commonly
    // mutated in place (Vue reactive props), so a reference check would miss
    // a shape change and leak stale border/shadow paths after a clip update.
    const key = JSON.stringify(opts);
    if (key !== optionsKey) {
      optionsKey = key;
      cache.clear();
    }
  };

  const getPath = ((w, h, opts, spread) => {
    const key = `${w}:${h}:${spread}`;
    const cached = cache.get(key);
    if (cached !== undefined) {
      // LRU touch: delete + re-insert moves the entry to the newest slot.
      cache.delete(key);
      cache.set(key, cached);
      return cached;
    }
    const fresh = generatePath(w, h, opts);
    if (cache.size >= PATH_CACHE_CAPACITY) {
      cache.delete(cache.keys().next().value!);
    }
    cache.set(key, fresh);
    return fresh;
  }) as PathCache;
  getPath.setOptions = setOptions;
  getPath._size = () => cache.size;

  if (options !== undefined) setOptions(options);
  return getPath;
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

/**
 * Darken each RGB channel by 2/3 — Firefox's groove/ridge algorithm.
 * Pure black maps to #4c4c4c so the darkened edge stays visible.
 */
export function darkenHex(hex: string): string {
  const h = expandHex(hex).replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  if (r === 0 && g === 0 && b === 0) return "#4c4c4c";
  const dr = Math.round(r * 2 / 3);
  const dg = Math.round(g * 2 / 3);
  const db = Math.round(b * 2 / 3);
  return "#" + ((1 << 24) | (dr << 16) | (dg << 8) | db).toString(16).slice(1);
}

/** True when the border color is a GradientConfig object, not a hex string. */
export function isGradient(color: string | GradientConfig): color is GradientConfig {
  return typeof color === "object" && color !== null && "type" in color;
}

/**
 * CSS-convention angle (deg) → SVG linearGradient x1/y1/x2/y2.
 * CSS: 0deg = bottom-to-top, 90deg = left-to-right.
 */
export function angleToCoords(angleDeg: number): { x1: number; y1: number; x2: number; y2: number } {
  const rad = (90 - angleDeg) * Math.PI / 180;
  return {
    x1: 0.5 - 0.5 * Math.cos(rad),
    y1: 0.5 + 0.5 * Math.sin(rad),
    x2: 0.5 + 0.5 * Math.cos(rad),
    y2: 0.5 - 0.5 * Math.sin(rad),
  };
}

function applyStops(gradientEl: Element, stops: GradientStop[]): void {
  while (gradientEl.lastChild) gradientEl.removeChild(gradientEl.lastChild);
  for (const s of stops) {
    const stop = document.createElementNS(SVG_NS, "stop");
    stop.setAttribute("offset", String(s.offset));
    stop.setAttribute("stop-color", s.color);
    if (s.opacity !== undefined && s.opacity !== 1) {
      stop.setAttribute("stop-opacity", String(s.opacity));
    }
    gradientEl.appendChild(stop);
  }
}

/** Create a `<linearGradient>` / `<radialGradient>` def appended to `<defs>`. */
export function createGradientDef(defs: Element, config: GradientConfig, id: string): Element {
  const tag = config.type === "linear" ? "linearGradient" : "radialGradient";
  const el = document.createElementNS(SVG_NS, tag);
  el.setAttribute("id", id);
  setGradientAttrs(el, config);
  applyStops(el, config.stops);
  defs.appendChild(el);
  return el;
}

/** Update an existing gradient element's attrs and stops in place. */
export function updateGradientDef(gradientEl: Element, config: GradientConfig): void {
  setGradientAttrs(gradientEl, config);
  applyStops(gradientEl, config.stops);
}

function setGradientAttrs(el: Element, config: GradientConfig): void {
  if (config.type === "linear") {
    const coords = angleToCoords(config.angle ?? 0);
    el.setAttribute("x1", String(coords.x1));
    el.setAttribute("y1", String(coords.y1));
    el.setAttribute("x2", String(coords.x2));
    el.setAttribute("y2", String(coords.y2));
  } else {
    el.setAttribute("cx", String(config.cx ?? 0.5));
    el.setAttribute("cy", String(config.cy ?? 0.5));
    el.setAttribute("r", String(config.r ?? 0.5));
  }
}

/** Return a copy of `config` with each stop's color run through `darkenHex`. */
export function darkenGradient(config: GradientConfig): GradientConfig {
  return { ...config, stops: config.stops.map(s => ({ ...s, color: darkenHex(s.color) })) };
}
