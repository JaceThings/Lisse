import { generatePath, parseBoxShadow, DEFAULT_SMOOTHING } from "@lisse/core";

/** A single corner's resolved horizontal + vertical radius, in px. */
export interface CornerRadius {
  h: number;
  v: number;
}

/** Four circular corner radii, in px. */
export interface Radii {
  tl: number;
  tr: number;
  br: number;
  bl: number;
}

const EPS = 0.01;

/** Min radius worth smoothing — below this the curve is imperceptible. */
export const MIN_RADIUS = 3;
/** Elements smaller than this in either axis are skipped. */
export const MIN_SIZE = 8;
/** Uniform solid borders in this px range get a stroked-SVG smooth border. */
export const MIN_BORDER = 0.5;
export const MAX_BORDER = 6;
/** Beyond this, drop-shadow can't approximate the spread well enough. */
export const MAX_SHADOW_SPREAD = 4;

/**
 * Resolve one length token from a computed corner radius. Percentages resolve
 * against `basis` (the box axis the token measures along); everything else is
 * a px length. Returns NaN for unparseable tokens.
 */
function resolveLen(token: string, basis: number): number {
  if (token.endsWith("%")) return (parseFloat(token) / 100) * basis;
  return parseFloat(token);
}

/**
 * Parse a computed `border-*-radius` (e.g. `"10px"`, `"50%"`, `"10px 20px"`)
 * into horizontal + vertical components. `w`/`h` are the box axes the two
 * tokens resolve against. Returns null when unparseable.
 */
export function parseCornerRadius(raw: string, w: number, h: number): CornerRadius | null {
  if (!raw) return null;
  const tokens = raw.trim().split(/\s+/);
  const hv = resolveLen(tokens[0], w);
  const vv = tokens.length > 1 ? resolveLen(tokens[1], h) : resolveLen(tokens[0], h);
  if (isNaN(hv) || isNaN(vv)) return null;
  return { h: hv, v: vv };
}

/** A corner is elliptical when its two radii differ — Lisse can't render it. */
export function isElliptical(c: CornerRadius): boolean {
  return Math.abs(c.h - c.v) > EPS;
}

export interface PseudoBox {
  top: number;
  right: number;
  bottom: number;
  left: number;
  /** Pseudo's own computed size; NaN when auto. */
  width: number;
  height: number;
}

/**
 * Whether an absolutely-positioned pseudo-element escapes the box — clip-path
 * clips pseudos with the element, so smoothing would amputate it. Catches
 * negative insets (underlines at `bottom: -9px`) and far-edge escapes via
 * positive offsets (underlines at `top: 38px` on a 32px-tall tab). NaN (auto)
 * values are ignored where the geometry can't be resolved.
 */
export function pseudoEscapesBox(o: PseudoBox, box: { width: number; height: number }): boolean {
  if ([o.top, o.right, o.bottom, o.left].some((v) => !isNaN(v) && v < -EPS)) return true;
  if (!isNaN(o.height)) {
    const top = !isNaN(o.top) ? o.top : !isNaN(o.bottom) ? box.height - o.bottom - o.height : NaN;
    if (!isNaN(top) && (top < -EPS || top + o.height > box.height + EPS)) return true;
  }
  if (!isNaN(o.width)) {
    const left = !isNaN(o.left) ? o.left : !isNaN(o.right) ? box.width - o.right - o.width : NaN;
    if (!isNaN(left) && (left < -EPS || left + o.width > box.width + EPS)) return true;
  }
  return false;
}

/** One side's resolved border longhands (computed values). */
export interface BorderSide {
  width: number;
  style: string;
  color: string;
}

export interface BorderInput {
  top: BorderSide;
  right: BorderSide;
  bottom: BorderSide;
  left: BorderSide;
}

/**
 * Site-original computed background longhands, as comma-lists matching the
 * layer count. Our stroked border prepends one layer to each.
 */
export interface BackgroundInput {
  image: string;
  origin: string;
  clip: string;
  repeat: string;
  size: string;
}

export interface PlanInput {
  /** Computed box size in px (float — never offsetWidth). */
  width: number;
  height: number;
  radii: Radii;
  /** Any corner elliptical → whole element is skipped. */
  elliptical: boolean;
  /** Per-side border longhands; used to detect a uniform solid border. */
  border: BorderInput;
  hasBorderImage: boolean;
  /** Site-original background longhands the border layer prepends onto. */
  background: BackgroundInput;
  /** A visible outline (focus ring) paints outside the box → clip kills it. */
  hasOutline: boolean;
  /** A ::before/::after escapes the box → clipping would amputate it. */
  pseudoOutside: boolean;
  /** A visible child escapes the box (avatar stacks, badges) → same. */
  childOutside: boolean;
  /** Raw computed `box-shadow`. */
  boxShadow: string;
  /** Existing computed `filter` to preserve (drop-shadows prepend to it). */
  existingFilter: string;
  smoothing: number;
}

/**
 * Layered background longhands that redraw a uniform border as a stroked SVG.
 * The engine also sets `border-color: transparent` whenever this is present.
 */
export interface BorderLayer {
  backgroundImage: string;
  backgroundOrigin: string;
  backgroundClip: string;
  backgroundRepeat: string;
  backgroundSize: string;
}

export type Plan =
  | { action: "skip"; reason: string }
  | { action: "apply"; clipPath: string; filter?: string; border?: BorderLayer };

