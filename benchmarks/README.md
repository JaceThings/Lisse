# `@lisse` benchmarks

Micro-benchmarks for the whole workspace's hot paths — the `core`
path/effects engine, the React, Vue, and Svelte adapters, and the SSR
render path. The suite measures **JS-only cost** under varying instance
counts and effect configurations. Results are summarised in
[`docs/performance.md`](../docs/performance.md).

## What this measures

The suite spans five files: `core.bench.ts` (the DOM-free path and
effects engine), the three adapter benches
(`use-smooth-corners.bench.ts` for React,
`use-smooth-corners-vue.bench.ts`, `use-smooth-corners-svelte.bench.ts`),
and `ssr.bench.ts` (server render). The adapter benches share one grid
out of `adapter-bench-harness.ts`, each cell driving three hot paths:

- **Resize**: deliver a `ResizeObserver` callback carrying a changed
  border box to every mounted element and wait for every per-element sync
  to finish. The delivered size alternates between 200x100 and 240x120
  across iterations: core drops a notification that reports the box the
  last flush already measured, and each adapter's own change guard bails
  when width, height and the serialized options are all unchanged, so a
  constant size would time two skips instead of a re-sync.
- **Mount**: render _N_ `<SmoothCorners />` instances from scratch and run
  the first sync (clip-path apply + initial SVG overlay).
- **Update**: mutate the `corners.radius` prop on every instance and
  measure the re-sync cost (framework commit + the adapter's
  layout-effect equivalent).

The suite exercises this grid:

| Dimension       | Values                                        |
| --------------- | --------------------------------------------- |
| Instance counts | 1, 10, 50, 100                                |
| `autoEffects`   | `true`, `false`                               |
| Effects present | `none`, `innerBorder: { width, color, opacity }` |

That's 16 cells times 3 hot paths = **48 cases per grid**. React and
Svelte run the grid once each; the Vue file runs it twice, once through
the `<SmoothCorners>` component and once through the `useSmoothCorners`
composable — **192 adapter cases**. `core.bench.ts` adds 20 and
`ssr.bench.ts` 8, for **220 cases** in total. Adapter and SSR cases
sample for at least a second (`time: 1000`); the core cases take
tinybench's 500 ms default. Every case also has tinybench's
10-iteration floor.

## How a vacuous case fails

Each adapter bench asserts, immediately after the mount helper's first
`fireAll`, that the element it just mounted actually synced —
`data-state="ready"` plus a non-empty inline `clip-path` — and throws
otherwise. A bench that silently measures an early return is worse than a
missing benchmark: it reports a fast number.

`core.bench.ts` guards its own two failure shapes, both of them the
corner-output cache:

- The cold `generatePath` cases walk a 128-value radius cycle, and assert
  that one pass leaves the 64-slot curve cache exactly full — the proof
  that the pass evicts, so the next pass misses and every call is a real
  build.
- The cached 100-batch case asserts the opposite, since that is what its
  name promises: a working set below capacity that adds no entries on a
  second pass.
- The capsule sweep asserts its 61 calls produce 61 distinct paths, so it
  cannot collapse onto one repeated shape.
- Every case that must produce a corner asserts the `d` string contains a
  cubic or arc command. Both of `generatePath`'s early returns — a
  non-positive size, all-zero radii — emit a straight-line rectangle
  instead, and so does an overlay `update()` that bails on its own
  `width <= 0` guard.

## What this does NOT measure

- **Browser paint**. `happy-dom` is a DOM implementation with no rendering
  pipeline, so none of the costs associated with style recalc, compositing,
  or GPU work show up. These numbers are the floor — real-device timings
  will be higher once paint is included.
- **Real `ResizeObserver` scheduling**. The bench installs a controllable
  stub and fires callbacks synchronously. This isolates the adapter's JS
  work from the browser's frame-aligned dispatch.
- **Real layout**. happy-dom runs no layout engine, so the harness stubs
  one. `stubLayout()` defines `offsetWidth`/`offsetHeight` getters on
  `HTMLElement.prototype` — the fallback `getLayoutSize` takes when
  computed `width`/`height` are not px values, which is every element
  under happy-dom — and points `getBoundingClientRect` at the same
  numbers, since the SVG overlay's rect-measured placement branch reads
  those. `fireAll(width, height)` moves that stubbed box and delivers a
  `borderBoxSize` and `contentRect` that agree with it, which is what a
  browser does: the notification's box and a live measure taken in the
  same frame report the same size. Before this, only the rect was stubbed
  while `offsetWidth` stayed at happy-dom's 0, so every adapter sync
  bailed on `width <= 0` and the whole adapter grid timed a framework
  mount plus an early return.

