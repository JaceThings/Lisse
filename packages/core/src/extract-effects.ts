import type { BorderConfig, BorderStyle, ShadowConfig, EffectsConfig } from "./types.js";

export interface ExtractedEffects {
  effects: EffectsConfig;
  savedStyles: {
    border: string;
    boxShadow: string;
    paddingTop: string;
    paddingRight: string;
    paddingBottom: string;
    paddingLeft: string;
  };
}

/**
 * Parse an rgb/rgba color (as returned by getComputedStyle) to hex + opacity.
 * Accepts legacy comma form `rgb(255, 0, 0)` and CSS Color L4 space form
 * `rgb(255 0 0 / 0.5)`. Returns undefined for unrecognised input.
 */
export function parseColor(raw: string): { hex: string; opacity: number } | undefined {
  const match = raw.match(
    /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/,
  );
  if (!match) return undefined;
  const r = Number(match[1]);
  const g = Number(match[2]);
  const b = Number(match[3]);
  const a = match[4] !== undefined ? Number(match[4]) : 1;
  const hex = "#" + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  return { hex, opacity: a };
}

// `[^()]` rather than `[^)]`: an unclosed `color(` would otherwise rescan to
// the end of the string from every position. Computed colours never nest.
const COLOR_FN = /(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\([^()]+\)/;
const TRAILING_ALPHA = /\/\s*([\d.]+%?)\s*\)$/;

/**
 * Colours `parseColor` can't decode keep their raw CSS string instead of being
 * clipped into hex, so the browser resolves them at full gamut and the alpha
 * embedded in the string isn't applied a second time on top of `opacity`.
 */
function resolvePaint(raw: string): { color: string; opacity: number } | undefined {
  const parsed = parseColor(raw);
  if (parsed) return parsed.opacity > 0 ? { color: parsed.hex, opacity: parsed.opacity } : undefined;
  if (COLOR_FN.exec(raw)?.[0] !== raw) return undefined;
  const alpha = raw.match(TRAILING_ALPHA)?.[1];
  return alpha && parseFloat(alpha) === 0 ? undefined : { color: raw, opacity: 1 };
}

/** The computed-style fields `parseBorder` reads. */
export type BorderStyleSource = Pick<
  CSSStyleDeclaration,
  "borderTopStyle" | "borderTopWidth" | "borderTopColor"
>;

/**
 * Read the computed border from an element as a BorderConfig.
 * Returns undefined when the border is effectively invisible (none/hidden,
 * width 0, or transparent).
 *
 * Pass a pre-read `cs` to reuse an existing `getComputedStyle` result (its
 * values must be snapshotted before any layout-dirtying write — computed
 * style is live); omit it and the element's computed style is read here.
 */
export function parseBorder(
  el: HTMLElement,
  cs: BorderStyleSource = getComputedStyle(el),
): BorderConfig | undefined {
  const style = cs.borderTopStyle;
  if (style === "none" || style === "hidden") return undefined;

  const width = parseFloat(cs.borderTopWidth);
  if (width <= 0 || isNaN(width)) return undefined;

  const color = resolvePaint(cs.borderTopColor);
  if (!color) return undefined;

  // "solid" is the default and stays implicit; only non-solid supported
  // styles are carried through. Anything else (inset/outset/…) is dropped.
  const nonSolid: Record<string, BorderStyle> = {
    dashed: "dashed", dotted: "dotted", double: "double", groove: "groove", ridge: "ridge",
  };
  const borderStyle = nonSolid[style];

  return {
    width,
    color: color.color,
    opacity: color.opacity,
    ...(borderStyle ? { style: borderStyle } : {}),
  };
}

/**
 * Parse a computed box-shadow string into outer and inset shadow arrays,
 * preserving CSS order within each group.
 */
export function parseBoxShadow(raw: string): {
  shadow?: ShadowConfig[];
  innerShadow?: ShadowConfig[];
} {
  if (!raw || raw === "none") return {};

  // Split on commas outside parentheses (rgb/rgba contain commas).
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

  const shadows: ShadowConfig[] = [];
  const innerShadows: ShadowConfig[] = [];

  for (const part of parts) {
    const isInset = part.includes("inset");
    const cleaned = part.replace("inset", "").trim();

    const colorMatch = cleaned.match(COLOR_FN);
    if (!colorMatch) continue;
    const paint = resolvePaint(colorMatch[0]);
    if (!paint) continue;

    const rest = cleaned.replace(colorMatch[0], "").trim();
    const values = rest.split(/\s+/).map(parseFloat).filter((v) => !isNaN(v));
    if (values.length < 2) continue;

    const config: ShadowConfig = {
      offsetX: values[0],
      offsetY: values[1],
      blur: values[2] ?? 0,
      spread: values[3] ?? 0,
      ...paint,
    };
    (isInset ? innerShadows : shadows).push(config);
  }

  return {
    shadow: shadows.length > 0 ? shadows : undefined,
    innerShadow: innerShadows.length > 0 ? innerShadows : undefined,
  };
}

