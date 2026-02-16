import { generatePath } from "./generate-path.js";
import type { SmoothCornerOptions, EffectsConfig, CornerConfig } from "./types.js";
import { SVG_NS, nextUid, hexToRgb, darkenHex } from "./svg-shared.js";

export interface SvgEffectsHandle {
  update(options: SmoothCornerOptions, effects: EffectsConfig, width: number, height: number): void;
  destroy(): void;
}

function adjustOptions(options: SmoothCornerOptions, spread: number): SmoothCornerOptions {
  if (spread === 0) return options;
  if ("radius" in options) {
    return { ...options, radius: Math.max(0, options.radius + spread) };
  }
  const adjust = (v: CornerConfig | number | undefined): CornerConfig | number | undefined => {
    if (v === undefined) return undefined;
    if (typeof v === "number") return Math.max(0, v + spread);
    return { ...v, radius: Math.max(0, v.radius + spread) };
  };
  return {
    topLeft: adjust(options.topLeft),
    topRight: adjust(options.topRight),
    bottomRight: adjust(options.bottomRight),
    bottomLeft: adjust(options.bottomLeft),
  };
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
  // Uses the same geometric path technique as the drop shadow for pixel-perfect
  // shape fidelity. Avoids the alpha-inversion filter chain which causes
  // anti-aliasing artifacts, radius tightening, and zoom-dependent rendering issues.
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

  // Middle border stroke path (wrapped in <g> for double border masking)
  const middleStrokeGroup = document.createElementNS(SVG_NS, "g");
  const middleStrokePath = document.createElementNS(SVG_NS, "path");
  middleStrokePath.setAttribute("fill", "none");
  middleStrokePath.style.display = "none";
  middleStrokeGroup.appendChild(middleStrokePath);

  // Middle groove/ridge overlay
  const middleGrooveOverlay = document.createElementNS(SVG_NS, "path");
  middleGrooveOverlay.setAttribute("fill", "none");
  middleGrooveOverlay.style.display = "none";
  middleStrokeGroup.appendChild(middleGrooveOverlay);

  svg.appendChild(middleStrokeGroup);

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
  outerDblMask.setAttribute("maskUnits", "userSpaceOnUse");
  const outerDblRect = document.createElementNS(SVG_NS, "rect");
  outerDblRect.setAttribute("fill", "white");
  const outerDblKnockout = document.createElementNS(SVG_NS, "path");
  outerDblKnockout.setAttribute("fill", "none");
  outerDblKnockout.setAttribute("stroke", "black");
  outerDblMask.appendChild(outerDblRect);
  outerDblMask.appendChild(outerDblKnockout);
  defs.appendChild(outerDblMask);

  const middleDblMaskId = `sc-dbl-middle-${id}`;
  const middleDblMask = document.createElementNS(SVG_NS, "mask");
  middleDblMask.setAttribute("id", middleDblMaskId);
  middleDblMask.setAttribute("maskUnits", "userSpaceOnUse");
  const middleDblRect = document.createElementNS(SVG_NS, "rect");
  middleDblRect.setAttribute("fill", "white");
  const middleDblKnockout = document.createElementNS(SVG_NS, "path");
  middleDblKnockout.setAttribute("fill", "none");
  middleDblKnockout.setAttribute("stroke", "black");
  middleDblMask.appendChild(middleDblRect);
  middleDblMask.appendChild(middleDblKnockout);
  defs.appendChild(middleDblMask);

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
          case "dashed": {
            const dashLen = Math.max(0, ib.dash ?? ib.width * 3);
            const gapLen = Math.max(0, ib.gap ?? ib.width * 2);
            innerStrokePath.setAttribute("stroke-dasharray", `${dashLen} ${gapLen}`);
            if (ib.lineCap) innerStrokePath.setAttribute("stroke-linecap", ib.lineCap);
            break;
          }
          case "dotted": {
            const dotDash = Math.max(0, ib.dash ?? 0);
            const dotGap = Math.max(0, ib.gap ?? ib.width * 2);
            innerStrokePath.setAttribute("stroke-dasharray", `${dotDash} ${dotGap}`);
            innerStrokePath.setAttribute("stroke-linecap", ib.lineCap ?? "round");
            break;
          }
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

        // Extend mask to cover the outer stroke area beyond content bounds
        const pad = ob.width;
        maskEl.setAttribute("x", String(-pad));
        maskEl.setAttribute("y", String(-pad));
        maskEl.setAttribute("width", String(width + pad * 2));
        maskEl.setAttribute("height", String(height + pad * 2));
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
          case "dashed": {
            const dashLen = Math.max(0, ob.dash ?? ob.width * 3);
            const gapLen = Math.max(0, ob.gap ?? ob.width * 2);
            outerStrokePath.setAttribute("stroke-dasharray", `${dashLen} ${gapLen}`);
            if (ob.lineCap) outerStrokePath.setAttribute("stroke-linecap", ob.lineCap);
            break;
          }
          case "dotted": {
            const dotDash = Math.max(0, ob.dash ?? 0);
            const dotGap = Math.max(0, ob.gap ?? ob.width * 2);
            outerStrokePath.setAttribute("stroke-dasharray", `${dotDash} ${dotGap}`);
            outerStrokePath.setAttribute("stroke-linecap", ob.lineCap ?? "round");
            break;
          }
          case "double":
            if (ob.width >= 3) {
              const third = Math.round(ob.width / 3);
              outerDblKnockout.setAttribute("d", d);
              outerDblKnockout.setAttribute("stroke-width", String(third * 2));
              outerDblMask.setAttribute("x", String(-pad));
              outerDblMask.setAttribute("y", String(-pad));
              outerDblMask.setAttribute("width", String(width + pad * 2));
              outerDblMask.setAttribute("height", String(height + pad * 2));
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

      // Middle border
      const mb = effects.middleBorder;
      if (mb && mb.width > 0 && mb.opacity > 0) {
        middleStrokePath.style.display = "";
        middleStrokePath.setAttribute("d", d);
        middleStrokePath.setAttribute("stroke", mb.color);
        middleStrokePath.setAttribute("stroke-width", String(mb.width));
        middleStrokePath.setAttribute("stroke-opacity", String(mb.opacity));

        // Border style handling
        const mbStyle = mb.style ?? "solid";
        middleStrokeGroup.removeAttribute("mask");
        middleGrooveOverlay.style.display = "none";
        middleStrokePath.removeAttribute("stroke-dasharray");
        middleStrokePath.setAttribute("stroke-linecap", "butt");

        switch (mbStyle) {
          case "dashed": {
            const dashLen = Math.max(0, mb.dash ?? mb.width * 3);
            const gapLen = Math.max(0, mb.gap ?? mb.width * 2);
            middleStrokePath.setAttribute("stroke-dasharray", `${dashLen} ${gapLen}`);
            if (mb.lineCap) middleStrokePath.setAttribute("stroke-linecap", mb.lineCap);
            break;
          }
          case "dotted": {
            const dotDash = Math.max(0, mb.dash ?? 0);
            const dotGap = Math.max(0, mb.gap ?? mb.width * 2);
            middleStrokePath.setAttribute("stroke-dasharray", `${dotDash} ${dotGap}`);
            middleStrokePath.setAttribute("stroke-linecap", mb.lineCap ?? "round");
            break;
          }
          case "double":
            if (mb.width >= 3) {
              const third = Math.round(mb.width / 3);
              middleDblKnockout.setAttribute("d", d);
              middleDblKnockout.setAttribute("stroke-width", String(third));
              const pad = mb.width;
              middleDblMask.setAttribute("x", String(-pad));
              middleDblMask.setAttribute("y", String(-pad));
              middleDblMask.setAttribute("width", String(width + pad * 2));
              middleDblMask.setAttribute("height", String(height + pad * 2));
              middleDblRect.setAttribute("x", String(-pad));
              middleDblRect.setAttribute("y", String(-pad));
              middleDblRect.setAttribute("width", String(width + pad * 2));
              middleDblRect.setAttribute("height", String(height + pad * 2));
              middleStrokeGroup.setAttribute("mask", `url(#${middleDblMaskId})`);
            }
            break;
          case "groove":
            middleStrokePath.setAttribute("stroke", darkenHex(mb.color));
            middleGrooveOverlay.style.display = "";
            middleGrooveOverlay.setAttribute("d", d);
            middleGrooveOverlay.setAttribute("stroke", mb.color);
            middleGrooveOverlay.setAttribute("stroke-width", String(mb.width / 2));
            middleGrooveOverlay.setAttribute("stroke-opacity", String(mb.opacity));
            break;
          case "ridge":
            middleGrooveOverlay.style.display = "";
            middleGrooveOverlay.setAttribute("d", d);
            middleGrooveOverlay.setAttribute("stroke", darkenHex(mb.color));
            middleGrooveOverlay.setAttribute("stroke-width", String(mb.width / 2));
            middleGrooveOverlay.setAttribute("stroke-opacity", String(mb.opacity));
            break;
        }
      } else {
        middleStrokePath.style.display = "none";
        middleStrokeGroup.removeAttribute("mask");
        middleGrooveOverlay.style.display = "none";
      }

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
