import type { BorderConfig, ShadowConfig, EffectsConfig } from "./types.js";

export interface ExtractedEffects {
  effects: EffectsConfig;
  savedStyles: { border: string; boxShadow: string };
}

/**
 * Parse an rgb/rgba color string (as returned by getComputedStyle) into hex + opacity.
 * Returns undefined for unrecognized formats.
 */
export function parseColor(raw: string): { hex: string; opacity: number } | undefined {
  const match = raw.match(
    /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)$/,
  );
  if (!match) return undefined;
  const r = Number(match[1]);
  const g = Number(match[2]);
  const b = Number(match[3]);
  const a = match[4] !== undefined ? Number(match[4]) : 1;
  const hex =
    "#" +
    ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  return { hex, opacity: a };
}

/**
 * Read the computed border from an element and convert it to a BorderConfig.
 * Returns undefined if the border is effectively invisible (none/hidden, width 0, or transparent).
 */
export function parseBorder(el: HTMLElement): BorderConfig | undefined {
  const cs = getComputedStyle(el);
  const style = cs.borderTopStyle;
  if (style === "none" || style === "hidden") return undefined;

  const width = parseFloat(cs.borderTopWidth);
  if (width <= 0 || isNaN(width)) return undefined;

  const color = parseColor(cs.borderTopColor);
  if (!color || color.opacity <= 0) return undefined;

  return { width, color: color.hex, opacity: color.opacity };
}

/**
 * Parse a computed box-shadow string into outer shadow and inset shadow configs.
 * Only the first outer and first inset shadow are extracted.
 */
export function parseBoxShadow(raw: string): {
  shadow?: ShadowConfig;
  innerShadow?: ShadowConfig;
} {
  if (!raw || raw === "none") return {};

  // Split on commas that are not inside parentheses (rgb/rgba)
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === "(") depth++;
    else if (raw[i] === ")") depth--;
    else if (raw[i] === "," && depth === 0) {
      parts.push(raw.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(raw.slice(start).trim());

  let shadow: ShadowConfig | undefined;
  let innerShadow: ShadowConfig | undefined;

  for (const part of parts) {
    if (shadow && innerShadow) break;

    const isInset = part.includes("inset");
    const cleaned = part.replace("inset", "").trim();

    // Extract color (rgb/rgba) and numeric values
    const colorMatch = cleaned.match(/rgba?\([^)]+\)/);
    if (!colorMatch) continue;

    const color = parseColor(colorMatch[0]);
    if (!color || color.opacity <= 0) continue;

    // Extract px values from the remainder
    const rest = cleaned.replace(colorMatch[0], "").trim();
    const values = rest.split(/\s+/).map(parseFloat).filter((v) => !isNaN(v));
    if (values.length < 2) continue;

    const config: ShadowConfig = {
      offsetX: values[0],
      offsetY: values[1],
      blur: values[2] ?? 0,
      spread: values[3] ?? 0,
      color: color.hex,
      opacity: color.opacity,
    };

    if (isInset && !innerShadow) {
      innerShadow = config;
    } else if (!isInset && !shadow) {
      shadow = config;
    }
  }

  return { shadow, innerShadow };
}

/**
 * Extract CSS border and box-shadow from an element, strip them from inline styles,
 * and return equivalent EffectsConfig values along with saved styles for restoration.
 */
export function extractAndStripEffects(el: HTMLElement): ExtractedEffects {
  const savedStyles = {
    border: el.style.border,
    boxShadow: el.style.boxShadow,
  };

  const innerBorder = parseBorder(el);
  const cs = getComputedStyle(el);
  const { shadow, innerShadow } = parseBoxShadow(cs.boxShadow);

  el.style.border = "0";
  el.style.boxShadow = "none";

  const effects: EffectsConfig = {};
  if (innerBorder) effects.innerBorder = innerBorder;
  if (shadow) effects.shadow = shadow;
  if (innerShadow) effects.innerShadow = innerShadow;

  return { effects, savedStyles };
}

/**
 * Restore previously saved inline border and boxShadow styles.
 * If the saved value was empty string, this removes the inline override
 * and lets stylesheet rules reassert.
 */
export function restoreStyles(
  el: HTMLElement,
  saved: { border: string; boxShadow: string },
): void {
  el.style.border = saved.border;
  el.style.boxShadow = saved.boxShadow;
}
