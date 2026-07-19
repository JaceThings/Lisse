import type { SmoothCornerOptions, ShadowConfig } from "./types.js";
import { SVG_NS, nextUid, hexToRgb, adjustOptions, createPathCache } from "./svg-shared.js";

export interface DropShadowHandle {
  update(options: SmoothCornerOptions, shadow: ShadowConfig | ShadowConfig[], width: number, height: number): void;
  destroy(): void;
}

interface ShadowEntry {
  filterId: string;
  filterEl: SVGFilterElement;
  feBlur: SVGFEGaussianBlurElement;
  pathEl: SVGPathElement;
}

/**
 * Pad a filter region by `3 * blur + |spread| + 1` px on every side:
 * `3 * blur` covers the 3σ Gaussian tail (~99.7%), `|spread|` covers
 * path expansion, `+1` keeps the kernel edge from clipping on a
 * sub-pixel boundary.
 */
function computeFilterPad(blur: number, spread: number): number {
  return Math.ceil(3 * blur + Math.abs(spread) + 1);
}

/**
 * Write a tightly-fitted filter region in user-space (px) coordinates.
 * Pairs with `filterUnits="userSpaceOnUse"` — default objectBoundingBox
 * units force percentage regions, which Safari rounds in ways that
 * amplify a WebKit SVG-filter rasterisation bias. Chromium-identical.
 */
function setFilterRegionUserSpace(
  filterEl: SVGFilterElement,
  shadowWidth: number,
  shadowHeight: number,
  pad: number,
): void {
  filterEl.setAttribute("x", String(-pad));
  filterEl.setAttribute("y", String(-pad));
  filterEl.setAttribute("width", String(shadowWidth + 2 * pad));
  filterEl.setAttribute("height", String(shadowHeight + 2 * pad));
}

function createShadowEntry(defs: Element, svg: Element): ShadowEntry {
  const filterId = `sc-shadow-${nextUid()}`;

  const filterEl = document.createElementNS(SVG_NS, "filter") as SVGFilterElement;
  filterEl.setAttribute("id", filterId);
  filterEl.setAttribute("filterUnits", "userSpaceOnUse");
  // Without explicit sRGB some UAs pick linearRGB and the blur tint drifts.
  filterEl.setAttribute("color-interpolation-filters", "sRGB");

  const feBlur = document.createElementNS(SVG_NS, "feGaussianBlur") as SVGFEGaussianBlurElement;
  feBlur.setAttribute("stdDeviation", "0");
  filterEl.appendChild(feBlur);
  defs.appendChild(filterEl);

  const pathEl = document.createElementNS(SVG_NS, "path") as SVGPathElement;
  svg.appendChild(pathEl);

  return { filterId, filterEl, feBlur, pathEl };
}

function removeShadowEntry(entry: ShadowEntry): void {
  entry.filterEl.remove();
  entry.pathEl.remove();
}

/**
 * Path-based drop shadows behind the anchor. Uses spread-adjusted squircle
 * paths so the shadow follows the smooth-corner silhouette at any spread.
 * Accepts a single ShadowConfig or an array; first entry renders topmost.
 * The SVG sits at z-index:-1 inside the anchor's `isolation:isolate`
 * stacking context.
 */
export function createDropShadow(anchor: HTMLElement): DropShadowHandle {
  // Save the prior inline value so destroy() can restore it — setting
  // `isolation: isolate` unconditionally would otherwise leak.
  const savedIsolation = anchor.style.isolation;
  anchor.style.isolation = "isolate";

  const svg = document.createElementNS(SVG_NS, "svg") as SVGSVGElement;
  svg.style.cssText = "position:absolute;inset:0;overflow:visible;pointer-events:none;z-index:-1";
  // SVG is a replaced element; without explicit width/height attributes
  // it falls back to the 300×150 intrinsic default, which overflows
  // narrower anchors (e.g. ~110 px toggle pills on mobile) and forces
  // horizontal scroll. `100%` stretches the canvas to fill the anchor.
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  svg.setAttribute("aria-hidden", "true");

  const defs = document.createElementNS(SVG_NS, "defs");
  svg.appendChild(defs);

  anchor.appendChild(svg);

  const pool: ShadowEntry[] = [];

  return {
    update(options, shadow, width, height) {
      const arr = Array.isArray(shadow) ? shadow : [shadow];

      const hasVisible = width > 0 && height > 0 && arr.some((s) => s.opacity > 0);
      if (!hasVisible) {
        svg.style.display = "none";
        return;
      }

      while (pool.length < arr.length) pool.push(createShadowEntry(defs, svg));
      while (pool.length > arr.length) removeShadowEntry(pool.pop()!);

      const getPath = createPathCache();

      // First entry = topmost = rendered last in SVG.
      let anyVisible = false;
      for (let i = 0; i < arr.length; i++) {
        const s = arr[i];
        const entry = pool[arr.length - 1 - i];

        if (s.opacity <= 0) {
          entry.pathEl.style.display = "none";
          continue;
        }

        const spread = s.spread;
        const shadowWidth = width + spread * 2;
        const shadowHeight = height + spread * 2;

        if (shadowWidth <= 0 || shadowHeight <= 0) {
          entry.pathEl.style.display = "none";
          continue;
        }

        anyVisible = true;
        entry.pathEl.style.display = "";

        const colour = hexToRgb(s.color);

        const adjusted = adjustOptions(options, spread);
        entry.pathEl.setAttribute("d", getPath(shadowWidth, shadowHeight, adjusted, spread));
        entry.pathEl.setAttribute("transform", `translate(${s.offsetX - spread},${s.offsetY - spread})`);
        entry.pathEl.setAttribute("fill", colour);
        entry.pathEl.setAttribute("fill-opacity", String(s.opacity));

        if (s.blur > 0) {
          const pad = computeFilterPad(s.blur, spread);
          setFilterRegionUserSpace(entry.filterEl, shadowWidth, shadowHeight, pad);
          entry.feBlur.setAttribute("stdDeviation", String(s.blur));
          entry.pathEl.setAttribute("filter", `url(#${entry.filterId})`);
        } else {
          entry.pathEl.removeAttribute("filter");
        }
      }

      svg.style.display = anyVisible ? "" : "none";
    },
    destroy() {
      svg.remove();
      anchor.style.isolation = savedIsolation;
    },
  };
}
