# `@lisse` benchmarks

Micro-benchmarks for the whole workspace's hot paths — the `core`
path/effects engine, the React, Vue, and Svelte adapters, and the SSR
render path. The suite measures **JS-only cost** under varying instance
counts and effect configurations. Results are summarised in
[`docs/performance.md`](../docs/performance.md).

## What this measures

The suite spans several files: `core.bench.ts` (the DOM-free path and
effects engine), the three adapter benches
(`use-smooth-corners.bench.ts` for React,
`use-smooth-corners-vue.bench.ts`, `use-smooth-corners-svelte.bench.ts`),
and `ssr.bench.ts` (server render). The adapter benches share a common
grid, each driving one of three hot paths:

- **Resize**: deliver a `ResizeObserver` callback to every mounted
  element and wait for every per-element sync to finish.
- **Mount**: render _N_ `<SmoothCorners />` instances from scratch and run
  the first sync (clip-path apply + initial SVG overlay).
- **Update**: mutate the `corners.radius` prop on every instance and
  measure the re-sync cost (commit + second `useIsoLayoutEffect`).

The suite exercises this grid:

| Dimension       | Values                                        |
| --------------- | --------------------------------------------- |
| Instance counts | 1, 10, 50, 100                                |
| `autoEffects`   | `true`, `false`                               |
| Effects present | `none`, `innerBorder: { width, color, opacity }` |

That's 16 cells times 3 hot paths = **48 bench cases**, each sampled for
~1 second of wall-clock time (tinybench defaults under vitest-bench).

## What this does NOT measure

- **Browser paint**. `happy-dom` is a DOM implementation with no rendering
  pipeline, so none of the costs associated with style recalc, compositing,
  or GPU work show up. These numbers are the floor — real-device timings
  will be higher once paint is included.
- **Real `ResizeObserver` scheduling**. The bench installs a controllable
  stub and fires callbacks synchronously. This isolates the adapter's JS
  work from the browser's frame-aligned dispatch.
- **Real layout**. `getBoundingClientRect` is stubbed to return a
  constant 200x100 rect; clip-path math is deterministic regardless of
  actual node layout.

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
- **happy-dom layout approximation**. No layout engine runs, so the
  adapter never sees genuinely invalidated boxes. The bench simulates
  "layout happened" by firing the observer stub.
- **Node-only**. These numbers come from V8 on Node under macOS. They're
  representative of user-agents that ship V8 (Chromium, Edge) but not
  direct proxies for Safari or Firefox.
- **Not wired into CI**. This suite is informational, not a regression
  gate.

## Grid adjustments

None. The full 4 x 2 x 2 x 3 = 48-case grid completes in a few minutes on
a modern laptop; no dimensions were reduced.

## Results (2026-07-09, Node v26.4.0 on macOS Darwin 25.5.0)

See [`docs/performance.md`](../docs/performance.md) for narrative
analysis and rules of thumb. The tables below are the raw per-case means
in milliseconds. All cases sampled below ±2.6% rme; none needed a re-run.

### Mount: initial render + first sync

| n | auto eff=none | auto eff=border | manual eff=none | manual eff=border |
|---|---|---|---|---|
| **1** | 0.0741 ms | 0.234 ms | 0.0644 ms | 0.218 ms |
| **10** | 0.593 ms | 2.50 ms | 0.400 ms | 2.33 ms |
| **50** | 3.37 ms | 23.8 ms | 2.11 ms | 22.9 ms |
| **100** | 8.51 ms | 72.0 ms | 4.84 ms | 71.7 ms |

### Resize: single ResizeObserver callback tick

| n | auto eff=none | auto eff=border | manual eff=none | manual eff=border |
|---|---|---|---|---|
| **1** | 0.0003 ms | 0.0004 ms | 0.0003 ms | 0.0004 ms |
| **10** | 0.0024 ms | 0.0029 ms | 0.0024 ms | 0.0029 ms |
| **50** | 0.0136 ms | 0.0154 ms | 0.0129 ms | 0.0159 ms |
| **100** | 0.0277 ms | 0.0351 ms | 0.0247 ms | 0.0354 ms |

### Update: one `corners.radius` prop change

| n | auto eff=none | auto eff=border | manual eff=none | manual eff=border |
|---|---|---|---|---|
| **1** | 0.0127 ms | 0.0128 ms | 0.0104 ms | 0.0127 ms |
| **10** | 0.0832 ms | 0.0860 ms | 0.0672 ms | 0.0849 ms |
| **50** | 0.397 ms | 0.411 ms | 0.316 ms | 0.407 ms |
| **100** | 0.816 ms | 0.814 ms | 0.616 ms | 0.818 ms |

### Core `generatePath` (from `core.bench.ts`)

Single call unless noted; per-corner curve builds are memoised, so batches
below reflect distinct dimensions defeating that cache. Capsule and blend
are squircle-only regimes (see `curves/capsule.ts`, `curves/blend.ts`).

| case | mean |
|---|---|
| single-corner 200×100 r=24 — arc | 0.0018 ms |
| single-corner 200×100 r=24 — squircle | 0.0020 ms |
| single-corner 200×100 r=24 — superellipse | 0.0019 ms |
| single-corner 200×100 r=24 — clothoid | 0.0019 ms |
| 100-batch — arc | 0.205 ms |
| 100-batch — squircle | 0.212 ms |
| 100-batch — superellipse | 0.211 ms |
| 100-batch — clothoid | 0.212 ms |
| capsule 300×100 r=50 s=0.6 (full-pill) | 0.0028 ms |
| blend band 300×130 r=50 s=0.6 | 0.0041 ms |
| resize sweep h=100..220 r=h/2 (61 calls, cache-defeating) | 0.176 ms |
| `createSvgEffects` + update cycle | 0.128 ms |
