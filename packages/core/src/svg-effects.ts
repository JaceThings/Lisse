import { generatePath } from "./generate-path.js";
import type { SmoothCornerOptions, EffectsConfig } from "./types.js";

const SVG_NS = "http://www.w3.org/2000/svg";
let uid = 0;

export interface SvgEffectsHandle {
  update(options: SmoothCornerOptions, effects: EffectsConfig, width: number, height: number): void;
  destroy(): void;
}

function hexToRgb(hex: string): string {
  const h = hex.replace("#", "");
  return `rgb(${parseInt(h.substring(0, 2), 16)},${parseInt(h.substring(2, 4), 16)},${parseInt(h.substring(4, 6), 16)})`;
}

export function createSvgEffects(anchor: HTMLElement): SvgEffectsHandle {
  const id = ++uid;
  const clipId = `sc-clip-${id}`;
  const maskId = `sc-mask-${id}`;
  const filterId = `sc-inner-shadow-${id}`;

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
  const maskRect = document.createElementNS(SVG_NS, "rect");
  maskRect.setAttribute("fill", "white");
  const maskShape = document.createElementNS(SVG_NS, "path");
  maskShape.setAttribute("fill", "black");
  maskEl.appendChild(maskRect);
  maskEl.appendChild(maskShape);
  defs.appendChild(maskEl);

  // Inner shadow filter
  const filterEl = document.createElementNS(SVG_NS, "filter");
  filterEl.setAttribute("id", filterId);
  filterEl.setAttribute("x", "-100%");
  filterEl.setAttribute("y", "-100%");
  filterEl.setAttribute("width", "400%");
  filterEl.setAttribute("height", "400%");

  // feComponentTransfer: invert SourceAlpha
  const feTransfer = document.createElementNS(SVG_NS, "feComponentTransfer");
  feTransfer.setAttribute("in", "SourceAlpha");
  feTransfer.setAttribute("result", "inverted");
  const feFuncA = document.createElementNS(SVG_NS, "feFuncA");
  feFuncA.setAttribute("type", "linear");
  feFuncA.setAttribute("slope", "-1");
  feFuncA.setAttribute("intercept", "1");
  feTransfer.appendChild(feFuncA);
  filterEl.appendChild(feTransfer);

  const feMorph = document.createElementNS(SVG_NS, "feMorphology");
  feMorph.setAttribute("in", "inverted");
  feMorph.setAttribute("operator", "dilate");
  feMorph.setAttribute("radius", "0");
  feMorph.setAttribute("result", "spread");
  filterEl.appendChild(feMorph);

  const feBlur = document.createElementNS(SVG_NS, "feGaussianBlur");
  feBlur.setAttribute("in", "spread");
  feBlur.setAttribute("stdDeviation", "0");
  feBlur.setAttribute("result", "blur");
  filterEl.appendChild(feBlur);

  const feOffset = document.createElementNS(SVG_NS, "feOffset");
  feOffset.setAttribute("in", "blur");
  feOffset.setAttribute("dx", "0");
  feOffset.setAttribute("dy", "0");
  feOffset.setAttribute("result", "offset");
  filterEl.appendChild(feOffset);

  const feFlood = document.createElementNS(SVG_NS, "feFlood");
  feFlood.setAttribute("flood-color", "#000");
  feFlood.setAttribute("flood-opacity", "0.5");
  feFlood.setAttribute("result", "color");
  filterEl.appendChild(feFlood);

  const feCompIn = document.createElementNS(SVG_NS, "feComposite");
  feCompIn.setAttribute("in", "color");
  feCompIn.setAttribute("in2", "offset");
  feCompIn.setAttribute("operator", "in");
  feCompIn.setAttribute("result", "shadow");
  filterEl.appendChild(feCompIn);

  const feCompClip = document.createElementNS(SVG_NS, "feComposite");
  feCompClip.setAttribute("in", "shadow");
  feCompClip.setAttribute("in2", "SourceAlpha");
  feCompClip.setAttribute("operator", "in");
  filterEl.appendChild(feCompClip);

  defs.appendChild(filterEl);
  svg.appendChild(defs);

  // Inner shadow path
  const innerShadowPath = document.createElementNS(SVG_NS, "path");
  innerShadowPath.setAttribute("fill", "black");
  innerShadowPath.setAttribute("filter", `url(#${filterId})`);
  innerShadowPath.style.display = "none";
  svg.appendChild(innerShadowPath);

  // Inner border stroke path
  const innerStrokePath = document.createElementNS(SVG_NS, "path");
  innerStrokePath.setAttribute("fill", "none");
  innerStrokePath.setAttribute("clip-path", `url(#${clipId})`);
  innerStrokePath.style.display = "none";
  svg.appendChild(innerStrokePath);

  // Outer border stroke path
  const outerStrokePath = document.createElementNS(SVG_NS, "path");
  outerStrokePath.setAttribute("fill", "none");
  outerStrokePath.setAttribute("mask", `url(#${maskId})`);
  outerStrokePath.style.display = "none";
  svg.appendChild(outerStrokePath);

  anchor.appendChild(svg);

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
      const ib = effects.innerBorder;
      if (ib && ib.width > 0 && ib.opacity > 0) {
        innerStrokePath.style.display = "";
        innerStrokePath.setAttribute("d", d);
        innerStrokePath.setAttribute("stroke", ib.color);
        innerStrokePath.setAttribute("stroke-width", String(ib.width * 2));
        innerStrokePath.setAttribute("stroke-opacity", String(ib.opacity));
      } else {
        innerStrokePath.style.display = "none";
      }

      // Outer border
      const ob = effects.outerBorder;
      if (ob && ob.width > 0 && ob.opacity > 0) {
        outerStrokePath.style.display = "";
        outerStrokePath.setAttribute("d", d);
        outerStrokePath.setAttribute("stroke", ob.color);
        outerStrokePath.setAttribute("stroke-width", String(ob.width * 2));
        outerStrokePath.setAttribute("stroke-opacity", String(ob.opacity));
      } else {
        outerStrokePath.style.display = "none";
      }

      // Inner shadow
      const is = effects.innerShadow;
      if (is && is.opacity > 0) {
        innerShadowPath.style.display = "";
        innerShadowPath.setAttribute("d", d);

        feMorph.setAttribute("operator", is.spread >= 0 ? "dilate" : "erode");
        feMorph.setAttribute("radius", String(Math.abs(is.spread)));
        feBlur.setAttribute("stdDeviation", String(is.blur));
        feOffset.setAttribute("dx", String(is.offsetX));
        feOffset.setAttribute("dy", String(is.offsetY));
        feFlood.setAttribute("flood-color", hexToRgb(is.color));
        feFlood.setAttribute("flood-opacity", String(is.opacity));
      } else {
        innerShadowPath.style.display = "none";
      }
    },
    destroy() {
      svg.remove();
    },
  };
}
