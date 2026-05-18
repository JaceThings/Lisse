/* eslint-disable react-refresh/only-export-components -- constants are co-located with the single component that owns them */
import { useEffect, useState } from "react";
import { createRafCoalescer } from "../utils/raf.ts";

const TOUCH_MEDIA_QUERY = "(hover: none) and (pointer: coarse)";

function getIsTouchPrimary() {
  return typeof window !== "undefined" && window.matchMedia(TOUCH_MEDIA_QUERY).matches;
}

// Inject (or refresh) the component's CSS at module load. Updating
// `textContent` on the existing element — rather than bailing when it's
// already present — means Vite HMR picks up edits without a hard reload.
const STYLE_ID = "selection-highlight-styles";
if (typeof document !== "undefined") {
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = STYLE_ID;
    document.head.appendChild(el);
  }
  el.textContent = `
/* Gated by a class the effect toggles on <html>, so native selection
 * still paints if JS fails to hydrate. */
html.selection-highlight-ready ::selection { background-color: transparent; color: inherit; }

:root {
  /* Marker alpha is dialled down so selected text stays comfortably
   * readable — brown on cream is a darker contrast pair, so the marker
   * doesn't need full alpha to register. Light-only design. */
  --selection-highlight-intensity: 0.6;
}

.selection-highlight {
  position: absolute;
  pointer-events: none;
  z-index: 9999;
  opacity: 0;
  /* Chisel-marker shape — parallelogram with arc-rounded "exit" tips.
   * clip-path: path() is set inline per line so slant and corner radii
   * can vary. Only opacity transitions; position/size writes during
   * selection extension must remain instant. */
  transition: opacity 200ms var(--ease-out-quint);
  background: linear-gradient(85deg,
    rgba(var(--primary-rgb), calc(0.62 * var(--selection-highlight-intensity))) 2.2%,
    rgba(var(--primary-rgb), calc(0.46 * var(--selection-highlight-intensity))) 8%,
    rgba(var(--primary-rgb), calc(0.48 * var(--selection-highlight-intensity))) 92%,
    rgba(var(--primary-rgb), calc(0.72 * var(--selection-highlight-intensity))) 100%);
  mask-image: var(--selection-grain-mask);
  -webkit-mask-image: var(--selection-grain-mask);
  mask-size: 256px 64px;
  -webkit-mask-size: 256px 64px;
  mask-repeat: repeat;
  -webkit-mask-repeat: repeat;
}

.selection-highlight.is-visible { opacity: 1; }
`;
}

// Marker-style text-selection highlight.
//
// Architecture:
//   - One <div> per visual line, appended to the nearest POSITIONED
//     ancestor so it scrolls natively — no JS during scroll.
//   - Visual character from a single pre-rendered noise SVG used as
//     mask-image. The browser rasterises once and caches; per-element
//     cost is ~zero. Per-line variation via mask-position offset.
//   - Endpoint pooling and overall alpha come from a linear-gradient
//     background. Gradient × noise mask = marker texture.
//   - Seed for per-line jitter derives from anchor-relative top —
//     stable across scroll AND selection extension (only width changes
//     per char, not top).

// Other components can request an immediate fade-out by dispatching
// this on window. Cleaner than coupling via a CSS class on a parent.
export const SELECTION_HIGHLIGHT_HIDE_EVENT = "selection-highlight:hide";

