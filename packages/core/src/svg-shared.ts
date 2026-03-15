import type { ShadowConfig, SmoothCornerOptions, CornerConfig, GradientConfig, GradientStop } from "./types.js";

/** SVG namespace URI for document.createElementNS. */
export const SVG_NS = "http://www.w3.org/2000/svg";

/** Shared counter for unique SVG element IDs across svg-effects and drop-shadow. */
let uid = 0;
export function nextUid(): number { return ++uid; }

/** Expand a 3-char hex (e.g. "#f00") to 6-char hex ("#ff0000"). Already-6-char hex passes through. */
function expandHex(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length === 3) return "#" + h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return "#" + h;
}

/** Converts a hex color (3 or 6 digit) to an rgb() CSS string. */
export function hexToRgb(hex: string): string {
  const h = expandHex(hex).replace("#", "");
  return `rgb(${parseInt(h.substring(0, 2), 16)},${parseInt(h.substring(2, 4), 16)},${parseInt(h.substring(4, 6), 16)})`;
}

/** A ShadowConfig with all values zeroed out — no visible shadow. */
export const DEFAULT_SHADOW: ShadowConfig = {
  offsetX: 0, offsetY: 0, blur: 0, spread: 0, color: "#000", opacity: 0,
};

/** Adjust corner options by a spread offset (used by inner shadow and drop shadow). */
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
 * Darken a hex color by multiplying each RGB channel by 2/3.
 * Matches Firefox's groove/ridge algorithm. Pure black maps to #4c4c4c.
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

/**
 * Returns true if the border color is a GradientConfig object rather than a plain string.
 */
export function isGradient(color: string | GradientConfig): color is GradientConfig {
  return typeof color === "object" && color !== null && "type" in color;
}

/**
 * Convert a CSS-convention angle (degrees) to SVG linearGradient x1/y1/x2/y2 coordinates.
 * CSS: 0deg = bottom-to-top, 90deg = left-to-right.
 */
export function angleToCoords(angleDeg: number): { x1: number; y1: number; x2: number; y2: number } {
  const mathAngle = 90 - angleDeg;
  const rad = mathAngle * Math.PI / 180;
  return {
    x1: 0.5 - 0.5 * Math.cos(rad),
    y1: 0.5 + 0.5 * Math.sin(rad),
    x2: 0.5 + 0.5 * Math.cos(rad),
    y2: 0.5 - 0.5 * Math.sin(rad),
  };
}

/** Apply stops to an SVG gradient element (linear or radial), replacing existing stops. */
function applyStops(gradientEl: Element, stops: GradientStop[]): void {
  // Remove existing stops
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

/**
 * Create an SVG gradient definition (`<linearGradient>` or `<radialGradient>`)
 * and append it to the given `<defs>` element.
 */
export function createGradientDef(defs: Element, config: GradientConfig, id: string): Element {
  const tag = config.type === "linear" ? "linearGradient" : "radialGradient";
  const el = document.createElementNS(SVG_NS, tag);
  el.setAttribute("id", id);
  setGradientAttrs(el, config);
  applyStops(el, config.stops);
  defs.appendChild(el);
  return el;
}

/**
 * Update an existing SVG gradient element's attributes and stops in place.
 */
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

/**
 * Return a new GradientConfig with each stop's color darkened via `darkenHex`.
 */
export function darkenGradient(config: GradientConfig): GradientConfig {
  return { ...config, stops: config.stops.map(s => ({ ...s, color: darkenHex(s.color) })) };
}
