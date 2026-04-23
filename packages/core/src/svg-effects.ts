import { generatePath } from "./generate-path.js";
import type { SmoothCornerOptions, EffectsConfig, BorderConfig, ShadowConfig, GradientConfig } from "./types.js";
import { SVG_NS, nextUid, hexToRgb, darkenHex, adjustOptions, isGradient, createGradientDef, updateGradientDef, darkenGradient } from "./svg-shared.js";

export interface SvgEffectsHandle {
  update(options: SmoothCornerOptions, effects: EffectsConfig, width: number, height: number): void;
  destroy(): void;
}

/** Set x/y/width/height on an element to cover a `w`×`h` area expanded by `pad` on every side. */
function padBounds(el: Element, pad: number, w: number, h: number): void {
  el.setAttribute("x", String(-pad));
  el.setAttribute("y", String(-pad));
  el.setAttribute("width", String(w + pad * 2));
  el.setAttribute("height", String(h + pad * 2));
}

function createKnockoutMask(
  maskId: string,
  defs: Element,
  userSpaceOnUse: boolean,
): { mask: Element; rect: Element; knockout: Element } {
  const mask = document.createElementNS(SVG_NS, "mask");
  mask.setAttribute("id", maskId);
  if (userSpaceOnUse) mask.setAttribute("maskUnits", "userSpaceOnUse");
  const rect = document.createElementNS(SVG_NS, "rect");
  rect.setAttribute("fill", "white");
  const knockout = document.createElementNS(SVG_NS, "path");
  knockout.setAttribute("fill", "none");
  knockout.setAttribute("stroke", "black");
  mask.appendChild(rect);
  mask.appendChild(knockout);
  defs.appendChild(mask);
  return { mask, rect, knockout };
}

function createStrokeGroup(
  clipOrMask?: { attr: "clip-path" | "mask"; value: string },
): { group: SVGGElement; strokePath: SVGPathElement; grooveOverlay: SVGPathElement } {
  const group = document.createElementNS(SVG_NS, "g") as SVGGElement;
  const strokePath = document.createElementNS(SVG_NS, "path") as SVGPathElement;
  strokePath.setAttribute("fill", "none");
  if (clipOrMask) strokePath.setAttribute(clipOrMask.attr, clipOrMask.value);
  strokePath.style.display = "none";
  group.appendChild(strokePath);
  const grooveOverlay = document.createElementNS(SVG_NS, "path") as SVGPathElement;
  grooveOverlay.setAttribute("fill", "none");
  if (clipOrMask) grooveOverlay.setAttribute(clipOrMask.attr, clipOrMask.value);
  grooveOverlay.style.display = "none";
  group.appendChild(grooveOverlay);
  return { group, strokePath, grooveOverlay };
}

interface BorderElements {
  strokePath: SVGPathElement;
  grooveOverlay: SVGPathElement;
  strokeGroup: SVGGElement;
  dblMaskId: string;
  dblKnockout: Element;
  dblRect: Element;
  strokeMultiplier: number;
  padDblMask?: (pad: number, w: number, h: number) => void;
  /** Reference to the <defs> element for creating gradient defs. */
  defs: Element;
  /** Current gradient element for the main stroke (null when using a solid color). */
  gradientEl: Element | null;
  /** Unique ID for the main gradient def. */
  gradientId: string;
  /** Current gradient element for the groove/ridge overlay stroke. */
  overlayGradientEl: Element | null;
  /** Unique ID for the overlay gradient def. */
  overlayGradientId: string;
}

/** Remove a gradient def from the DOM and null out the reference. */
function removeGradient(els: BorderElements, which: "main" | "overlay"): void {
  const key = which === "main" ? "gradientEl" : "overlayGradientEl" as const;
  els[key]?.remove();
  els[key] = null;
}

/** Resolve the stroke color value: either a hex string or a `url(#id)` reference. */
function resolveStroke(
  color: string | GradientConfig,
  els: BorderElements,
  which: "main" | "overlay",
): string {
  if (!isGradient(color)) {
    removeGradient(els, which);
    return color;
  }
  const elKey = which === "main" ? "gradientEl" : "overlayGradientEl" as const;
  const id = which === "main" ? els.gradientId : els.overlayGradientId;
  if (els[elKey]) {
    updateGradientDef(els[elKey], color);
  } else {
    els[elKey] = createGradientDef(els.defs, color, id);
  }
  return `url(#${id})`;
}