export const SELECTION_HIGHLIGHT_CONFIG = {
  noiseTile: {
    width: 256,
    height: 64,
    // baseFrequency: (x, y). Low x = long horizontal stride, high y = rapid
    // vertical change → horizontal striations parallel to stroke direction.
    striationFrequency: "0.04 0.7",
    striationOctaves: 1,
    // Mask alpha range. Floors kept high so the rounded marker-tip caps
    // never have a low-alpha patch eating into them. Final combined alpha
    // bottoms out around 0.84 × 0.86 ≈ 0.72 — visible texture, no
    // perceived "cutoff" at the cap edges.
    striationAlphaMin: 0.84,
    striationAlphaSlope: 0.16,
    striationSeed: 3,
    // Density patches: large soft blobs of pressure variation
    patchFrequency: "0.012",
    patchOctaves: 2,
    patchAlphaMin: 0.86,
    patchAlphaSlope: 0.14,
    patchSeed: 7,
  },
  // Per-line outward extension. Kept tight so the highlight visibly
  // hugs the character width — for short selections (single words),
  // wide extension reads as an oversized blob, not a marker pass.
  // Mins are at least chiselSlant.max (5 px) so the clip-path never
  // cuts into text regardless of which slant value a line draws.
  coverageExtension: {
    leftMin: 5, leftMax: 8,
    rightMin: 5, rightMax: 9,
    // Bumped from 1 to 2 to give the edge-wave amplitude (1 px)
    // headroom — the wavy top stays above the text bound.
    topBottom: 2,
  },
  // Chisel slant (px the top edge shifts right of the bottom edge).
  // Slightly varied per line so the chisel "grip angle" reads as
  // human-held rather than algorithmic-constant.
  chiselSlant: { min: 2, max: 5 },
  tipRadius: 3,
  // Long-edge waviness. The top and bottom edges aren't drawn as a
  // single straight line — they're subdivided into ~30 px segments
  // and each segment endpoint nudges up or down by up to `amplitude`
  // px (deterministic per line + segment). Reads as the slight
  // wobble of a chisel held by a human hand.
  edgeWave: {
    segmentLength: 30,
    amplitude: 1.0,
  },
  // Rect filtering and merging
  mergeTolerance: 0.5,    // fraction of median line height
  // Max horizontal gap (in median line heights) before same-line rects stay
  // separate instead of merging. Natural inline gaps (space chars, <em>/<a>
  // flanks) sit under 1×; flex justify-between rows (home page title + date)
  // are several×. 1.5× safely separates them.
  mergeMaxGapRatio: 1.5,
  // Drop rects taller than 3× median. The H1 display line is ~1.8× the body
  // line height, so 1.6 would reject it as a "bbox artifact." True artifacts
  // emitted by Chromium when a range crosses block boundaries are 5×+ the
  // body line, so 3.0 keeps legitimate large headings while still catching
  // the giant paragraph-spanning rects.
  bboxRejectRatio: 3.0,
} as const;

