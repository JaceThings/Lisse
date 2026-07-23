// Shared harness for the framework-adapter benches (react/vue/svelte): a
// controllable ResizeObserver stub, a sync rAF polyfill, and the shared
// count/autoEffects/effects case grid. `@vitest-environment happy-dom` and
// the beforeAll/afterAll wiring stay per-file since vitest scopes those to
// the file that declares them.
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

/** Fires synthetic entries for every observed target, mirroring what a real browser delivers after a layout change. */
export function fireAll(): void {
  for (const obs of [...observers]) {
    if (obs.targets.size === 0) continue;
    const entries = [...obs.targets].map(
      (target) =>
        ({
          target,
          contentRect: { width: 200, height: 100, top: 0, left: 0, right: 200, bottom: 100, x: 0, y: 0 } as DOMRectReadOnly,
          borderBoxSize: [],
          contentBoxSize: [],
          devicePixelContentBoxSize: [],
        }) as unknown as ResizeObserverEntry,
    );
    obs.callback(entries);
  }
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

/** Without a non-zero bounding rect the sync bails out early and benches would measure nothing. */
export function stubBoundingRect(): void {
  const proto = HTMLElement.prototype as unknown as {
    getBoundingClientRect: () => DOMRect;
  };
  proto.getBoundingClientRect = function () {
    return {
      x: 0,
      y: 0,
      width: 200,
      height: 100,
      top: 0,
      left: 0,
      right: 200,
      bottom: 100,
      toJSON() {
        return this;
      },
    } as DOMRect;
  };
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