function updateBorder(
  config: BorderConfig | undefined,
  d: string, width: number, height: number,
  els: BorderElements,
): void {
  if (!config || config.width <= 0 || config.opacity <= 0) {
    els.strokePath.style.display = "none";
    els.strokeGroup.removeAttribute("mask");
    els.grooveOverlay.style.display = "none";
    removeGradient(els, "main");
    removeGradient(els, "overlay");
    return;
  }

  const m = els.strokeMultiplier;
  els.strokePath.style.display = "";
  els.strokePath.setAttribute("d", d);
  els.strokePath.setAttribute("stroke", resolveStroke(config.color, els, "main"));
  els.strokePath.setAttribute("stroke-width", String(config.width * m));
  els.strokePath.setAttribute("stroke-opacity", String(config.opacity));

  const style = config.style ?? "solid";
  els.strokeGroup.removeAttribute("mask");
  els.grooveOverlay.style.display = "none";
  els.strokePath.removeAttribute("stroke-dasharray");
  els.strokePath.setAttribute("stroke-linecap", "butt");
  // Clean up overlay gradient for non-groove/ridge styles (will be re-created if needed)
  if (style !== "groove" && style !== "ridge") {
    removeGradient(els, "overlay");
  }

  switch (style) {
    case "dashed": {
      const dashLen = Math.max(0, config.dash ?? config.width * 3);
      const gapLen = Math.max(0, config.gap ?? config.width * 2);
      els.strokePath.setAttribute("stroke-dasharray", `${dashLen} ${gapLen}`);
      if (config.lineCap) els.strokePath.setAttribute("stroke-linecap", config.lineCap);
      break;
    }
    case "dotted": {
      const dotDash = Math.max(0, config.dash ?? 0);
      const dotGap = Math.max(0, config.gap ?? config.width * 2);
      els.strokePath.setAttribute("stroke-dasharray", `${dotDash} ${dotGap}`);
      els.strokePath.setAttribute("stroke-linecap", config.lineCap ?? "round");
      break;
    }
    case "double":
      if (config.width >= 3) {
        const third = Math.round(config.width / 3);
        els.dblKnockout.setAttribute("d", d);
        els.dblKnockout.setAttribute("stroke-width", String(third * m));
        els.dblRect.setAttribute("width", String(width));
        els.dblRect.setAttribute("height", String(height));
        if (els.padDblMask) els.padDblMask(config.width, width, height);
        els.strokeGroup.setAttribute("mask", `url(#${els.dblMaskId})`);
      }
      break;
    case "groove": {
      const grooveBase = isGradient(config.color) ? darkenGradient(config.color) : darkenHex(config.color);
      els.strokePath.setAttribute("stroke", resolveStroke(grooveBase, els, "main"));
      els.grooveOverlay.style.display = "";
      els.grooveOverlay.setAttribute("d", d);
      els.grooveOverlay.setAttribute("stroke", resolveStroke(config.color, els, "overlay"));
      els.grooveOverlay.setAttribute("stroke-width", String(config.width * m / 2));
      els.grooveOverlay.setAttribute("stroke-opacity", String(config.opacity));
      break;
    }
    case "ridge": {
      const ridgeDark = isGradient(config.color) ? darkenGradient(config.color) : darkenHex(config.color);
      els.grooveOverlay.style.display = "";
      els.grooveOverlay.setAttribute("d", d);
      els.grooveOverlay.setAttribute("stroke", resolveStroke(ridgeDark, els, "overlay"));
      els.grooveOverlay.setAttribute("stroke-width", String(config.width * m / 2));
      els.grooveOverlay.setAttribute("stroke-opacity", String(config.opacity));
      break;
    }
  }
}

/** Elements for a single inner shadow in the pool. */
interface InnerShadowEntry {
  maskId: string;
  mask: Element;
  maskRect: Element;
  maskCutout: Element;
  filterId: string;
  filter: Element;
  feBlur: Element;
  blurGroup: Element;
  rect: SVGRectElement;
}

function createInnerShadowEntry(defs: Element, clipGroup: Element): InnerShadowEntry {
  const uid = nextUid();
  const maskId = `sc-ishadow-mask-${uid}`;
  const mask = document.createElementNS(SVG_NS, "mask");
  mask.setAttribute("id", maskId);
  mask.setAttribute("maskUnits", "userSpaceOnUse");
  const maskRect = document.createElementNS(SVG_NS, "rect");
  maskRect.setAttribute("fill", "white");
  const maskCutout = document.createElementNS(SVG_NS, "path");
  maskCutout.setAttribute("fill", "black");
  mask.appendChild(maskRect);
  mask.appendChild(maskCutout);
  defs.appendChild(mask);

  const filterId = `sc-ishadow-blur-${uid}`;
  const filter = document.createElementNS(SVG_NS, "filter");
  filter.setAttribute("id", filterId);
  filter.setAttribute("x", "-200%");
  filter.setAttribute("y", "-200%");
  filter.setAttribute("width", "500%");
  filter.setAttribute("height", "500%");
  filter.setAttribute("color-interpolation-filters", "sRGB");
  const feBlur = document.createElementNS(SVG_NS, "feGaussianBlur");
  feBlur.setAttribute("stdDeviation", "0");
  filter.appendChild(feBlur);
  defs.appendChild(filter);

  const blurGroup = document.createElementNS(SVG_NS, "g");
  const rect = document.createElementNS(SVG_NS, "rect") as SVGRectElement;
  rect.setAttribute("mask", `url(#${maskId})`);
  rect.style.display = "none";
  blurGroup.appendChild(rect);
  clipGroup.appendChild(blurGroup);

  return { maskId, mask, maskRect, maskCutout, filterId, filter, feBlur, blurGroup, rect };
}

