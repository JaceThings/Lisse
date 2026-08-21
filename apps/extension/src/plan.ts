import { generatePath, parseBoxShadow, DEFAULT_SMOOTHING } from "@lisse/core";

export interface CornerRadius {
  h: number;
  v: number;
}

export interface Radii {
  tl: number;
  tr: number;
  br: number;
  bl: number;
}

const EPS = 0.01;

export const MIN_RADIUS = 3;
export const MIN_SIZE = 8;
export const MIN_BORDER = 0.5;
export const MAX_BORDER = 6;
export const MAX_SHADOW_SPREAD = 4;

function resolveLen(token: string, basis: number): number {
  if (token.endsWith("%")) return (parseFloat(token) / 100) * basis;
  return parseFloat(token);
}

export function parseCornerRadius(raw: string, w: number, h: number): CornerRadius | null {
  if (!raw) return null;
  const tokens = raw.trim().split(/\s+/);
  const hv = resolveLen(tokens[0], w);
  const vv = tokens.length > 1 ? resolveLen(tokens[1], h) : resolveLen(tokens[0], h);
  if (isNaN(hv) || isNaN(vv)) return null;
  return { h: hv, v: vv };
}

export function isElliptical(c: CornerRadius): boolean {
  return Math.abs(c.h - c.v) > EPS;
}

export interface PseudoBox {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
}

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

export function isDefaultCorner(shorthand: string): boolean {
  return shorthand
    .trim()
    .split(/\s+/)
    .every((tok) => tok === "round" || tok === "superellipse(1)");
}

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

export interface BackgroundInput {
  image: string;
  origin: string;
  clip: string;
  repeat: string;
  size: string;
  position: string;
}

export interface PlanInput {
  width: number;
  height: number;
  radii: Radii;
  elliptical: boolean;
  border: BorderInput;
  hasBorderImage: boolean;
  background: BackgroundInput;
  paintsNothing: boolean;
  hasOutline: boolean;
  pseudoOutside: boolean;
  childOutside: boolean;
  boxShadow: string;
  existingFilter: string;
  smoothing: number;
  pageLeft?: number;
  pageTop?: number;
  dpr?: number;
}

export interface BorderLayer {
  backgroundImage: string;
  backgroundOrigin: string;
  backgroundClip: string;
  backgroundRepeat: string;
  backgroundSize: string;
  backgroundPosition: string;
  keepBorderColor?: boolean;
}

export type Plan =
  | { action: "skip"; reason: string }
  | { action: "apply"; clipPath: string; filter?: string; border?: BorderLayer; boxShadow?: string };

function hexToRgba(hex: string, opacity: number): string {
  if (!hex.startsWith("#")) return hex;
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

export function hasInsetShadow(raw: string): boolean {
  return (parseBoxShadow(raw).innerShadow?.length ?? 0) > 0;
}

export function boxShadowToFilter(raw: string): string | null | "skip" {
  const { shadow } = parseBoxShadow(raw);
  if (!shadow || shadow.length === 0) return null;
  const parts: string[] = [];
  for (const s of shadow) {
    if (Math.abs(s.spread) > MAX_SHADOW_SPREAD) return "skip";
    if (s.blur === 0 && s.spread !== 0) return "skip";
    const blur = Math.max(0, s.blur + s.spread);
    const color = hexToRgba(s.color, s.opacity);
    parts.push(`drop-shadow(${s.offsetX}px ${s.offsetY}px ${blur}px ${color})`);
  }
  return parts.join(" ");
}

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

function hasVisibleBorder(b: BorderInput): boolean {
  return [b.top, b.right, b.bottom, b.left].some((s) => s.width > EPS);
}

export interface StrokeGeometry {
  left: number;
  top: number;
  right: number;
  bottom: number;
  strokeWidth: number;
}

export function snapStroke(
  width: number,
  height: number,
  borderWidth: number,
  pageLeft?: number,
  pageTop?: number,
  dpr?: number,
): StrokeGeometry {
  if (pageLeft === undefined || pageTop === undefined || !dpr) {
    return { left: 0, top: 0, right: 0, bottom: 0, strokeWidth: borderWidth };
  }
  const strokeWidth = Math.max(1, Math.round(borderWidth * dpr)) / dpr;
  const near = (p: number) => Math.max(0, Math.floor(p * dpr + 0.5) / dpr - p);
  const far = (p: number) => Math.max(0, p - Math.ceil(p * dpr - 0.5) / dpr);
  const geom = {
    left: near(pageLeft),
    top: near(pageTop),
    right: far(pageLeft + width),
    bottom: far(pageTop + height),
    strokeWidth,
  };
  if (width - geom.left - geom.right <= strokeWidth ||
      height - geom.top - geom.bottom <= strokeWidth) {
    return { left: 0, top: 0, right: 0, bottom: 0, strokeWidth: borderWidth };
  }
  return geom;
}

function svgLayer(width: number, height: number, body: string, bg: BackgroundInput): BorderLayer {
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}' ` +
    `viewBox='0 0 ${width} ${height}' preserveAspectRatio='none'>${body}</svg>`;
  const url = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  const empty = bg.image === "none" || bg.image === "";
  const layer = (ours: string, existing: string) => (empty ? ours : `${ours}, ${existing}`);
  return {
    backgroundImage: empty ? url : `${url}, ${bg.image}`,
    backgroundOrigin: layer("border-box", bg.origin),
    backgroundClip: layer("border-box", bg.clip),
    backgroundRepeat: layer("no-repeat", bg.repeat),
    backgroundSize: layer("100% 100%", bg.size),
    backgroundPosition: layer("0% 0%", bg.position),
  };
}

