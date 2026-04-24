# `@lisse/react` benchmarks

Micro-benchmarks for the React adapter's hot paths. The suite measures
**JS-only cost** under varying instance counts and effect configurations.
Results are consumed by the wiki's `Performance.md` page.

## What this measures

Each bench case drives one of three hot paths:

- **Mount**: render _N_ `<SmoothCorners />` instances from scratch and run
  the first sync (clip-path apply + initial SVG overlay).
- **Resize**: deliver a `ResizeObserver` callback to every mounted
  element and wait for every per-element sync to finish.
- **Update**: mutate the `corners.radius` prop on every instance and
  measure the re-sync cost (commit + second `useIsoLayoutEffect`).

The suite exercises this grid:

| Dimension       | Values                                        |
| --------------- | --------------------------------------------- |
| Instance counts | 1, 10, 50, 100, 500                           |
| `autoEffects`   | `true`, `false`                               |
| Effects present | `none`, `innerBorder: { width, color, opacity }` |

That's 20 cells times 3 hot paths = **60 bench cases**, each sampled for
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

- **mean** — average time per op in ms. Primary signal.
- **hz** — ops per second (inverse of mean).
- **p99 / p999** — tail latency. Large gaps between `mean` and `p99`
  usually indicate GC pauses mid-sample.
- **rme** — relative margin of error. Treat any result over ~5% as noisy
  and re-run before drawing conclusions.
- **samples** — how many iterations fed the stats. Low sample counts
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

None. The full 5 x 2 x 2 x 3 = 60-case grid completes in a few minutes on
a modern laptop; no dimensions were reduced.

## Results (2026-04-24, Node v25.9.0 on macOS Darwin 25.4.0)

See the wiki `Performance` page for narrative analysis and rules of
thumb. The tables below are the raw per-case means in milliseconds.

### Mount -- initial render + first sync

| n | auto eff=none | auto eff=border | manual eff=none | manual eff=border |
|---|---|---|---|---|
| **1** | 0.158 ms | 0.407 ms | 0.084 ms | 0.313 ms |
| **10** | 1.30 ms | 3.95 ms | 0.519 ms | 3.11 ms |
| **50** | 6.74 ms | 30.6 ms | 2.44 ms | 21.9 ms |
| **100** | 15.0 ms | 85.6 ms | 4.89 ms | 56.2 ms |
| **500** | 142 ms | 1601 ms | 25.1 ms | 898 ms |

### Resize -- single ResizeObserver callback tick

| n | auto eff=none | auto eff=border | manual eff=none | manual eff=border |
|---|---|---|---|---|
| **1** | 0.016 ms | 0.046 ms | 0.011 ms | 0.040 ms |
| **10** | 0.161 ms | 0.446 ms | 0.103 ms | 0.393 ms |
| **50** | 0.806 ms | 2.30 ms | 0.516 ms | 2.01 ms |
| **100** | 1.64 ms | 4.82 ms | 1.03 ms | 4.02 ms |
| **500** | 8.39 ms | 31.1 ms | 5.32 ms | 27.0 ms |

### Update -- one `corners.radius` prop change

| n | auto eff=none | auto eff=border | manual eff=none | manual eff=border |
|---|---|---|---|---|
| **1** | 0.029 ms | 0.061 ms | 0.021 ms | 0.054 ms |
| **10** | 0.243 ms | 0.553 ms | 0.168 ms | 0.487 ms |
| **50** | 1.18 ms | 2.83 ms | 0.801 ms | 2.50 ms |
| **100** | 2.44 ms | 5.76 ms | 1.63 ms | 5.17 ms |
| **500** | 12.7 ms | 37.7 ms | 8.36 ms | 32.8 ms |