function removeInnerShadowEntry(entry: InnerShadowEntry): void {
  entry.mask.remove();
  entry.filter.remove();
  entry.blurGroup.remove();
}

/**
 * Creates an SVG overlay for inner/outer borders and inner shadow effects.
 * The SVG is appended to `anchor` and uses clip-path, mask, and filter elements
 * that are updated in sync with the smooth-corner path.
 */
export function createSvgEffects(anchor: HTMLElement): SvgEffectsHandle {
  const id = nextUid();
  const clipId = `sc-clip-${id}`;
  const maskId = `sc-mask-${id}`;

  // Root SVG
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.style.position = "absolute";
  svg.style.inset = "0";
  svg.style.pointerEvents = "none";
  svg.style.overflow = "visible";
  svg.style.zIndex = "1";
  svg.setAttribute("aria-hidden", "true");

  // Defs
  const defs = document.createElementNS(SVG_NS, "defs");

  // ClipPath (for inner border)
  const clipPathEl = document.createElementNS(SVG_NS, "clipPath");
  clipPathEl.setAttribute("id", clipId);
  const clipShape = document.createElementNS(SVG_NS, "path");
  clipPathEl.appendChild(clipShape);
  defs.appendChild(clipPathEl);

  // Mask (for outer border) — white rect + black shape = outer region
  const maskEl = document.createElementNS(SVG_NS, "mask");
  maskEl.setAttribute("id", maskId);
  maskEl.setAttribute("maskUnits", "userSpaceOnUse");
  const maskRect = document.createElementNS(SVG_NS, "rect");
  maskRect.setAttribute("fill", "white");
  const maskShape = document.createElementNS(SVG_NS, "path");
  maskShape.setAttribute("fill", "black");
  maskEl.appendChild(maskRect);
  maskEl.appendChild(maskShape);
  defs.appendChild(maskEl);

  // Double-knockout masks
  const innerDblMaskId = `sc-dbl-inner-${id}`;
  const { rect: innerDblRect, knockout: innerDblKnockout } =
    createKnockoutMask(innerDblMaskId, defs, false);

  const outerDblMaskId = `sc-dbl-outer-${id}`;
  const { mask: outerDblMask, rect: outerDblRect, knockout: outerDblKnockout } =
    createKnockoutMask(outerDblMaskId, defs, true);

  const middleDblMaskId = `sc-dbl-middle-${id}`;
  const { mask: middleDblMask, rect: middleDblRect, knockout: middleDblKnockout } =
    createKnockoutMask(middleDblMaskId, defs, true);

  svg.appendChild(defs);

  // Inner shadow rendering: shared <g clip-path> wrapper for all inner shadows
  const isShadowClip = document.createElementNS(SVG_NS, "g");
  isShadowClip.setAttribute("clip-path", `url(#${clipId})`);
  svg.appendChild(isShadowClip);

  // Pool of inner shadow entries
  const innerShadowPool: InnerShadowEntry[] = [];

  // Border stroke groups
  const { group: innerStrokeGroup, strokePath: innerStrokePath, grooveOverlay: innerGrooveOverlay } =
    createStrokeGroup({ attr: "clip-path", value: `url(#${clipId})` });
  svg.appendChild(innerStrokeGroup);

  const { group: outerStrokeGroup, strokePath: outerStrokePath, grooveOverlay: outerGrooveOverlay } =
    createStrokeGroup({ attr: "mask", value: `url(#${maskId})` });
  svg.appendChild(outerStrokeGroup);

  const { group: middleStrokeGroup, strokePath: middleStrokePath, grooveOverlay: middleGrooveOverlay } =
    createStrokeGroup();
  svg.appendChild(middleStrokeGroup);

  anchor.appendChild(svg);

  // Border element bags for the shared updateBorder function
  const innerBorderEls: BorderElements = {
    strokePath: innerStrokePath, grooveOverlay: innerGrooveOverlay,
    strokeGroup: innerStrokeGroup, dblMaskId: innerDblMaskId,
    dblKnockout: innerDblKnockout, dblRect: innerDblRect,
    strokeMultiplier: 2,
    defs, gradientEl: null, gradientId: `sc-grad-inner-${id}`,
    overlayGradientEl: null, overlayGradientId: `sc-grad-inner-ov-${id}`,
  };
  const outerBorderEls: BorderElements = {
    strokePath: outerStrokePath, grooveOverlay: outerGrooveOverlay,
    strokeGroup: outerStrokeGroup, dblMaskId: outerDblMaskId,
    dblKnockout: outerDblKnockout, dblRect: outerDblRect,
    strokeMultiplier: 2,
    defs, gradientEl: null, gradientId: `sc-grad-outer-${id}`,
    overlayGradientEl: null, overlayGradientId: `sc-grad-outer-ov-${id}`,
    padDblMask(pad, w, h) {
      padBounds(outerDblMask, pad, w, h);
      padBounds(outerDblRect, pad, w, h);
    },
  };
  const middleBorderEls: BorderElements = {
    strokePath: middleStrokePath, grooveOverlay: middleGrooveOverlay,
    strokeGroup: middleStrokeGroup, dblMaskId: middleDblMaskId,
    dblKnockout: middleDblKnockout, dblRect: middleDblRect,
    strokeMultiplier: 1,
    defs, gradientEl: null, gradientId: `sc-grad-middle-${id}`,
    overlayGradientEl: null, overlayGradientId: `sc-grad-middle-ov-${id}`,
    padDblMask(pad, w, h) {
      padBounds(middleDblMask, pad, w, h);
      padBounds(middleDblRect, pad, w, h);
    },
  };

  return {
    update(options, effects, width, height) {
      if (width <= 0 || height <= 0) return;

      svg.setAttribute("width", String(width));
      svg.setAttribute("height", String(height));
      svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

      const d = generatePath(width, height, options);

      // Update clip and mask paths
      clipShape.setAttribute("d", d);
      maskShape.setAttribute("d", d);
      maskRect.setAttribute("width", String(width));
      maskRect.setAttribute("height", String(height));

      // Inner border
      updateBorder(effects.innerBorder, d, width, height, innerBorderEls);

      // Outer border — extend main mask bounds before the border call
      const ob = effects.outerBorder;
      if (ob && ob.width > 0 && ob.opacity > 0) {
        padBounds(maskEl, ob.width, width, height);
        padBounds(maskRect, ob.width, width, height);
      }
      updateBorder(ob, d, width, height, outerBorderEls);

      // Middle border
      updateBorder(effects.middleBorder, d, width, height, middleBorderEls);

      // Inner shadows — normalize to array
      const rawIs = effects.innerShadow;
      const isArr: ShadowConfig[] = rawIs == null ? [] : Array.isArray(rawIs) ? rawIs : [rawIs];

      // Reconcile pool size
      while (innerShadowPool.length < isArr.length) {
        innerShadowPool.push(createInnerShadowEntry(defs, isShadowClip));
      }
      while (innerShadowPool.length > isArr.length) {
        removeInnerShadowEntry(innerShadowPool.pop()!);
      }

      for (let i = 0; i < isArr.length; i++) {
        const is = isArr[i];
        const entry = innerShadowPool[i];

        if (is.opacity <= 0) {
          entry.rect.style.display = "none";
          continue;
        }

        entry.rect.style.display = "";

        const spread = is.spread;
        const pad = Math.max(is.blur * 3, 20) + Math.max(Math.abs(is.offsetX), Math.abs(is.offsetY)) + Math.abs(spread);

        // Mask: white rect (visible) + black squircle cutout (hole)
        padBounds(entry.mask, pad, width, height);
        padBounds(entry.maskRect, pad, width, height);

        // Cutout path — adjusted for spread, offset for positioning
        const cutW = Math.max(1, width - spread * 2);
        const cutH = Math.max(1, height - spread * 2);
        const cutOpts = spread !== 0 ? adjustOptions(options, -spread) : options;
        entry.maskCutout.setAttribute("d", generatePath(cutW, cutH, cutOpts));
        entry.maskCutout.setAttribute("transform",
          `translate(${is.offsetX + spread},${is.offsetY + spread})`);

        // Blur
        if (is.blur > 0) {
          entry.feBlur.setAttribute("stdDeviation", String(is.blur));
          entry.blurGroup.setAttribute("filter", `url(#${entry.filterId})`);
        } else {
          entry.blurGroup.removeAttribute("filter");
        }

        // Shadow rect (covers full padded area, masked to frame shape)
        padBounds(entry.rect, pad, width, height);
        entry.rect.setAttribute("fill", hexToRgb(is.color));
        entry.rect.setAttribute("fill-opacity", String(is.opacity));
      }
    },
    destroy() {
      svg.remove();
    },
  };
}