// stitchTiles="stitch" makes the tile wrap seamlessly so we can offset
// mask-position across overlays without visible seams.
function buildNoiseTileDataUrl(): string {
  const c = SELECTION_HIGHLIGHT_CONFIG.noiseTile;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${c.width}" height="${c.height}">
<defs>
<filter id="g" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
<feTurbulence type="fractalNoise" baseFrequency="${c.striationFrequency}" numOctaves="${c.striationOctaves}" stitchTiles="stitch" seed="${c.striationSeed}" result="s"/>
<feColorMatrix in="s" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 ${c.striationAlphaSlope} ${c.striationAlphaMin}" result="sa"/>
<feTurbulence type="fractalNoise" baseFrequency="${c.patchFrequency}" numOctaves="${c.patchOctaves}" stitchTiles="stitch" seed="${c.patchSeed}" result="p"/>
<feColorMatrix in="p" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 ${c.patchAlphaSlope} ${c.patchAlphaMin}" result="pa"/>
<feComposite in="sa" in2="pa" operator="arithmetic" k1="1" k2="0" k3="0" k4="0"/>
</filter>
</defs>
<rect width="${c.width}" height="${c.height}" fill="black" filter="url(#g)"/>
</svg>`;
  return `url("data:image/svg+xml;base64,${btoa(svg)}")`;
}

// Deterministic [-1, 1] pseudo-random from an integer seed.
const hashJitter = (seed: number): number => {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return (x - Math.floor(x)) * 2 - 1;
};

// Nearest positioned ancestor — overlays attach here and scroll natively.
// When the walk reaches <body> (typical for Cmd+A whose commonAncestor IS
// the body), prefer an <article>/<main>: highlight the reading surface,
// not the page chrome that also sits directly under body.
function findAnchor(node: Node): HTMLElement {
  let el: Element | null = node instanceof Element ? node : node.parentElement;
  while (el && el !== document.body && el !== document.documentElement) {
    if (window.getComputedStyle(el).position !== "static") return el as HTMLElement;
    el = el.parentElement;
  }
  // Prefer <article> over <main> — on pages with both (main = background
  // grid; article = reading surface) we want the reading surface.
  return document.querySelector<HTMLElement>("article")
    ?? document.querySelector<HTMLElement>("main")
    ?? document.body;
}

type Box = { top: number; bottom: number; left: number; right: number };

// Convert raw rects from the selection's text nodes into merged visual
// lines. Drops:
//   - bbox artifacts (rects much taller than the median line, emitted by
//     Chromium when a range crosses block boundaries)
//   - rects whose horizontal extent lands outside the anchor column
//     (catches sr-only text, decorative wrappers, and stops the merge
//     from concatenating rects across columns into giant ghost bands
//     when Cmd+A spans content outside the article)
// Then merges rects sharing a vertical centre (hyphenation, inline
// elements like <em>/<a>).
function mergeRectsByLine(raw: Box[], anchorLeft: number, anchorRight: number): Box[] {
  if (raw.length === 0) return [];
  const cfg = SELECTION_HIGHLIGHT_CONFIG;
  const heights = raw.map((r) => r.bottom - r.top).sort((a, b) => a - b);
  const median = heights[Math.floor(heights.length / 2)] || 0;
  const tol = median * cfg.mergeTolerance;
  const maxH = median * cfg.bboxRejectRatio;
  const maxGap = median * cfg.mergeMaxGapRatio;
  // Generous slop so word-wrap on the trailing edge isn't dropped.
  const slop = 24;
  const minLeft = anchorLeft - slop;
  const maxRight = anchorRight + slop;

  const lines: Box[] = [];
  for (let i = 0; i < raw.length; i++) {
    const r = raw[i];
    if (r.bottom - r.top > maxH) continue;
    if (r.right < minLeft || r.left > maxRight) continue;
    const cy = (r.top + r.bottom) / 2;
    let merged = false;
    for (let k = 0; k < lines.length; k++) {
      const l = lines[k];
      if (Math.abs(cy - (l.top + l.bottom) / 2) >= tol) continue;
      // Only merge when horizontally adjacent (see mergeMaxGapRatio above).
      const gap = Math.max(r.left - l.right, l.left - r.right);
      if (gap > maxGap) continue;
      if (r.top < l.top) l.top = r.top;
      if (r.bottom > l.bottom) l.bottom = r.bottom;
      if (r.left < l.left) l.left = r.left;
      if (r.right > l.right) l.right = r.right;
      merged = true;
      break;
    }
    if (!merged) lines.push({ ...r });
  }
  return lines;
}

// One long edge (top or bottom) subdivided into ~segLen segments, with
// each segment endpoint nudged up/down by up to ±amp px deterministic
// from edgeSeed. Returns concatenated SVG path L commands. Supports
// negative direction (bottom edge runs right-to-left).
function buildEdge(
  startX: number,
  endX: number,
  baseY: number,
  edgeSeed: number,
  segLen: number,
  amp: number,
): string {
  let out = "";
  const len = endX - startX;
  const segs = Math.max(1, Math.round(Math.abs(len) / segLen));
  for (let k = 1; k < segs; k++) {
    const x = startX + (k / segs) * len;
    const y = baseY + hashJitter(edgeSeed + k * 17) * amp;
    out += `L ${x.toFixed(1)} ${y.toFixed(2)} `;
  }
  return out;
}

// Build the full clip-path: path(...) string for one overlay. Parallelogram
// with all four corners rounded by quadratic arcs at each polygon vertex,
// long edges (top + bottom) subdivided with per-segment Y jitter for
// hand-drawn waviness.
function buildClipPath(p: {
  slant: number;
  ow: number;
  oh: number;
  R: number;
  segLen: number;
  amp: number;
  seed: number;
}): string {
  const { slant: sl, ow, oh, R, segLen, amp, seed } = p;
  return (
    `path("M ${(sl + R).toFixed(1)} 0 ` +
    buildEdge(sl + R, ow - R, 0, seed + 200, segLen, amp) +
    `L ${(ow - R).toFixed(1)} 0 ` +
    `Q ${ow.toFixed(1)} 0 ${ow.toFixed(1)} ${R} ` +
    `L ${(ow - sl).toFixed(1)} ${(oh - R).toFixed(1)} ` +
    `Q ${(ow - sl).toFixed(1)} ${oh.toFixed(1)} ${(ow - sl - R).toFixed(1)} ${oh.toFixed(1)} ` +
    buildEdge(ow - sl - R, R, oh, seed + 300, segLen, amp) +
    `L ${R.toFixed(1)} ${oh.toFixed(1)} ` +
    `Q 0 ${oh.toFixed(1)} 0 ${(oh - R).toFixed(1)} ` +
    `L ${sl.toFixed(1)} ${R.toFixed(1)} ` +
    `Q ${sl.toFixed(1)} 0 ${(sl + R).toFixed(1)} 0 Z")`
  );
}

