// Core-level JS hot-path benches for @lisse/core. The framework-adapter
// bench in `use-smooth-corners.bench.ts` covers the same surfaces at the
// adapter level. Run both with `pnpm bench`.
import { bench, describe } from "vitest";
import { generatePath, createSvgEffects, clearCurveCache } from "../packages/core/src/index.js";
import { CURVE_CACHE_CAPACITY, _curveCacheSize } from "../packages/core/src/curves/cache.js";
import type { CurveType } from "../packages/core/src/curves/index.js";
import type { EffectsConfig, SmoothCornerOptions } from "../packages/core/src/types.js";

const CURVES: CurveType[] = ["arc", "squircle", "superellipse", "clothoid"];
const SMOOTHING = 0.6;

// A rounded corner always emits a cubic (`c`) or an arc (`a`). Both of
// `generatePath`'s early returns emit a straight-line rectangle instead —
// `"M 0 0 H 0 V 0 H 0 Z"` for a non-positive size, `"M 0 0 H 200 V 100 H 0 Z"`
// for all-zero radii — so this discriminates a real corner build from the
// early return a case that has gone vacuous would be timing.
const CORNER_COMMAND = /[ca]/;

function assertCorners(label: string, d: string): void {
  if (!CORNER_COMMAND.test(d)) {
    throw new Error(
      `${label}: generatePath returned "${d}", which has no corner command — ` +
        `this case is timing an early return, not a corner build`,
    );
  }
}

// Corner-builder output is memoised on
// `(curve, radius, smoothing, exponent, preserveSmoothing, budget)`, and each
// hit also hands back memoised per-orient segment strings. Repeating one
// identical call — what this case used to do — pins the cache at a single entry,
// so every iteration after the first timed a `Map.get`: all four curves came out
// at 2.07-2.13 µs/call while their actual builds span 4.3 µs (arc) to 9.4 µs
// (clothoid), i.e. the curve in the case name decided nothing. Walking a radius
// cycle longer than the cache in order is the LRU worst case — each pass evicts
// the entry the next pass wants — so every call is a cold build.
const COLD_CYCLE = 128;

// 12..27.875 px inside a 200x100 box keeps every radius below the squircle
// blend band's floor (short side / 2(1+s) = 31.25 px), so the whole cycle stays
// on the plain per-corner template and the case measures corner builds rather
// than drifting into the blend path halfway through.
const coldRadius = (i: number): number => 12 + (i % COLD_CYCLE) * 0.125;

/**
 * One pass over the cycle must leave the cache exactly full, which is only
 * possible if the pass inserted more distinct keys than the cache can hold —
 * the eviction that makes the next pass miss. A capacity raised past
 * `COLD_CYCLE`, or a cache key that stops depending on the radius, would
 * silently put this case back to timing cache hits.
 */
function assertColdCycle(label: string, call: (i: number) => string): void {
  clearCurveCache();
  let d = "";
  for (let i = 0; i < COLD_CYCLE; i++) d = call(i);
  assertCorners(label, d);
  if (_curveCacheSize() !== CURVE_CACHE_CAPACITY) {
    throw new Error(
      `${label}: a ${COLD_CYCLE}-call radius cycle filled only ${_curveCacheSize()} of ` +
        `${CURVE_CACHE_CAPACITY} curve-cache slots, so the cycle no longer evicts and this ` +
        `case would time cache hits instead of curve builds`,
    );
  }
}

for (const curve of CURVES) {
  const call = (i: number): string =>
    generatePath(200, 100, { radius: coldRadius(i), smoothing: SMOOTHING, curve });
  assertColdCycle(`generatePath single-corner cold — ${curve}`, call);

  describe(`generatePath single-corner cold — ${curve}`, () => {
    let i = 0;
    bench(`generatePath 200x100 uncached radius ${curve}`, () => {
      call(i++);
    });
  });
}

