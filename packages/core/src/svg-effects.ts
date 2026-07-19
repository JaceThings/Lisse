import type { SmoothCornerOptions, EffectsConfig, BorderConfig, ShadowConfig } from "./types.js";
import { SVG_NS, nextUid, hexToRgb, adjustOptions, createPathCache } from "./svg-shared.js";

export interface SvgEffectsHandle {
  update(options: SmoothCornerOptions, effects: EffectsConfig, width: number, height: number): void;
  destroy(): void;
}

/** Set x/y/width/height on an element to cover a `w`×`h` area padded by `pad` on every side. */
function padBounds(el: Element, pad: number, w: number, h: number): void {
  el.setAttribute("x", String(-pad));
  el.setAttribute("y", String(-pad));
  el.setAttribute("width", String(w + pad * 2));
  el.setAttribute("height", String(h + pad * 2));
}

/** Apply `padBounds` to a mask and its inner rect together. */
function padMaskAndRect(mask: Element, rect: Element, pad: number, w: number, h: number): void {
  padBounds(mask, pad, w, h);
  padBounds(rect, pad, w, h);
}

function createStrokeGroup(
  clipOrMask?: { attr: "clip-path" | "mask"; value: string },
): { group: SVGGElement; strokePath: SVGPathElement } {
  const group = document.createElementNS(SVG_NS, "g") as SVGGElement;
  const strokePath = document.createElementNS(SVG_NS, "path") as SVGPathElement;
  strokePath.setAttribute("fill", "none");
  if (clipOrMask) strokePath.setAttribute(clipOrMask.attr, clipOrMask.value);
  strokePath.style.display = "none";
  group.appendChild(strokePath);
  return { group, strokePath };
}

interface BorderElements {
  strokePath: SVGPathElement;
  strokeMultiplier: number;
}

function updateBorder(
  config: BorderConfig | undefined,
  d: string,
  els: BorderElements,
): void {
  if (!config || config.width <= 0 || config.opacity <= 0) {
    els.strokePath.style.display = "none";
    return;
  }

  const m = els.strokeMultiplier;
  els.strokePath.style.display = "";
  els.strokePath.setAttribute("d", d);
  els.strokePath.setAttribute("stroke", config.color);
  els.strokePath.setAttribute("stroke-width", String(config.width * m));
  els.strokePath.setAttribute("stroke-opacity", String(config.opacity));

  const style = config.style ?? "solid";
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
  }
}

/** Pool entry for a single inner shadow. */
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
 * SVG overlay for inner/outer/middle borders and inner shadows.
 * Appended to `anchor`; clip-path, mask and filter elements update in sync
 * with the smooth-corner path on each `update()` call.
 */
export function createSvgEffects(anchor: HTMLElement): SvgEffectsHandle {
  const id = nextUid();
  const clipId = `sc-clip-${id}`;
  const maskId = `sc-mask-${id}`;

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.style.position = "absolute";
  svg.style.inset = "0";
  svg.style.pointerEvents = "none";
  svg.style.overflow = "visible";
  svg.style.zIndex = "1";
  svg.setAttribute("aria-hidden", "true");

  const defs = document.createElementNS(SVG_NS, "defs");

  // ClipPath for the inner border.
  const clipPathEl = document.createElementNS(SVG_NS, "clipPath");
  clipPathEl.setAttribute("id", clipId);
  const clipShape = document.createElementNS(SVG_NS, "path");
  clipPathEl.appendChild(clipShape);
  defs.appendChild(clipPathEl);

  // Outer-border mask: white rect minus black shape = outer region.
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

  svg.appendChild(defs);

  // Shared <g clip-path> wrapper for all inner shadows.
  const isShadowClip = document.createElementNS(SVG_NS, "g");
  isShadowClip.setAttribute("clip-path", `url(#${clipId})`);
  svg.appendChild(isShadowClip);

  const innerShadowPool: InnerShadowEntry[] = [];

  const { group: innerStrokeGroup, strokePath: innerStrokePath } =
    createStrokeGroup({ attr: "clip-path", value: `url(#${clipId})` });
  svg.appendChild(innerStrokeGroup);

  const { group: outerStrokeGroup, strokePath: outerStrokePath } =
    createStrokeGroup({ attr: "mask", value: `url(#${maskId})` });
  svg.appendChild(outerStrokeGroup);

  const { group: middleStrokeGroup, strokePath: middleStrokePath } =
    createStrokeGroup();
  svg.appendChild(middleStrokeGroup);

  anchor.appendChild(svg);

  const innerBorderEls: BorderElements = { strokePath: innerStrokePath, strokeMultiplier: 2 };
  const outerBorderEls: BorderElements = { strokePath: outerStrokePath, strokeMultiplier: 2 };
  const middleBorderEls: BorderElements = { strokePath: middleStrokePath, strokeMultiplier: 1 };

  return {
    update(options, effects, width, height) {
      if (width <= 0 || height <= 0) return;

      svg.setAttribute("width", String(width));
      svg.setAttribute("height", String(height));
      svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

      const getPath = createPathCache();
      const d = getPath(width, height, options, 0);

      clipShape.setAttribute("d", d);
      maskShape.setAttribute("d", d);
      maskRect.setAttribute("width", String(width));
      maskRect.setAttribute("height", String(height));

      updateBorder(effects.innerBorder, d, innerBorderEls);

      // Outer border needs an extended mask region before the border call.
      const ob = effects.outerBorder;
      if (ob && ob.width > 0 && ob.opacity > 0) {
        padMaskAndRect(maskEl, maskRect, ob.width, width, height);
      }
      updateBorder(ob, d, outerBorderEls);

      updateBorder(effects.middleBorder, d, middleBorderEls);

      const rawIs = effects.innerShadow;
      const isArr: ShadowConfig[] = rawIs == null ? [] : Array.isArray(rawIs) ? rawIs : [rawIs];

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

        // Mask: white rect (visible) + black squircle cutout (hole).
        padMaskAndRect(entry.mask, entry.maskRect, pad, width, height);

        const cutW = Math.max(1, width - spread * 2);
        const cutH = Math.max(1, height - spread * 2);
        const cutOpts = spread !== 0 ? adjustOptions(options, -spread) : options;
        entry.maskCutout.setAttribute("d", getPath(cutW, cutH, cutOpts, -spread));
        entry.maskCutout.setAttribute("transform",
          `translate(${is.offsetX + spread},${is.offsetY + spread})`);

        if (is.blur > 0) {
          entry.feBlur.setAttribute("stdDeviation", String(is.blur));
          entry.blurGroup.setAttribute("filter", `url(#${entry.filterId})`);
        } else {
          entry.blurGroup.removeAttribute("filter");
        }

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
