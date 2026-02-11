import type { ShadowConfig } from "./types.js";

/** SVG namespace URI for document.createElementNS. */
export const SVG_NS = "http://www.w3.org/2000/svg";

/** Shared counter for unique SVG element IDs across svg-effects and drop-shadow. */
let uid = 0;
export function nextUid(): number { return ++uid; }

/** Converts a 6-digit hex color (e.g. "#ff00aa") to an rgb() CSS string. */
export function hexToRgb(hex: string): string {
  const h = hex.replace("#", "");
  return `rgb(${parseInt(h.substring(0, 2), 16)},${parseInt(h.substring(2, 4), 16)},${parseInt(h.substring(4, 6), 16)})`;
}

/** A ShadowConfig with all values zeroed out — no visible shadow. */
export const DEFAULT_SHADOW: ShadowConfig = {
  offsetX: 0, offsetY: 0, blur: 0, spread: 0, color: "#000", opacity: 0,
};

/**
 * Darken a hex color by multiplying each RGB channel by 2/3.
 * Matches Firefox's groove/ridge algorithm. Pure black maps to #4c4c4c.
 */
export function darkenHex(hex: string): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  if (r === 0 && g === 0 && b === 0) return "#4c4c4c";
  const dr = Math.round(r * 2 / 3);
  const dg = Math.round(g * 2 / 3);
  const db = Math.round(b * 2 / 3);
  return "#" + ((1 << 24) | (dr << 16) | (dg << 8) | db).toString(16).slice(1);
}
