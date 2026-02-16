import { generatePath } from "./generate-path.js";
import type { SmoothCornerOptions, EffectsConfig, BorderConfig } from "./types.js";
import { SVG_NS, nextUid, hexToRgb, darkenHex, adjustOptions } from "./svg-shared.js";

export interface SvgEffectsHandle {
  update(options: SmoothCornerOptions, effects: EffectsConfig, width: number, height: number): void;
  destroy(): void;
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
    return;
  }

  const m = els.strokeMultiplier;
  els.strokePath.style.display = "";
  els.strokePath.setAttribute("d", d);
  els.strokePath.setAttribute("stroke", config.color);
  els.strokePath.setAttribute("stroke-width", String(config.width * m));
  els.strokePath.setAttribute("stroke-opacity", String(config.opacity));

  const style = config.style ?? "solid";
  els.strokeGroup.removeAttribute("mask");
  els.grooveOverlay.style.display = "none";
  els.strokePath.removeAttribute("stroke-dasharray");
  els.strokePath.setAttribute("stroke-linecap", "butt");

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
    case "groove":
      els.strokePath.setAttribute("stroke", darkenHex(config.color));
      els.grooveOverlay.style.display = "";
      els.grooveOverlay.setAttribute("d", d);
      els.grooveOverlay.setAttribute("stroke", config.color);
      els.grooveOverlay.setAttribute("stroke-width", String(config.width * m / 2));
      els.grooveOverlay.setAttribute("stroke-opacity", String(config.opacity));
      break;
    case "ridge":
      els.grooveOverlay.style.display = "";
      els.grooveOverlay.setAttribute("d", d);
      els.grooveOverlay.setAttribute("stroke", darkenHex(config.color));
      els.grooveOverlay.setAttribute("stroke-width", String(config.width * m / 2));
      els.grooveOverlay.setAttribute("stroke-opacity", String(config.opacity));
      break;
  }
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

  // Inner shadow — mask-based approach (rect with squircle cutout, blur, clip)
  const isMaskId = `sc-ishadow-mask-${id}`;
  const isMask = document.createElementNS(SVG_NS, "mask");
  isMask.setAttribute("id", isMaskId);
  isMask.setAttribute("maskUnits", "userSpaceOnUse");
  const isMaskRect = document.createElementNS(SVG_NS, "rect");
  isMaskRect.setAttribute("fill", "white");
  const isMaskCutout = document.createElementNS(SVG_NS, "path");
  isMaskCutout.setAttribute("fill", "black");
  isMask.appendChild(isMaskRect);
  isMask.appendChild(isMaskCutout);
  defs.appendChild(isMask);

  const isFilterId = `sc-ishadow-blur-${id}`;
  const isFilter = document.createElementNS(SVG_NS, "filter");
  isFilter.setAttribute("id", isFilterId);
  isFilter.setAttribute("x", "-200%");
  isFilter.setAttribute("y", "-200%");
  isFilter.setAttribute("width", "500%");
  isFilter.setAttribute("height", "500%");
  isFilter.setAttribute("color-interpolation-filters", "sRGB");
  const isBlur = document.createElementNS(SVG_NS, "feGaussianBlur");
  isBlur.setAttribute("stdDeviation", "0");
  isFilter.appendChild(isBlur);
  defs.appendChild(isFilter);

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

  // Inner shadow rendering: <g clip-path> → <g filter> → <rect mask>
  const isShadowClip = document.createElementNS(SVG_NS, "g");
  isShadowClip.setAttribute("clip-path", `url(#${clipId})`);
  const isShadowBlur = document.createElementNS(SVG_NS, "g");
  const isShadowRect = document.createElementNS(SVG_NS, "rect");
  isShadowRect.setAttribute("mask", `url(#${isMaskId})`);
  isShadowRect.style.display = "none";
  isShadowBlur.appendChild(isShadowRect);
  isShadowClip.appendChild(isShadowBlur);
  svg.appendChild(isShadowClip);

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
  };
  const outerBorderEls: BorderElements = {
    strokePath: outerStrokePath, grooveOverlay: outerGrooveOverlay,
    strokeGroup: outerStrokeGroup, dblMaskId: outerDblMaskId,
    dblKnockout: outerDblKnockout, dblRect: outerDblRect,
    strokeMultiplier: 2,
    padDblMask(pad, w, h) {
      outerDblMask.setAttribute("x", String(-pad));
      outerDblMask.setAttribute("y", String(-pad));
      outerDblMask.setAttribute("width", String(w + pad * 2));
      outerDblMask.setAttribute("height", String(h + pad * 2));
      outerDblRect.setAttribute("x", String(-pad));
      outerDblRect.setAttribute("y", String(-pad));
      outerDblRect.setAttribute("width", String(w + pad * 2));
      outerDblRect.setAttribute("height", String(h + pad * 2));
    },
  };
  const middleBorderEls: BorderElements = {
    strokePath: middleStrokePath, grooveOverlay: middleGrooveOverlay,
    strokeGroup: middleStrokeGroup, dblMaskId: middleDblMaskId,
    dblKnockout: middleDblKnockout, dblRect: middleDblRect,
    strokeMultiplier: 1,
    padDblMask(pad, w, h) {
      middleDblMask.setAttribute("x", String(-pad));
      middleDblMask.setAttribute("y", String(-pad));
      middleDblMask.setAttribute("width", String(w + pad * 2));
      middleDblMask.setAttribute("height", String(h + pad * 2));
      middleDblRect.setAttribute("x", String(-pad));
      middleDblRect.setAttribute("y", String(-pad));
      middleDblRect.setAttribute("width", String(w + pad * 2));
      middleDblRect.setAttribute("height", String(h + pad * 2));
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
        const pad = ob.width;
        maskEl.setAttribute("x", String(-pad));
        maskEl.setAttribute("y", String(-pad));
        maskEl.setAttribute("width", String(width + pad * 2));
        maskEl.setAttribute("height", String(height + pad * 2));
        maskRect.setAttribute("x", String(-pad));
        maskRect.setAttribute("y", String(-pad));
        maskRect.setAttribute("width", String(width + pad * 2));
        maskRect.setAttribute("height", String(height + pad * 2));
      }
      updateBorder(ob, d, width, height, outerBorderEls);

      // Middle border
      updateBorder(effects.middleBorder, d, width, height, middleBorderEls);

      // Inner shadow
      const is = effects.innerShadow;
      if (is && is.opacity > 0) {
        isShadowRect.style.display = "";

        const spread = is.spread;
        const pad = Math.max(is.blur * 3, 20) + Math.max(Math.abs(is.offsetX), Math.abs(is.offsetY)) + Math.abs(spread);

        // Mask: white rect (visible) + black squircle cutout (hole)
        isMask.setAttribute("x", String(-pad));
        isMask.setAttribute("y", String(-pad));
        isMask.setAttribute("width", String(width + pad * 2));
        isMask.setAttribute("height", String(height + pad * 2));
        isMaskRect.setAttribute("x", String(-pad));
        isMaskRect.setAttribute("y", String(-pad));
        isMaskRect.setAttribute("width", String(width + pad * 2));
        isMaskRect.setAttribute("height", String(height + pad * 2));

        // Cutout path — adjusted for spread, offset for positioning
        const cutW = Math.max(1, width - spread * 2);
        const cutH = Math.max(1, height - spread * 2);
        const cutOpts = spread !== 0 ? adjustOptions(options, -spread) : options;
        isMaskCutout.setAttribute("d", generatePath(cutW, cutH, cutOpts));
        isMaskCutout.setAttribute("transform",
          `translate(${is.offsetX + spread},${is.offsetY + spread})`);

        // Blur
        if (is.blur > 0) {
          isBlur.setAttribute("stdDeviation", String(is.blur));
          isShadowBlur.setAttribute("filter", `url(#${isFilterId})`);
        } else {
          isShadowBlur.removeAttribute("filter");
        }

        // Shadow rect (covers full padded area, masked to frame shape)
        isShadowRect.setAttribute("x", String(-pad));
        isShadowRect.setAttribute("y", String(-pad));
        isShadowRect.setAttribute("width", String(width + pad * 2));
        isShadowRect.setAttribute("height", String(height + pad * 2));
        isShadowRect.setAttribute("fill", hexToRgb(is.color));
        isShadowRect.setAttribute("fill-opacity", String(is.opacity));
      } else {
        isShadowRect.style.display = "none";
      }
    },
    destroy() {
      svg.remove();
    },
  };
}
