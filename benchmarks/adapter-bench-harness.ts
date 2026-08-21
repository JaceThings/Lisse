// Shared harness for the framework-adapter benches (react/vue/svelte/octane): a
// controllable ResizeObserver stub, a stubbed layout so syncs actually run, a
// sync rAF polyfill, and the shared count/autoEffects/effects case grid.
// `@vitest-environment happy-dom` and the beforeAll/afterAll wiring stay
// per-file since vitest scopes those to the file that declares them.
import type { BorderConfig } from "../packages/core/src/types.js";

type ROCallback = (entries: ResizeObserverEntry[]) => void;

interface ControllableObserver {
  callback: ROCallback;
  targets: Set<Element>;
}

const observers: ControllableObserver[] = [];

/** ResizeObserver stub; benches drive layout manually via `fireAll()`. */
export class StubResizeObserver {
  private readonly self: ControllableObserver;
  constructor(callback: ROCallback) {
    this.self = { callback, targets: new Set() };
    observers.push(this.self);
  }
  observe(target: Element): void {
    this.self.targets.add(target);
  }
  unobserve(target: Element): void {
    this.self.targets.delete(target);
  }
  disconnect(): void {
    this.self.targets.clear();
    const i = observers.indexOf(this.self);
    if (i !== -1) observers.splice(i, 1);
  }
}

// The stubbed border box. `getLayoutSize` prefers computed `width`/`height`
// and accepts only px values; happy-dom returns "" for both, so it falls
// through to `offsetWidth`/`offsetHeight`, which happy-dom reports as 0 for
// every element. Every adapter's sync then hits its
// `if (width <= 0 || height <= 0) return;` guard — no clip-path, no overlay
// update, `data-state` never reaches "ready" — so without this stub the
// benches time a framework mount plus an early return.
let layoutWidth: number;
let layoutHeight: number;
let layoutRect: DOMRect;

/** Current stubbed border-box size; `getLayoutSize` reads it via offset*. */
export function setLayoutSize(width: number, height: number): void {
  layoutWidth = width;
  layoutHeight = height;
  // Built here rather than per `getBoundingClientRect` call so the offset* and
  // rect reads can't disagree, and so placing N overlays in one flush doesn't
  // allocate N rects of harness noise into the measurement.
  layoutRect = {
    x: 0,
    y: 0,
    width,
    height,
    top: 0,
    left: 0,
    right: width,
    bottom: height,
    toJSON() {
      return this;
    },
  };
}

// The grid's default box, installed at import so the very first mount — which
// syncs before any bench has called `fireAll` — measures something.
setLayoutSize(200, 100);

/**
 * Stub layout so a sync actually runs: defines offsetWidth/offsetHeight on
 * HTMLElement.prototype (what getLayoutSize falls back to under happy-dom) and
 * keeps getBoundingClientRect agreeing with the same numbers, since the SVG
 * overlay's rect-measured branch reads those.
 */
export function stubLayout(): void {
  // Getters, not values: the size moves between iterations and every element
  // shares one prototype, so a fixed value would pin the whole grid to
  // whatever `stubLayout()` happened to see.
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
    configurable: true,
    get: () => layoutWidth,
  });
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get: () => layoutHeight,
  });
  // happy-dom leaves `offsetParent` undefined, so `createOverlayPlacer` takes
  // its `measureByRects` branch and positions every overlay off these rects.
  HTMLElement.prototype.getBoundingClientRect = () => layoutRect;
}

/**
 * Deliver a ResizeObserver callback for every observed target, carrying a real
 * `borderBoxSize` and a matching `contentRect`, after pointing the layout stub
 * at the same size — which is what a browser does: the notification's box and a
 * live measure taken in the same frame agree.
 *
 * The box has to be real and has to move between calls, or the delivery is a
 * no-op twice over. `observeResize` drops a notification whose `borderBoxSize`
 * matches what the last flush measured, so the old `borderBoxSize: []` meant
 * that skip never ran here and the bench diverged from browser behaviour; and
 * downstream of it every adapter's change guard bails when width, height and
 * the serialized options key are all unchanged, so redelivering one constant
 * size measures a guard bail rather than a re-sync.
 */
export function fireAll(width: number, height: number): void {
  setLayoutSize(width, height);
  const box: readonly ResizeObserverSize[] = [{ inlineSize: width, blockSize: height }];
  for (const obs of [...observers]) {
    if (obs.targets.size === 0) continue;
    const entries: ResizeObserverEntry[] = [...obs.targets].map((target) => ({
      target,
      contentRect: layoutRect,
      borderBoxSize: box,
      contentBoxSize: box,
      devicePixelContentBoxSize: box,
    }));
    obs.callback(entries);
  }
}

// Two sizes is all the alternation needs: both the notification skip and the
// adapter change guards compare against the immediately preceding size, so
// iteration N only has to differ from N-1.
const RESIZE_A = { width: 200, height: 100 };
const RESIZE_B = { width: 240, height: 120 };

/** Sizes for successive Resize iterations; consecutive entries always differ. */
export function resizeSize(iteration: number): { width: number; height: number } {
  return iteration % 2 === 0 ? RESIZE_A : RESIZE_B;
}

let origRaf: typeof requestAnimationFrame | undefined;
let origCaf: typeof cancelAnimationFrame | undefined;

export function installSyncRaf(): void {
  origRaf = globalThis.requestAnimationFrame;
  origCaf = globalThis.cancelAnimationFrame;
  // The core `observeResize` uses `rafId === undefined` as a "frame
  // already scheduled" guard. If our polyfill returned any number, the
  // assignment `rafId = requestAnimationFrame(...)` would leave rafId
  // truthy after the (already-synchronous) callback returns, and
  // subsequent resize notifications would no-op. Returning `undefined`
  // keeps the guard correct while still running the callback inline.
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
    cb(performance.now());
    return undefined as unknown as number;
  }) as typeof requestAnimationFrame;
  globalThis.cancelAnimationFrame = (() => {}) as typeof cancelAnimationFrame;
}

export function restoreRaf(): void {
  if (origRaf) globalThis.requestAnimationFrame = origRaf;
  if (origCaf) globalThis.cancelAnimationFrame = origCaf;
}

export type Effects = "none" | "innerBorder";

export const INNER_BORDER: BorderConfig = { width: 2, color: "#000", opacity: 1 };

export interface CaseSpec {
  count: number;
  autoEffects: boolean;
  effects: Effects;
}

// Counts top out at 100 — enough to show the scaling story without a
// multi-second per-iteration mount loop.
export const COUNTS = [1, 10, 50, 100];
export const AUTOS = [true, false];
export const EFFECTS: Effects[] = ["none", "innerBorder"];

// vitest-bench uses tinybench under the hood; `time: 1000` gives each case
// at least 1s of sampling for a stable mean.
export const BENCH_OPTS = { time: 1000 } as const;

export function forEachCase(run: (spec: CaseSpec, label: string) => void): void {
  for (const count of COUNTS) {
    for (const autoEffects of AUTOS) {
      for (const effects of EFFECTS) {
        const spec: CaseSpec = { count, autoEffects, effects };
        run(spec, `n=${count} auto=${autoEffects} effects=${effects}`);
      }
    }
  }
}