function hexToRgba(hex: string, opacity: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/**
 * Convert outer box-shadows to an equivalent `drop-shadow()` filter chain.
 * drop-shadow has no spread, so spread is folded into the blur. Returns null
 * when there's nothing to convert, or "skip" when a spread is too large to
 * approximate faithfully.
 */
export function boxShadowToFilter(raw: string): string | null | "skip" {
  const { shadow } = parseBoxShadow(raw);
  if (!shadow || shadow.length === 0) return null;
  const parts: string[] = [];
  for (const s of shadow) {
    if (Math.abs(s.spread) > MAX_SHADOW_SPREAD) return "skip";
    // A spread-only ring (0 0 0 Npx — avatar "borders") has no drop-shadow
    // equivalent; folding it into blur turns a crisp ring invisible.
    if (s.blur === 0 && s.spread !== 0) return "skip";
    const blur = Math.max(0, s.blur + s.spread);
    const color = hexToRgba(s.color, s.opacity);
    parts.push(`drop-shadow(${s.offsetX}px ${s.offsetY}px ${blur}px ${color})`);
  }
  return parts.join(" ");
}

/**
 * A uniform solid border, or null. All four sides must share the same width
 * (0.5–6px), the `solid` style, and the same colour — otherwise the clip would
 * render the border thin/uneven, so the caller skips the element instead.
 */
export function uniformSolidBorder(b: BorderInput): { width: number; color: string } | null {
  const { top, right, bottom, left } = b;
  const w = top.width;
  if (w < MIN_BORDER || w > MAX_BORDER) return null;
  for (const s of [top, right, bottom, left]) {
    if (s.style !== "solid") return null;
    if (Math.abs(s.width - w) > EPS) return null;
    if (s.color !== top.color) return null;
  }
  return { width: w, color: top.color };
}

/** True when any side paints a visible border (computed width > 0). */
function hasVisibleBorder(b: BorderInput): boolean {
  return [b.top, b.right, b.bottom, b.left].some((s) => s.width > EPS);
}

/**
 * Redraw a uniform border as a background layer: a stroked SVG of the smooth
 * path at `stroke-width = 2 × width`. The clip-path removes the outer half,
 * leaving a correct-width inner stroke. Our layer is prepended (painted on top)
 * to the element's existing background layers, keeping each longhand a matching
 * comma-list so the pre-existing layers retain their own values.
 */
export function borderStrokeLayer(
  d: string,
  width: number,
  height: number,
  strokeWidth: number,
  color: string,
  bg: BackgroundInput,
): BorderLayer {
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}' ` +
    `viewBox='0 0 ${width} ${height}' preserveAspectRatio='none'>` +
    `<path d='${d}' fill='none' stroke='${color}' stroke-width='${strokeWidth * 2}'/></svg>`;
  const url = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  const empty = bg.image === "none" || bg.image === "";
  const layer = (ours: string, existing: string) => (empty ? ours : `${ours}, ${existing}`);
  return {
    backgroundImage: empty ? url : `${url}, ${bg.image}`,
    backgroundOrigin: layer("border-box", bg.origin),
    backgroundClip: layer("border-box", bg.clip),
    backgroundRepeat: layer("no-repeat", bg.repeat),
    backgroundSize: layer("100% 100%", bg.size),
  };
}

/**
 * Decide what to do with one element from its resolved computed values.
 * Correctness over coverage — when in doubt, skip.
 */
export function computeElementPlan(input: PlanInput): Plan {
  if (input.elliptical) return { action: "skip", reason: "elliptical" };

  const { tl, tr, br, bl } = input.radii;
  const maxR = Math.max(tl, tr, br, bl);
  if (maxR < MIN_RADIUS) return { action: "skip", reason: "radius-too-small" };
  if (input.width < MIN_SIZE || input.height < MIN_SIZE) {
    return { action: "skip", reason: "too-small" };
  }
  if (input.hasBorderImage) return { action: "skip", reason: "border-image" };
  // Focus rings are outlines; clipping them away is an accessibility bug.
  if (input.hasOutline) return { action: "skip", reason: "outline" };
  if (input.pseudoOutside) return { action: "skip", reason: "pseudo-outside" };
  if (input.childOutside) return { action: "skip", reason: "child-outside" };

  // A visible border must be a clean uniform solid, else the corners degrade.
  let border: { width: number; color: string } | null = null;
  if (hasVisibleBorder(input.border)) {
    border = uniformSolidBorder(input.border);
    if (!border) return { action: "skip", reason: "non-uniform-border" };
  }

  const smoothing = input.smoothing;
  const d = generatePath(input.width, input.height, {
    topLeft: { radius: tl, smoothing },
    topRight: { radius: tr, smoothing },
    bottomRight: { radius: br, smoothing },
    bottomLeft: { radius: bl, smoothing },
  });
  const clipPath = `path("${d}")`;

  const shadowFilter = boxShadowToFilter(input.boxShadow);
  if (shadowFilter === "skip") return { action: "skip", reason: "shadow-spread" };

  let filter: string | undefined;
  if (shadowFilter) {
    filter = input.existingFilter && input.existingFilter !== "none"
      ? `${shadowFilter} ${input.existingFilter}`
      : shadowFilter;
  }

  const plan: Plan = { action: "apply", clipPath };
  if (filter) plan.filter = filter;
  if (border) {
    plan.border = borderStrokeLayer(d, input.width, input.height, border.width, border.color, input.background);
  }
  return plan;
}

export { DEFAULT_SMOOTHING };
