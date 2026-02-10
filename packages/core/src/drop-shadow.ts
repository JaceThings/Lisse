import type { SmoothCornerOptions, ShadowConfig, CornerConfig } from "./types.js";
import { generatePath } from "./generate-path.js";
import { SVG_NS, nextUid, hexToRgb } from "./svg-shared.js";

export interface DropShadowHandle {
  update(options: SmoothCornerOptions, shadow: ShadowConfig, width: number, height: number): void;
  destroy(): void;
}

function adjustOptions(options: SmoothCornerOptions, spread: number): SmoothCornerOptions {
  if (spread === 0) return options;
  if ("radius" in options) {
    return {
      ...options,
      radius: Math.max(0, options.radius + spread),
    };
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
 * Creates a path-based drop shadow behind the anchor element.
 * Uses an actual squircle path (spread-adjusted) so the shadow
 * perfectly follows the smooth-corner shape at any spread value.
 * Blur is applied via feGaussianBlur on the path element.
 *
 * The shadow SVG is positioned at z-index:-1 inside the anchor's
 * stacking context (isolation:isolate).
 */
export function createDropShadow(anchor: HTMLElement): DropShadowHandle {
  const id = `sc-shadow-${nextUid()}`;

  anchor.style.isolation = "isolate";

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.style.cssText = "position:absolute;inset:0;overflow:visible;pointer-events:none;z-index:-1";

  const defs = document.createElementNS(SVG_NS, "defs");
  const filterEl = document.createElementNS(SVG_NS, "filter");
  filterEl.setAttribute("id", id);
  filterEl.setAttribute("x", "-200%");
  filterEl.setAttribute("y", "-200%");
  filterEl.setAttribute("width", "500%");
  filterEl.setAttribute("height", "500%");

  const feBlur = document.createElementNS(SVG_NS, "feGaussianBlur");
  feBlur.setAttribute("stdDeviation", "0");
  filterEl.appendChild(feBlur);

  defs.appendChild(filterEl);
  svg.appendChild(defs);

  const pathEl = document.createElementNS(SVG_NS, "path");
  svg.appendChild(pathEl);

  anchor.appendChild(svg);

  return {
    update(options, shadow, width, height) {
      if (shadow.opacity <= 0 || width <= 0 || height <= 0) {
        svg.style.display = "none";
        return;
      }

      const spread = shadow.spread;
      const sw = width + spread * 2;
      const sh = height + spread * 2;

      if (sw <= 0 || sh <= 0) {
        svg.style.display = "none";
        return;
      }

      svg.style.display = "";

      const adjusted = adjustOptions(options, spread);
      pathEl.setAttribute("d", generatePath(sw, sh, adjusted));
      pathEl.setAttribute("transform", `translate(${shadow.offsetX - spread},${shadow.offsetY - spread})`);
      pathEl.setAttribute("fill", hexToRgb(shadow.color));
      pathEl.setAttribute("fill-opacity", String(shadow.opacity));

      if (shadow.blur > 0) {
        feBlur.setAttribute("stdDeviation", String(shadow.blur));
        pathEl.setAttribute("filter", `url(#${id})`);
      } else {
        pathEl.removeAttribute("filter");
      }
    },
    destroy() {
      svg.remove();
    },
  };
}
