// Arc-length-uniform sampling of any SVG path via the browser's native
// getPointAtLength. Lets the playground curve-type preview morph between
// curve families: path-string interpolation is impossible (different
// command sets), but per-index lerp of two equal-length sample arrays
// tweens smoothly.

export type SampledPath = ReadonlyArray<readonly [number, number]>;

const NS = "http://www.w3.org/2000/svg";

let sampler: SVGPathElement | null = null;
function getSampler(): SVGPathElement {
  if (sampler) return sampler;
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("aria-hidden", "true");
  svg.style.position = "absolute";
  svg.style.width = "0";
  svg.style.height = "0";
  svg.style.overflow = "hidden";
  const path = document.createElementNS(NS, "path");
  svg.appendChild(path);
  document.body.appendChild(svg);
  sampler = path;
  return path;
}

/** Sample `d` at `count` arc-length-uniform points. Returns an empty
 *  array when the path is degenerate (zero length). */
export function samplePath(d: string, count: number): SampledPath {
  if (typeof document === "undefined") return [];
  const el = getSampler();
  el.setAttribute("d", d);
  const total = el.getTotalLength();
  if (total <= 0) return [];
  const out: Array<readonly [number, number]> = new Array(count);
  for (let i = 0; i < count; i++) {
    const pt = el.getPointAtLength((i / count) * total);
    out[i] = [pt.x, pt.y];
  }
  return out;
}

/** Lerp two equal-length sampled paths point-by-point. */
export function lerpSampledPaths(a: SampledPath, b: SampledPath, t: number): SampledPath {
  const n = Math.min(a.length, b.length);
  const out: Array<readonly [number, number]> = new Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = [
      a[i][0] + (b[i][0] - a[i][0]) * t,
      a[i][1] + (b[i][1] - a[i][1]) * t,
    ];
  }
  return out;
}

/** Build a closed SVG `d` string from a sample array. */
export function pathFromSamples(s: SampledPath): string {
  if (s.length === 0) return "";
  let d = `M ${s[0][0].toFixed(3)} ${s[0][1].toFixed(3)}`;
  for (let i = 1; i < s.length; i++) {
    d += ` L ${s[i][0].toFixed(3)} ${s[i][1].toFixed(3)}`;
  }
  return d + " Z";
}