function strokeGroup(d: string, x: number, y: number, strokeWidth: number, color: string): string {
  return `<g transform='translate(${x} ${y})'><path d='${d}' fill='none' stroke='${color}' stroke-width='${strokeWidth}'/></g>`;
}

export function borderStrokeLayer(
  d: string,
  width: number,
  height: number,
  x: number,
  y: number,
  strokeWidth: number,
  color: string,
  bg: BackgroundInput,
  extra = "",
): BorderLayer {
  return svgLayer(width, height, extra + strokeGroup(d, x, y, strokeWidth, color), bg);
}

export function computeElementPlan(input: PlanInput): Plan {
  if (input.elliptical) return { action: "skip", reason: "elliptical" };

  const { tl, tr, br, bl } = input.radii;
  const maxR = Math.max(tl, tr, br, bl);
  if (maxR < MIN_RADIUS) return { action: "skip", reason: "radius-too-small" };
  if (input.width < MIN_SIZE || input.height < MIN_SIZE) {
    return { action: "skip", reason: "too-small" };
  }
  if (input.hasBorderImage) return { action: "skip", reason: "border-image" };
  if (input.paintsNothing && !hasVisibleBorder(input.border)) {
    return { action: "skip", reason: "paints-nothing" };
  }
  if (input.hasOutline) return { action: "skip", reason: "outline" };
  if (input.pseudoOutside) return { action: "skip", reason: "pseudo-outside" };
  if (input.childOutside) return { action: "skip", reason: "child-outside" };

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

  const g = border
    ? snapStroke(
        input.width, input.height, border.width,
        input.pageLeft, input.pageTop, input.dpr,
      )
    : { left: 0, top: 0, right: 0, bottom: 0, strokeWidth: 0 };
  const insetAt = (inset: number) => {
    const w = input.width - g.left - g.right - inset * 2;
    const h = input.height - g.top - g.bottom - inset * 2;
    if (w <= 0 || h <= 0) return null;
    const rc = (r: number) => ({ radius: Math.max(0, r - inset), smoothing });
    return {
      d: generatePath(w, h, { topLeft: rc(tl), topRight: rc(tr), bottomRight: rc(br), bottomLeft: rc(bl) }),
      x: g.left + inset,
      y: g.top + inset,
    };
  };

  const inners = parseBoxShadow(input.boxShadow).innerShadow ?? [];
  let extra = "";
  for (const s of inners) {
    if (s.blur > EPS) return { action: "skip", reason: "inset-blur" };
    const ring = Math.abs(s.offsetX) < EPS && Math.abs(s.offsetY) < EPS && s.spread > EPS;
    const topHi = Math.abs(s.offsetX) < EPS && s.spread < EPS && s.offsetY > EPS && s.offsetY <= 2;
    if (!ring && !topHi) return { action: "skip", reason: "inset-shadow" };
    const band = ring ? s.spread : s.offsetY;
    const inner = insetAt(g.strokeWidth + band / 2);
    if (!inner) return { action: "skip", reason: "inset-shadow" };
    const color = hexToRgba(s.color, s.opacity);
    const group = strokeGroup(inner.d, inner.x, inner.y, band, color);
    extra += topHi
      ? `<defs><clipPath id="t"><rect width="${input.width}" height="${g.top + g.strokeWidth + maxR + band + 2}"/></clipPath></defs><g clip-path="url(#t)">${group}</g>`
      : group;
  }

  if (border) {
    const half = g.strokeWidth / 2;
    const inner = insetAt(half);
    if (inner) {
      plan.border = borderStrokeLayer(
        inner.d, input.width, input.height,
        inner.x, inner.y, g.strokeWidth,
        border.color, input.background, extra,
      );
    }
  } else if (extra) {
    plan.border = svgLayer(input.width, input.height, extra, input.background);
    plan.border.keepBorderColor = true;
  }
  if (extra) plan.boxShadow = "none";
  return plan;
}

export { DEFAULT_SMOOTHING };