/**
 * The opposite regime: 100 elements in one frame whose corner shapes the cache
 * already holds — a resize or re-render of a page that has painted once. A
 * fixed radius with varying dimensions is warm by construction, because size
 * reaches the cache key only through the rounding budget `min(w, h) / 2`: the
 * 20 distinct heights below are 20 keys, the 50 distinct widths are none. That
 * is also why this batch was never the "distinct dimensions defeat the cache"
 * case it was documented as.
 *
 * The guard pins that: a second pass must add no entries (so it is served
 * entirely from cache) and the working set must stay under capacity (so nothing
 * can evict mid-pass).
 */
function assertWarmBatch(label: string, batch: () => string): void {
  clearCurveCache();
  batch();
  const filled = _curveCacheSize();
  assertCorners(label, batch());
  if (_curveCacheSize() !== filled || filled >= CURVE_CACHE_CAPACITY) {
    throw new Error(
      `${label}: the batch's working set is ${filled} keys against a ${CURVE_CACHE_CAPACITY}-slot ` +
        `cache and reached ${_curveCacheSize()} on a second pass — this case is meant to time the ` +
        `memoised assembly path, which a working set that evicts or keeps building is not`,
    );
  }
}

for (const curve of CURVES) {
  const batch = (): string => {
    let d = "";
    for (let i = 0; i < 100; i++) {
      d = generatePath(200 + (i % 50), 100 + (i % 20), { radius: 24, smoothing: SMOOTHING, curve });
    }
    return d;
  };
  assertWarmBatch(`generatePath 100-batch cached — ${curve}`, batch);

  describe(`generatePath 100-batch cached — ${curve}`, () => {
    bench(`100x generatePath cached ${curve}`, () => {
      batch();
    });
  });
}

/**
 * The figure `docs/performance.md` quotes for a resize tick on a busy page:
 * 500 corners in one frame, all sharing a corner config. Measured in both
 * regimes, because they differ by more than 5x and the doc used to quote the
 * warm one while describing the cold one.
 *
 * Warm: only the long axis varies, which never reaches the cache key (size
 * enters it through the rounding budget `min(w, h) / 2`), so all 500 calls are
 * served from a single entry — a grid of equal-height cards reflowing.
 * Cold: the short axis varies per element, so all 500 budgets are distinct and
 * evict each other out of a 64-slot cache — a masonry grid, or any list whose
 * rows differ in height.
 */
const TICK_CORNERS = 500;

for (const curve of CURVES) {
  const warm = (): string => {
    let d = "";
    for (let i = 0; i < TICK_CORNERS; i++) {
      d = generatePath(200 + (i % 50), 100, { radius: 24, smoothing: SMOOTHING, curve });
    }
    return d;
  };
  assertWarmBatch(`generatePath ${TICK_CORNERS}-batch cached — ${curve}`, warm);

  describe(`generatePath ${TICK_CORNERS}-batch cached — ${curve}`, () => {
    bench(`${TICK_CORNERS}x generatePath cached ${curve}`, () => {
      warm();
    });
  });

  const cold = (): string => {
    let d = "";
    for (let i = 0; i < TICK_CORNERS; i++) {
      d = generatePath(300, 120 + i, { radius: 24, smoothing: SMOOTHING, curve });
    }
    return d;
  };
  // Distinct-budget by construction, so the cache can only ever be full here;
  // a run that left it unfilled would mean the budget stopped tracking height
  // and every call after the first was a hit.
  clearCurveCache();
  assertCorners(`generatePath ${TICK_CORNERS}-batch cold — ${curve}`, cold());
  if (_curveCacheSize() !== CURVE_CACHE_CAPACITY) {
    throw new Error(
      `generatePath ${TICK_CORNERS}-batch cold — ${curve}: ${TICK_CORNERS} distinct budgets ` +
        `filled only ${_curveCacheSize()} of ${CURVE_CACHE_CAPACITY} slots, so this case is ` +
        `timing cache hits instead of corner builds`,
    );
  }

  describe(`generatePath ${TICK_CORNERS}-batch cold — ${curve}`, () => {
    bench(`${TICK_CORNERS}x generatePath uncached ${curve}`, () => {
      cold();
    });
  });
}

