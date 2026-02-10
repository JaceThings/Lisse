import type { ShadowConfig } from "./types.js";

const SVG_NS = "http://www.w3.org/2000/svg";
let uid = 0;

export interface DropShadowHandle {
  update(shadow: ShadowConfig): string;
  destroy(): void;
}

function hexToRgb(hex: string): string {
  const h = hex.replace("#", "");
  return `rgb(${parseInt(h.substring(0, 2), 16)},${parseInt(h.substring(2, 4), 16)},${parseInt(h.substring(4, 6), 16)})`;
}

export function createDropShadow(anchor: HTMLElement): DropShadowHandle {
  const id = `sc-shadow-${++uid}`;

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("width", "0");
  svg.setAttribute("height", "0");
  svg.style.position = "absolute";

  const defs = document.createElementNS(SVG_NS, "defs");
  const filterEl = document.createElementNS(SVG_NS, "filter");
  filterEl.setAttribute("id", id);
  filterEl.setAttribute("x", "-100%");
  filterEl.setAttribute("y", "-100%");
  filterEl.setAttribute("width", "400%");
  filterEl.setAttribute("height", "400%");

  const feMorph = document.createElementNS(SVG_NS, "feMorphology");
  feMorph.setAttribute("operator", "dilate");
  feMorph.setAttribute("radius", "0");
  feMorph.setAttribute("in", "SourceAlpha");
  feMorph.setAttribute("result", "spread");
  filterEl.appendChild(feMorph);

  const feBlur = document.createElementNS(SVG_NS, "feGaussianBlur");
  feBlur.setAttribute("in", "spread");
  feBlur.setAttribute("stdDeviation", "0");
  feBlur.setAttribute("result", "blur");
  filterEl.appendChild(feBlur);

  const feOffset = document.createElementNS(SVG_NS, "feOffset");
  feOffset.setAttribute("dx", "0");
  feOffset.setAttribute("dy", "0");
  feOffset.setAttribute("result", "offset");
  filterEl.appendChild(feOffset);

  const feFlood = document.createElementNS(SVG_NS, "feFlood");
  feFlood.setAttribute("flood-color", "#000");
  feFlood.setAttribute("flood-opacity", "0.5");
  feFlood.setAttribute("result", "color");
  filterEl.appendChild(feFlood);

  const feComp = document.createElementNS(SVG_NS, "feComposite");
  feComp.setAttribute("in", "color");
  feComp.setAttribute("in2", "offset");
  feComp.setAttribute("operator", "in");
  feComp.setAttribute("result", "shadow");
  filterEl.appendChild(feComp);

  const feMerge = document.createElementNS(SVG_NS, "feMerge");
  const mergeNode1 = document.createElementNS(SVG_NS, "feMergeNode");
  mergeNode1.setAttribute("in", "shadow");
  const mergeNode2 = document.createElementNS(SVG_NS, "feMergeNode");
  mergeNode2.setAttribute("in", "SourceGraphic");
  feMerge.appendChild(mergeNode1);
  feMerge.appendChild(mergeNode2);
  filterEl.appendChild(feMerge);

  defs.appendChild(filterEl);
  svg.appendChild(defs);
  anchor.appendChild(svg);

  return {
    update(shadow) {
      if (shadow.opacity <= 0) return "none";

      feMorph.setAttribute("operator", shadow.spread >= 0 ? "dilate" : "erode");
      feMorph.setAttribute("radius", String(Math.abs(shadow.spread)));
      feBlur.setAttribute("stdDeviation", String(shadow.blur));
      feOffset.setAttribute("dx", String(shadow.offsetX));
      feOffset.setAttribute("dy", String(shadow.offsetY));
      feFlood.setAttribute("flood-color", hexToRgb(shadow.color));
      feFlood.setAttribute("flood-opacity", String(shadow.opacity));

      return `url(#${id})`;
    },
    destroy() {
      svg.remove();
    },
  };
}
