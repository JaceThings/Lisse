# Performance

Lisse generates SVG path strings in JS — no WASM, no workers, no dependencies. An internal 64-entry LRU cache memoises the shape-only computation (everything that depends on `radius`, `smoothing`, `curve`, `exponent`, and the per-corner budget), so identical corner configs on different-sized elements skip the math entirely.

Numbers below are measured via [`pnpm bench`](../benchmarks) on an M-series Mac with Node 22.

## Single corner

One `generatePath()` call (200×100 box, radius 24, smoothing 0.6):

| Curve | Per call |
|---|---|
| `arc` | ~1.3 µs |
| `squircle` (default) | ~1.5 µs |
| `superellipse` | ~1.4 µs |
| `clothoid` | ~1.4 µs |

## 500 corners in a tight loop

What a resize event on a busy page costs (varied widths/heights, shared corner config — the realistic SPA case):

| Curve | 500 corners |
|---|---|
| `arc` | ~0.78 ms |
| `squircle` | ~0.80 ms |
| `superellipse` | ~0.78 ms |
| `clothoid` | ~0.78 ms |

**Effects setup** (`createSvgEffects` + first update with a border): ~130 µs per element, one-shot at mount.

## Computed-style budget

Layout reads cost more than the path maths, so they are counted. A squircled element costs **2 `getComputedStyle` reads to mount** — one for auto-extraction of its CSS border and shadow, one for its first resize flush — and **1 read per resize flush** after that. With `autoEffects: false` there is nothing to extract, so Vue and Svelte mount at 1 read; React stays at 2, because its every-commit sync has no extracted size to reuse and measures for itself so the clip-path lands before the first paint.

A `ResizeObserver` notification reporting a box the last flush already measured is dropped without a read, so an element that only receives the observer's guaranteed initial observation never gets measured twice for the same size.

The flush itself still takes a live measurement rather than trusting the notification's `borderBoxSize`. That box is already a frame stale by the time the batched flush runs, and an element mid-tween would then be clipped to a stale-larger box, letting its own edge cut the corners off.

Measured in real Chromium, mounting a bordered card that contains four small effect-free child dots:

| Element | Before | After |
|---|---|---|
| Bordered card | 5 reads | 2 reads |
| Each child dot | 4 reads | 2 reads |

## What this means in practice

At 60 fps you have 16.7 ms per frame. A page with 500 smooth-cornered squircles re-computes all clip-paths in **under 1 ms per resize tick** — about 5% of a frame, leaving plenty of room for paint and everything else. On low-end mobile (3-5× slower JS), the same workload stays inside budget.

The JS hot path doesn't include browser paint, layout, or compositor work, which dominates on complex pages. Lisse minimises layout cost by setting `clip-path` and reading layout once per `ResizeObserver` tick (shared singleton observer across all elements). The cache scales with config diversity, not element count — a page with 5,000 elements sharing one corner config performs identically to a page with 50.

## Bench locally

```sh
pnpm bench           # full suite (core + adapter)
```