// Capsule and blend regimes are squircle-only: a uniform squircle whose short
// side reaches 2R routes to the continuous cap path, and the band just above it
// (2R < short side < 2(1+s)R) routes to the per-edge blend path. Neither branch
// consults the corner-output cache at all — the capsule branch never invokes a
// corner builder, and `capsuleEndParams`/`drawBlendPath` are unmemoised — so
// every call is real shoulder math however often it repeats (measured: the cache
// stays empty across 50k capsule calls). The sweep walks 61 distinct dimensions,
// one per frame of a pill morph.
const CAPSULE_H0 = 100;
const CAPSULE_H1 = 220;
const CAPSULE_DH = 2;
const CAPSULE_STEPS = (CAPSULE_H1 - CAPSULE_H0) / CAPSULE_DH + 1;

const sweepAt = (h: number): string =>
  generatePath(300, h, { radius: h / 2, smoothing: SMOOTHING, curve: "squircle" });

assertCorners(
  "capsule 300x100 r=50",
  generatePath(300, 100, { radius: 50, smoothing: SMOOTHING, curve: "squircle" }),
);
assertCorners(
  "blend band 300x130 r=50",
  generatePath(300, 130, { radius: 50, smoothing: SMOOTHING, curve: "squircle" }),
);

// The sweep's whole point is that every frame is a different pill, so a sweep
// whose calls collapsed onto one shape (a loop that stopped varying `h`, or a
// radius that stopped tracking it) would time repeated output — cheap, and no
// longer a morph.
const sweptPaths = new Set<string>();
for (let h = CAPSULE_H0; h <= CAPSULE_H1; h += CAPSULE_DH) sweptPaths.add(sweepAt(h));
if (sweptPaths.size !== CAPSULE_STEPS) {
  throw new Error(
    `resize sweep: ${CAPSULE_STEPS} calls produced ${sweptPaths.size} distinct paths — ` +
      `the sweep is repeating geometry instead of morphing`,
  );
}

describe("generatePath capsule/blend — squircle", () => {
  bench("capsule 300x100 r=50 s=0.6", () => {
    generatePath(300, 100, { radius: 50, smoothing: SMOOTHING, curve: "squircle" });
  });

  bench("blend band 300x130 r=50 s=0.6", () => {
    generatePath(300, 130, { radius: 50, smoothing: SMOOTHING, curve: "squircle" });
  });

  bench(`resize sweep h=${CAPSULE_H0}..${CAPSULE_H1} r=h/2`, () => {
    for (let h = CAPSULE_H0; h <= CAPSULE_H1; h += CAPSULE_DH) sweepAt(h);
  });
});

const OVERLAY_CORNERS: SmoothCornerOptions = { radius: 24, smoothing: SMOOTHING };
const OVERLAY_EFFECTS: EffectsConfig = {
  innerBorder: { width: 2, color: "#000000", opacity: 1 },
};

// `run` is where the guard inspects the overlay; the bench passes a no-op so
// its measured body stays the mount + update + destroy cycle it reports, with
// no `querySelector` folded into the number.
function overlayCycle(run: (anchor: HTMLElement) => void): void {
  const anchor = document.createElement("div");
  document.body.appendChild(anchor);
  const handle = createSvgEffects(anchor);
  handle.update(OVERLAY_CORNERS, OVERLAY_EFFECTS, 200, 100);
  run(anchor);
  handle.destroy();
  anchor.remove();
}

// Same failure the adapter benches guard: `update` returns before touching the
// DOM when either dimension is non-positive, leaving an empty `<svg>` and
// reducing this case to element creation. The size is passed in literally here
// — no layout read to go wrong — so only the guard changing shape could bail,
// but a case that silently timed that bail would still report a fast number.
overlayCycle((anchor) => {
  assertCorners(
    "createSvgEffects update",
    anchor.querySelector("clipPath path")?.getAttribute("d") ?? "",
  );
});

const NO_INSPECT = (): void => {};

describe("createSvgEffects — mount + update cycle", () => {
  bench("createSvgEffects + update", () => {
    overlayCycle(NO_INSPECT);
  });
});