export function SelectionHighlight() {
  // Touch keeps native selection — the OS callout (Copy / Look Up /
  // Translate) and grab handles are the actual mobile UX, and the
  // unstyleable callout arrow would visually conflict with our marker.
  // Subscribe to the MQL so hot-attaching a mouse to an iPad flips live.
  const [isTouchPrimary, setIsTouchPrimary] = useState(getIsTouchPrimary);

  useEffect(() => {
    const mql = window.matchMedia(TOUCH_MEDIA_QUERY);
    const onChange = (e: MediaQueryListEvent) => setIsTouchPrimary(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (isTouchPrimary) return;

    const noiseUrl = buildNoiseTileDataUrl();
    document.documentElement.style.setProperty("--selection-grain-mask", noiseUrl);
    // Gate the ::selection transparency override on this class so native
    // selection paints if JS fails to hydrate.
    document.documentElement.classList.add("selection-highlight-ready");

    // Overlays are keyed by line IDENTITY (anchor-relative top), NOT by
    // array index. When selection extends upward, existing lines keep
    // their existing overlay (and stay visibly-on), so only the genuinely
    // new top line fades in. Array-indexed pooling caused every existing
    // line to fade-in flicker when a new line was added above.
    const overlays = new Map<number, HTMLDivElement>();
    let currentAnchor: HTMLElement = document.body;

    const hideAll = () => {
      for (const d of overlays.values()) d.classList.remove("is-visible");
    };

    const reparentIfNeeded = (anchor: HTMLElement) => {
      if (anchor !== currentAnchor) {
        for (const d of overlays.values()) anchor.appendChild(d);
        currentAnchor = anchor;
      }
    };

    const getOrCreateOverlay = (key: number, anchor: HTMLElement): HTMLDivElement => {
      let d = overlays.get(key);
      if (d) return d;
      d = document.createElement("div");
      d.className = "selection-highlight";
      d.setAttribute("aria-hidden", "true");
      anchor.appendChild(d);
      overlays.set(key, d);
      return d;
    };

    const measureCore = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        hideAll();
        return;
      }

      const anchor = findAnchor(sel.getRangeAt(0).commonAncestorContainer);
      const ar = anchor.getBoundingClientRect();
      reparentIfNeeded(anchor);

      // Walk only the text nodes that are DESCENDANTS OF THE ANCHOR and
      // that the selection intersects. Skips page chrome (fixed buttons,
      // accessibility labels) even when Cmd+A's selection spans them —
      // they live outside the article/main reading surface.
      // Also rejects visibility:hidden text: Range.getClientRects still
      // returns boxes for unpainted text, which would paint ghost bands.
      const raw: Box[] = [];
      const scratchRange = document.createRange();
      for (let i = 0; i < sel.rangeCount; i++) {
        const range = sel.getRangeAt(i);
        const walker = document.createTreeWalker(anchor, NodeFilter.SHOW_TEXT, {
          acceptNode: (n) => {
            if (!range.intersectsNode(n)) return NodeFilter.FILTER_REJECT;
            let p: HTMLElement | null = n.parentElement;
            while (p && p !== anchor) {
              const cs = window.getComputedStyle(p);
              if (cs.visibility === "hidden") return NodeFilter.FILTER_REJECT;
              // Respect `user-select: none`. The host has opted this subtree
              // out of selection; the marker overlay must not render over it
              // either. (CSS `user-select` is inherited, so the computed value
              // reflects ancestor opt-outs.)
              if (cs.userSelect === "none") return NodeFilter.FILTER_REJECT;
              // Visually-hidden patterns (sr-only / .visually-hidden) collapse to
              // a 1×1 clipped box, but the text inside still reports natural
              // character rects from `getClientRects` — paint them and you get
              // ghost highlights at irrelevant positions (long header bars,
              // stacked rectangles next to the demo grid, etc.). Reject the text
              // node if any ancestor up to the anchor is a ≤1px clip box.
              if (p.offsetWidth <= 1 || p.offsetHeight <= 1) return NodeFilter.FILTER_REJECT;
              p = p.parentElement;
            }
            return NodeFilter.FILTER_ACCEPT;
          },
        });
        let n = walker.nextNode() as Text | null;
        while (n) {
          const start = n === range.startContainer ? range.startOffset : 0;
          const end = n === range.endContainer ? range.endOffset : n.length;
          if (end > start) {
            scratchRange.setStart(n, start);
            scratchRange.setEnd(n, end);
            const cr = scratchRange.getClientRects();
            for (let j = 0; j < cr.length; j++) {
              const r = cr[j];
              if (r.width < 1 || r.height < 1) continue;
              raw.push({ top: r.top, bottom: r.bottom, left: r.left, right: r.right });
            }
          }
          n = walker.nextNode() as Text | null;
        }

        // <numeric-text> renders its label via shadow DOM, so the text
        // walker misses it. Pick up its bounding rect so morphing labels
        // still highlight. Skip whitespace-only shadows.
        for (const nt of anchor.querySelectorAll<HTMLElement>("numeric-text")) {
          if (!range.intersectsNode(nt)) continue;
          const cs = window.getComputedStyle(nt);
          if (cs.visibility === "hidden" || cs.userSelect === "none") continue;
          const hasText = (nt.shadowRoot?.textContent ?? nt.textContent ?? "").trim();
          if (!hasText) continue;
          const rc = nt.getBoundingClientRect();
          if (rc.width < 1 || rc.height < 1) continue;
          raw.push({ top: rc.top, bottom: rc.bottom, left: rc.left, right: rc.right });
        }
      }

      const lines = mergeRectsByLine(raw, ar.left, ar.right);
      if (lines.length === 0) {
        hideAll();
        return;
      }

      const activeKeys = new Set<number>();

      const cfg = SELECTION_HIGHLIGHT_CONFIG;
      const tileW = cfg.noiseTile.width;
      const tileH = cfg.noiseTile.height;
      const leftRange = cfg.coverageExtension.leftMax - cfg.coverageExtension.leftMin;
      const rightRange = cfg.coverageExtension.rightMax - cfg.coverageExtension.rightMin;
      const slantRange = cfg.chiselSlant.max - cfg.chiselSlant.min;

      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        const w = l.right - l.left;
        const h = l.bottom - l.top;
        // Seed off ANCHOR-RELATIVE top ONLY. Stable across scroll (top
        // shifts equally for line and anchor), forward drag-select (top
        // fixed as right grows), and backward drag-select (top fixed as
        // left grows — left is NOT in the seed for this reason).
        // `* 7 + round()` quantises top at ~0.14 px; visual lines are
        // ≥20 px apart, so it can't collide here. Tighten the multiplier
        // or introduce fractional positioning and the invariant breaks.
        const seed = Math.round((l.top - ar.top) * 7);
        const leftExt = cfg.coverageExtension.leftMin + (hashJitter(seed) * 0.5 + 0.5) * leftRange;
        const rightExt = cfg.coverageExtension.rightMin + (hashJitter(seed + 11) * 0.5 + 0.5) * rightRange;
        const slant = cfg.chiselSlant.min + (hashJitter(seed + 101) * 0.5 + 0.5) * slantRange;
        // Per-line variation: shift the noise tile sample window. Single
        // cached raster, infinite distinct samples.
        const maskX = -((seed * 37) % tileW + tileW) % tileW;
        const maskY = -((seed * 13) % tileH + tileH) % tileH;
        const ow = w + leftExt + rightExt;
        const oh = h + cfg.coverageExtension.topBottom * 2;

        activeKeys.add(seed);
        const d = getOrCreateOverlay(seed, anchor);
        const s = d.style;
        s.top = `${l.top - ar.top - cfg.coverageExtension.topBottom}px`;
        s.left = `${l.left - ar.left - leftExt}px`;
        s.width = `${ow}px`;
        s.height = `${oh}px`;
        s.maskPosition = `${maskX}px ${maskY}px`;
        s.webkitMaskPosition = `${maskX}px ${maskY}px`;
        const clip = buildClipPath({
          slant, ow, oh, seed,
          R: cfg.tipRadius,
          segLen: cfg.edgeWave.segmentLength,
          amp: cfg.edgeWave.amplitude,
        });
        s.clipPath = clip;
        s.setProperty("-webkit-clip-path", clip);
        if (!d.classList.contains("is-visible")) d.classList.add("is-visible");
      }
      for (const [key, d] of overlays) {
        if (!activeKeys.has(key)) d.classList.remove("is-visible");
      }
    };

    // Perf marks wrap the whole body in dev only — no need to repeat
    // them inside every early-return branch.
    const measure = import.meta.env.DEV
      ? () => {
          performance.mark("selection-highlight-start");
          measureCore();
          performance.mark("selection-highlight-end");
          performance.measure(
            "selection-highlight",
            "selection-highlight-start",
            "selection-highlight-end",
          );
        }
      : measureCore;

    // No scroll listener — anchor-relative positioning means scroll moves
    // overlays natively at compositor speed.
    const { schedule: scheduleMeasure, cancel: cancelScheduled } = createRafCoalescer(measure);
    // `selectionchange` fires multiple times per frame during drag-select;
    // route it through the same rAF coalescer as resize so we only re-walk
    // the tree once per frame.
    document.addEventListener("selectionchange", scheduleMeasure);
    window.addEventListener("resize", scheduleMeasure);
    window.addEventListener(SELECTION_HIGHLIGHT_HIDE_EVENT, hideAll);

    return () => {
      cancelScheduled();
      document.removeEventListener("selectionchange", scheduleMeasure);
      window.removeEventListener("resize", scheduleMeasure);
      window.removeEventListener(SELECTION_HIGHLIGHT_HIDE_EVENT, hideAll);
      for (const d of overlays.values()) d.remove();
      overlays.clear();
      document.documentElement.style.removeProperty("--selection-grain-mask");
      document.documentElement.classList.remove("selection-highlight-ready");
    };
  }, [isTouchPrimary]);

  return null;
}