/**
 * Extract CSS border and box-shadow from an element, strip them inline, and
 * return equivalent EffectsConfig values plus the saved styles needed to
 * restore the original inline state.
 */
export function extractAndStripEffects(el: HTMLElement): ExtractedEffects {
  const savedStyles = {
    border: el.style.border,
    boxShadow: el.style.boxShadow,
    paddingTop: el.style.paddingTop,
    paddingRight: el.style.paddingRight,
    paddingBottom: el.style.paddingBottom,
    paddingLeft: el.style.paddingLeft,
  };

  // ONE getComputedStyle for the whole element. Computed style is live, so
  // every value we need is snapshotted into plain strings/numbers here,
  // BEFORE the first layout-dirtying write below — including the fields
  // parseBorder needs, which are handed to it rather than re-read.
  const cs = getComputedStyle(el);
  const borderStyleSource: BorderStyleSource = {
    borderTopStyle: cs.borderTopStyle,
    borderTopWidth: cs.borderTopWidth,
    borderTopColor: cs.borderTopColor,
  };
  const boxShadow = cs.boxShadow;
  const boxSizing = cs.boxSizing;
  const borderTopW = parseFloat(cs.borderTopWidth) || 0;
  const borderRightW = parseFloat(cs.borderRightWidth) || 0;
  const borderBottomW = parseFloat(cs.borderBottomWidth) || 0;
  const borderLeftW = parseFloat(cs.borderLeftWidth) || 0;
  const paddingTop = parseFloat(cs.paddingTop) || 0;
  const paddingRight = parseFloat(cs.paddingRight) || 0;
  const paddingBottom = parseFloat(cs.paddingBottom) || 0;
  const paddingLeft = parseFloat(cs.paddingLeft) || 0;

  const innerBorder = parseBorder(el, borderStyleSource);
  const { shadow, innerShadow } = parseBoxShadow(boxShadow);

  // Only strip what we successfully parsed. Wiping unparseable values
  // (currentcolor, oklch(), border-image, ...) without an SVG replacement
  // would silently lose them.
  if (innerBorder) el.style.border = "0";
  if (shadow || innerShadow) el.style.boxShadow = "none";

  // Compensate content-box padding so stripping the border doesn't shift
  // layout. Keyed on `innerBorder` so we only shift when the border was
  // actually parsed and stripped.
  if (
    innerBorder &&
    boxSizing === "content-box" &&
    (borderTopW > 0 || borderRightW > 0 || borderBottomW > 0 || borderLeftW > 0)
  ) {
    el.style.paddingTop = (paddingTop + borderTopW) + "px";
    el.style.paddingRight = (paddingRight + borderRightW) + "px";
    el.style.paddingBottom = (paddingBottom + borderBottomW) + "px";
    el.style.paddingLeft = (paddingLeft + borderLeftW) + "px";
  }

  const effects: EffectsConfig = {};
  if (innerBorder) effects.innerBorder = innerBorder;
  if (shadow) effects.shadow = shadow;
  if (innerShadow) effects.innerShadow = innerShadow;

  return { effects, savedStyles };
}

/** True when `config` defines any renderable effect. */
export function hasEffects(config: EffectsConfig | undefined | null): boolean {
  if (!config) return false;
  return !!(
    config.innerBorder ||
    config.outerBorder ||
    config.middleBorder ||
    config.innerShadow ||
    config.shadow
  );
}

/** Merge auto-extracted and explicit effects; explicit wins per key. */
export function mergeEffects(
  extracted: ExtractedEffects | undefined,
  explicit: EffectsConfig | undefined,
): EffectsConfig {
  return { ...extracted?.effects, ...explicit };
}

/**
 * Restore previously saved inline border/boxShadow/padding styles. An empty
 * saved value clears the inline override so stylesheet rules can reassert.
 */
export function restoreStyles(
  el: HTMLElement,
  saved: ExtractedEffects["savedStyles"],
): void {
  el.style.border = saved.border;
  el.style.boxShadow = saved.boxShadow;
  el.style.paddingTop = saved.paddingTop;
  el.style.paddingRight = saved.paddingRight;
  el.style.paddingBottom = saved.paddingBottom;
  el.style.paddingLeft = saved.paddingLeft;
}
