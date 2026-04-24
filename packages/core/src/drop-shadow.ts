import type { SmoothCornerOptions, ShadowConfig } from "./types.js";
import { generatePath } from "./generate-path.js";
import { SVG_NS, nextUid, hexToRgb, adjustOptions } from "./svg-shared.js";

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

function createShadowEntry(defs: Element, svg: Element): ShadowEntry {
  const filterId = `sc-shadow-${nextUid()}`;

  const filterEl = document.createElementNS(SVG_NS, "filter") as SVGFilterElement;
  filterEl.setAttribute("id", filterId);
  filterEl.setAttribute("x", "-200%");
  filterEl.setAttribute("y", "-200%");
  filterEl.setAttribute("width", "500%");
  filterEl.setAttribute("height", "500%");

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
 * Creates path-based drop shadows behind the anchor element.
 * Uses actual squircle paths (spread-adjusted) so shadows
 * perfectly follow the smooth-corner shape at any spread value.
 * Blur is applied via feGaussianBlur on each path element.
 *
 * Supports a single ShadowConfig or an array of ShadowConfigs.
 * First shadow in the array is topmost (rendered last in SVG).
 *
 * The shadow SVG is positioned at z-index:-1 inside the anchor's
 * stacking context (isolation:isolate).
 */
export function createDropShadow(anchor: HTMLElement): DropShadowHandle {
  // Save the prior inline value so destroy() can put it back. Setting
  // `isolation: isolate` unconditionally without restoring would leak the
  // inline style onto every anchor the library ever touches.
  const savedIsolation = anchor.style.isolation;
  anchor.style.isolation = "isolate";

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.style.cssText = "position:absolute;inset:0;overflow:visible;pointer-events:none;z-index:-1";
  svg.setAttribute("aria-hidden", "true");

  const defs = document.createElementNS(SVG_NS, "defs");
  svg.appendChild(defs);

  anchor.appendChild(svg);

  const pool: ShadowEntry[] = [];

  return {
    update(options, shadow, width, height) {
      const arr = Array.isArray(shadow) ? shadow : [shadow];

      // Check if all shadows are invisible
      const hasVisible = arr.some((s) => s.opacity > 0) && width > 0 && height > 0;
      if (!hasVisible) {
        svg.style.display = "none";
        return;
      }

      // Reconcile pool size
      while (pool.length < arr.length) {
        pool.push(createShadowEntry(defs, svg));
      }
      while (pool.length > arr.length) {
        removeShadowEntry(pool.pop()!);
      }

      // Per-dispatch memo for generatePath. Multiple shadows frequently share
      // (width, height, options) and only differ by spread, so we key on all
      // four to skip redundant distribute + per-corner math.
      const pathCache = new Map<string, string>();
      const optionsKey = JSON.stringify(options);
      const getPath = (
        w: number,
        h: number,
        opts: SmoothCornerOptions,
        spread: number,
      ): string => {
        const cacheKey = `${w}:${h}:${spread}:${optionsKey}`;
        let cached = pathCache.get(cacheKey);
        if (cached === undefined) {
          cached = generatePath(w, h, opts);
          pathCache.set(cacheKey, cached);
        }
        return cached;
      };

      // First shadow in array = topmost = rendered last in SVG (reverse index)
      let anyVisible = false;
      for (let i = 0; i < arr.length; i++) {
        const s = arr[i];
        const entry = pool[arr.length - 1 - i];

        if (s.opacity <= 0) {
          entry.pathEl.style.display = "none";
          continue;
        }

        const spread = s.spread;
        const sw = width + spread * 2;
        const sh = height + spread * 2;

        if (sw <= 0 || sh <= 0) {
          entry.pathEl.style.display = "none";
          continue;
        }

        anyVisible = true;
        entry.pathEl.style.display = "";

        const adjusted = adjustOptions(options, spread);
        entry.pathEl.setAttribute("d", getPath(sw, sh, adjusted, spread));
        entry.pathEl.setAttribute("transform", `translate(${s.offsetX - spread},${s.offsetY - spread})`);
        entry.pathEl.setAttribute("fill", hexToRgb(s.color));
        entry.pathEl.setAttribute("fill-opacity", String(s.opacity));

        if (s.blur > 0) {
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
