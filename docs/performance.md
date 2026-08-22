# Performance

Lisse generates SVG path strings in JS — no WASM, no workers, no dependencies. An internal 64-entry LRU cache memoises the shape-only computation, keyed on `radius`, `smoothing`, `curve`, `exponent` and the per-corner rounding budget. That budget is `min(width, height) / 2` for uniform radii, so two elements share a cache entry when their *constrained* side matches: 200×100 and 250×100 hit, 200×100 and 200×120 miss.

Numbers below are measured via [`pnpm bench`](../benchmarks) on 2026-08-16, Node v26.7.0 on an Apple M4 Max, machine otherwise idle. Both regimes are given because they differ by up to 5×, and a page's mix depends on whether its elements share a constrained side.

## Single corner

One `generatePath()` call (200×100 box, smoothing 0.6):

| Curve | Cold (cache miss) | Cached |
|---|---|---|
| `arc` | ~1.0 µs | ~0.70 µs |
| `squircle` (default) | ~2.5 µs | ~0.67 µs |
| `superellipse` | ~3.6 µs | ~0.68 µs |
| `clothoid` | ~3.7 µs | ~0.64 µs |

The cached column is flat across curves because a hit hands back memoised segment strings and the curve never runs; the cold column is the real per-curve build cost.

## 500 corners in one frame

What a resize tick on a busy page costs, all 500 elements sharing one corner config:

| Curve | Cached (equal short side) | Cold (500 distinct short sides) |
|---|---|---|
| `arc` | ~0.30 ms | ~0.42 ms |
| `squircle` | ~0.28 ms | ~0.58 ms |
| `superellipse` | ~0.29 ms | ~0.87 ms |
| `clothoid` | ~0.28 ms | ~0.86 ms |

A grid of equal-height cards reflowing is the cached column. A masonry layout, or any list whose rows differ in height, is the cold one.

**Effects setup** (`createSvgEffects` + first update with a border): ~160 µs per element, one-shot at mount.

## Computed-style budget

Layout reads cost more than the path maths, so they are counted. A squircled element costs **2 `getComputedStyle` reads to mount** — one for auto-extraction of its CSS border and shadow, one for its first resize flush — and **1 read per resize flush** after that. With `autoEffects: false` there is nothing to extract, so Vue and Svelte mount at 1 read; React and Octane stay at 2, because their every-commit sync has no extracted size to reuse and measures for itself so the clip-path lands before the first paint.

A `ResizeObserver` notification reporting a box the last flush already measured is dropped without a read, so an element that only receives the observer's guaranteed initial observation never gets measured twice for the same size.

The flush itself still takes a live measurement rather than trusting the notification's `borderBoxSize`. That box is already a frame stale by the time the batched flush runs, and an element mid-tween would then be clipped to a stale-larger box, letting its own edge cut the corners off.

Measured in real Chromium, mounting a bordered card that contains four small effect-free child dots:

| Element | Before | After |
|---|---|---|
| Bordered card | 5 reads | 2 reads |
| Each child dot | 4 reads | 2 reads |

## What this means in practice

At 60 fps you have 16.7 ms per frame. A page with 500 smooth-cornered squircles re-computes all clip-paths in **0.28-0.87 ms per resize tick** depending on whether their corner shapes are cached — 2-5% of a frame. On low-end mobile (3-5× slower JS) even the cold case stays inside budget.

The JS hot path doesn't include browser paint, layout, or compositor work, which dominates on complex pages. Lisse minimises layout cost by setting `clip-path` and reading layout once per `ResizeObserver` tick (shared singleton observer across all elements), and it skips a tick entirely when the observer reports a size it already measured. The cache scales with config diversity, not element count — but the per-corner budget is size-derived, so 5,000 elements perform like 50 only while they also share a constrained side.

## Bench locally

```sh
pnpm bench           # full suite: core, four adapters, SSR (268 cases, ~10 min)
```