Treat the output as a relative comparison tool ("how much does adding an
`innerBorder` cost per instance?") not an absolute frame budget.

## Running

From the repo root:

```sh
pnpm bench
```

Or from this directory:

```sh
pnpm --filter @lisse/benchmarks bench
```

## Interpreting results

vitest-bench prints tinybench stats per case. The columns you want are:

- **hz**: ops per second (inverse of mean).
- **mean**: average time per op in ms. Primary signal.
- **p99 / p999**: tail latency. Large gaps between `mean` and `p99`
  usually indicate GC pauses mid-sample.
- **rme**: relative margin of error. Treat any result over ~5% as noisy
  and re-run before drawing conclusions.
- **samples**: how many iterations fed the stats. Low sample counts
  (fewer than a few hundred) mean the individual op is expensive; the
  numbers are still valid but have wider error bars.

## Caveats

- **Shared module state**. The core `observeResize` uses a single
  module-global `ResizeObserver` and `requestAnimationFrame` queue.
  Benches install a synchronous `requestAnimationFrame` polyfill
  (returning `undefined` so the core's "frame scheduled?" guard stays
  correct) and a stub `ResizeObserver` that records callbacks for manual
  firing.
- **Stubbed layout, not approximated layout**. Sizes come from the
  harness and change only when a bench says so, so nothing here exercises
  a fractional box, an ancestor transform, a vertical writing mode, or a
  box the browser invalidated on its own.
- **Node-only**. These numbers come from V8 on Node under macOS. They're
  representative of user-agents that ship V8 (Chromium, Edge) but not
  direct proxies for Safari or Firefox.
- **Not wired into CI**. This suite is informational, not a regression
  gate.

## Grid adjustments

None. No dimension was reduced: 4 x 2 x 2 x 3 = 48 cases per adapter
grid, 220 across the suite. Sampling alone therefore floors a full run at
a little over three minutes (200 cases at ≥1 s, 20 at ≥0.5 s), before the
per-iteration mount cost of the larger counts.

## Results

Measured on 2026-08-16, Node v26.7.0 on macOS (Darwin 25.5.0, Apple M4 Max),
machine otherwise idle, against the fixed harness and the optimized path
emitter. Every case below sampled at ≤8% rme except the adapter `innerBorder`
cells at n=100, which run 10-22% because a 1 s budget only fits ~10
iterations of a 100 ms op.

### Core path engine

`generatePath`, 200×100 box, smoothing 0.6, per call:

| curve | cold (cache miss) | cached |
|---|---|---|
| `arc` | 1.0 µs | 0.70 µs |
| `squircle` | 2.5 µs | 0.67 µs |
| `superellipse` | 3.6 µs | 0.68 µs |
| `clothoid` | 3.7 µs | 0.64 µs |

The cached column is the 100-batch case divided by 100; it is flat across
curves because a hit returns memoised segment strings and the curve never
runs. The cold column is the actual per-curve build cost — a 3.7× spread
the old warm-only tables reported as 0.06 µs.

500 corners in one frame, shared corner config:

| curve | cached | cold |
|---|---|---|
| `arc` | 0.297 ms | 0.425 ms |
| `squircle` | 0.277 ms | 0.580 ms |
| `superellipse` | 0.294 ms | 0.865 ms |
| `clothoid` | 0.276 ms | 0.861 ms |

Cached is 500 elements differing only on the long axis, which never reaches
the cache key; cold is 500 distinct short axes, so all 500 budgets are
distinct keys evicting each other out of 64 slots. Cold costs less per call
here than in the single-corner table because only the budget varies while
the radius stays at 24 — a masonry grid, not 500 different corner configs.

| case | mean |
|---|---|
| capsule 300×100 r=50 s=0.6 (full-pill) | 0.0013 ms |
| blend band 300×130 r=50 s=0.6 | 0.0030 ms |
| resize sweep h=100..220 r=h/2 (61 calls) | 0.080 ms |
| `createSvgEffects` + update cycle | 0.157 ms |

### Adapters

Mean ms for the whole batch (not per element), `autoEffects: true`:

| adapter | Mount n=1 | Mount n=100 | Resize n=1 | Resize n=100 | Update n=1 | Update n=100 |
|---|---|---|---|---|---|---|
| React | 0.171 | 17.2 | 0.019 | 1.53 | 0.037 | 6.03 |
| Vue (component) | 0.132 | 12.6 | 0.020 | 1.58 | 0.035 | 6.28 |
| Vue (composable) | 0.078 | 6.74 | 0.019 | 1.39 | 0.019 | 2.96 |
| Svelte (action) | 0.046 | 5.34 | 0.017 | 1.34 | 0.017 | 2.89 |

Ordering is framework overhead, not Lisse: the component rows carry a
wrapper element and its render, the composable and action rows attach to an
existing node. `autoEffects: false` takes roughly a third off Mount (React
10.4 ms at n=100) because nothing extracts CSS.

Adding an `innerBorder` mounts an SVG overlay per element, and that is where
the numbers stop being useful as absolutes: n=1 costs 0.07-0.36 ms across
all four adapters, but n=100 lands at 110-173 ms — superlinear, ~1.1-1.7 ms
per element against 0.1 ms at n=1. The cost is happy-dom's CSSOM and DOM
mutation on an anchor that accumulates 100 overlay `<svg>` subtrees, not the
library's own work; the same 500-element case in a real browser stays inside
the frame budget (`tests/browser-smoke/resize-storm.test.tsx`). Compare
overlay cells against each other at equal n, never against a frame budget.

The eight SSR cases render real markup (`<div style="position:relative"><div
style="border-radius:12px">…`, the library's SSR `border-radius` fallback
derived per instance at render time) with no DOM, observer, or layout read
anywhere in the path.

### What the 2026-07-09 tables got wrong

They were removed rather than updated, because the harness they came from
did not measure what they claimed.

- All 192 adapter cases timed a framework mount plus an early return. Layout
  was stubbed only through `getBoundingClientRect`, so `getLayoutSize` fell
  through to happy-dom's `offsetWidth` of 0 and every sync bailed before
  generating a clip-path: `data-state` never reached `"ready"`. On the same
  machine, back to back, Resize at n=100 went from 0.147 ms to 141 ms once
  the sync actually ran.
- The four `generatePath` single-corner cases and the four 100-batch cases
  timed corner-cache hits rather than curve builds. Repeating one identical
  call pins the cache at a single entry; the batch's key set is 20 entries
  against 64 slots, because size reaches the cache key only through the
  rounding budget `min(w, h) / 2` — its 20 heights were 20 keys and its 50
  widths were none, so it was never the "distinct dimensions defeat the
  cache" case it was documented as.
