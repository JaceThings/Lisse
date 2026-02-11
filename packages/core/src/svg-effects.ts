import { generatePath } from "./generate-path.js";
import type { SmoothCornerOptions, EffectsConfig } from "./types.js";
import { SVG_NS, nextUid, hexToRgb, darkenHex } from "./svg-shared.js";

export interface SvgEffectsHandle {
  update(options: SmoothCornerOptions, effects: EffectsConfig, width: number, height: number): void;
  destroy(): void;
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

  // Inner border stroke path (wrapped in <g> for double border masking)
  const innerStrokeGroup = document.createElementNS(SVG_NS, "g");
  const innerStrokePath = document.createElementNS(SVG_NS, "path");
  innerStrokePath.setAttribute("fill", "none");
  innerStrokePath.setAttribute("clip-path", `url(#${clipId})`);
  innerStrokePath.style.display = "none";
  innerStrokeGroup.appendChild(innerStrokePath);

  // Inner groove/ridge overlay
  const innerGrooveOverlay = document.createElementNS(SVG_NS, "path");
  innerGrooveOverlay.setAttribute("fill", "none");
  innerGrooveOverlay.setAttribute("clip-path", `url(#${clipId})`);
  innerGrooveOverlay.style.display = "none";
  innerStrokeGroup.appendChild(innerGrooveOverlay);

  svg.appendChild(innerStrokeGroup);

  // Outer border stroke path (wrapped in <g> for double border masking)
  const outerStrokeGroup = document.createElementNS(SVG_NS, "g");
  const outerStrokePath = document.createElementNS(SVG_NS, "path");
  outerStrokePath.setAttribute("fill", "none");
  outerStrokePath.setAttribute("mask", `url(#${maskId})`);
  outerStrokePath.style.display = "none";
  outerStrokeGroup.appendChild(outerStrokePath);

  // Outer groove/ridge overlay
  const outerGrooveOverlay = document.createElementNS(SVG_NS, "path");
  outerGrooveOverlay.setAttribute("fill", "none");
  outerGrooveOverlay.setAttribute("mask", `url(#${maskId})`);
  outerGrooveOverlay.style.display = "none";
  outerStrokeGroup.appendChild(outerGrooveOverlay);

  svg.appendChild(outerStrokeGroup);

  // Double-knockout masks (punch out middle third for double borders)
  const innerDblMaskId = `sc-dbl-inner-${id}`;
  const innerDblMask = document.createElementNS(SVG_NS, "mask");
  innerDblMask.setAttribute("id", innerDblMaskId);
  const innerDblRect = document.createElementNS(SVG_NS, "rect");
  innerDblRect.setAttribute("fill", "white");
  const innerDblKnockout = document.createElementNS(SVG_NS, "path");
  innerDblKnockout.setAttribute("fill", "none");
  innerDblKnockout.setAttribute("stroke", "black");
  innerDblMask.appendChild(innerDblRect);
  innerDblMask.appendChild(innerDblKnockout);
  defs.appendChild(innerDblMask);

  const outerDblMaskId = `sc-dbl-outer-${id}`;
  const outerDblMask = document.createElementNS(SVG_NS, "mask");
  outerDblMask.setAttribute("id", outerDblMaskId);
  const outerDblRect = document.createElementNS(SVG_NS, "rect");
  outerDblRect.setAttribute("fill", "white");
  const outerDblKnockout = document.createElementNS(SVG_NS, "path");
  outerDblKnockout.setAttribute("fill", "none");
  outerDblKnockout.setAttribute("stroke", "black");
  outerDblMask.appendChild(outerDblRect);
  outerDblMask.appendChild(outerDblKnockout);
  defs.appendChild(outerDblMask);

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

        // Border style handling
        const ibStyle = ib.style ?? "solid";
        innerStrokeGroup.removeAttribute("mask");
        innerGrooveOverlay.style.display = "none";
        innerStrokePath.removeAttribute("stroke-dasharray");
        innerStrokePath.setAttribute("stroke-linecap", "butt");

        switch (ibStyle) {
          case "dashed":
            innerStrokePath.setAttribute("stroke-dasharray", `${ib.width * 3} ${ib.width * 2}`);
            break;
          case "dotted":
            innerStrokePath.setAttribute("stroke-dasharray", `0 ${ib.width * 2}`);
            innerStrokePath.setAttribute("stroke-linecap", "round");
            break;
          case "double":
            if (ib.width >= 3) {
              const third = Math.round(ib.width / 3);
              innerDblKnockout.setAttribute("d", d);
              innerDblKnockout.setAttribute("stroke-width", String(third * 2));
              innerDblRect.setAttribute("width", String(width));
              innerDblRect.setAttribute("height", String(height));
              innerStrokeGroup.setAttribute("mask", `url(#${innerDblMaskId})`);
            }
            break;
          case "groove":
            innerStrokePath.setAttribute("stroke", darkenHex(ib.color));
            innerGrooveOverlay.style.display = "";
            innerGrooveOverlay.setAttribute("d", d);
            innerGrooveOverlay.setAttribute("stroke", ib.color);
            innerGrooveOverlay.setAttribute("stroke-width", String(ib.width));
            innerGrooveOverlay.setAttribute("stroke-opacity", String(ib.opacity));
            break;
          case "ridge":
            innerGrooveOverlay.style.display = "";
            innerGrooveOverlay.setAttribute("d", d);
            innerGrooveOverlay.setAttribute("stroke", darkenHex(ib.color));
            innerGrooveOverlay.setAttribute("stroke-width", String(ib.width));
            innerGrooveOverlay.setAttribute("stroke-opacity", String(ib.opacity));
            break;
        }
      } else {
        innerStrokePath.style.display = "none";
        innerStrokeGroup.removeAttribute("mask");
        innerGrooveOverlay.style.display = "none";
      }

      // Outer border
      const ob = effects.outerBorder;
      if (ob && ob.width > 0 && ob.opacity > 0) {
        outerStrokePath.style.display = "";
        outerStrokePath.setAttribute("d", d);
        outerStrokePath.setAttribute("stroke", ob.color);
        outerStrokePath.setAttribute("stroke-width", String(ob.width * 2));
        outerStrokePath.setAttribute("stroke-opacity", String(ob.opacity));

        // Extend mask rect to cover the outer stroke area beyond content bounds
        const pad = ob.width;
        maskRect.setAttribute("x", String(-pad));
        maskRect.setAttribute("y", String(-pad));
        maskRect.setAttribute("width", String(width + pad * 2));
        maskRect.setAttribute("height", String(height + pad * 2));

        // Border style handling
        const obStyle = ob.style ?? "solid";
        outerStrokeGroup.removeAttribute("mask");
        outerGrooveOverlay.style.display = "none";
        outerStrokePath.removeAttribute("stroke-dasharray");
        outerStrokePath.setAttribute("stroke-linecap", "butt");

        switch (obStyle) {
          case "dashed":
            outerStrokePath.setAttribute("stroke-dasharray", `${ob.width * 3} ${ob.width * 2}`);
            break;
          case "dotted":
            outerStrokePath.setAttribute("stroke-dasharray", `0 ${ob.width * 2}`);
            outerStrokePath.setAttribute("stroke-linecap", "round");
            break;
          case "double":
            if (ob.width >= 3) {
              const third = Math.round(ob.width / 3);
              outerDblKnockout.setAttribute("d", d);
              outerDblKnockout.setAttribute("stroke-width", String(third * 2));
              outerDblRect.setAttribute("x", String(-pad));
              outerDblRect.setAttribute("y", String(-pad));
              outerDblRect.setAttribute("width", String(width + pad * 2));
              outerDblRect.setAttribute("height", String(height + pad * 2));
              outerStrokeGroup.setAttribute("mask", `url(#${outerDblMaskId})`);
            }
            break;
          case "groove":
            outerStrokePath.setAttribute("stroke", darkenHex(ob.color));
            outerGrooveOverlay.style.display = "";
            outerGrooveOverlay.setAttribute("d", d);
            outerGrooveOverlay.setAttribute("stroke", ob.color);
            outerGrooveOverlay.setAttribute("stroke-width", String(ob.width));
            outerGrooveOverlay.setAttribute("stroke-opacity", String(ob.opacity));
            break;
          case "ridge":
            outerGrooveOverlay.style.display = "";
            outerGrooveOverlay.setAttribute("d", d);
            outerGrooveOverlay.setAttribute("stroke", darkenHex(ob.color));
            outerGrooveOverlay.setAttribute("stroke-width", String(ob.width));
            outerGrooveOverlay.setAttribute("stroke-opacity", String(ob.opacity));
            break;
        }
      } else {
        outerStrokePath.style.display = "none";
        outerStrokeGroup.removeAttribute("mask");
        outerGrooveOverlay.style.display = "none";
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
