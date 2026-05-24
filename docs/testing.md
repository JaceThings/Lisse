# Testing Lisse

This document is a contributor reference for the test infrastructure.
For project-level architecture see [README.md](../README.md); for the
curve maths see [docs/curves.md](./curves.md).

## What the suite proves

Lisse's tests are layered so that each layer answers a different
question. If a layer's question is "is the math correct", another
layer should answer "did it change". They are not the same.

| Layer | File pattern | Question it answers |
|---|---|---|
| Pinned cases | `packages/core/__tests__/*.test.ts` | Hand-picked geometric cases (Apple-equivalent squircle, endpoint pins, budget clamps). |
| Property tests | `packages/core/__tests__/invariants.test.ts` | "Do the geometric invariants hold for random inputs?" 6 properties × 500 cases per run. |
| Reference shape | `packages/core/__tests__/reference-shape.test.ts` | "Does the cubic Bézier approximation match the analytic curve?" For superellipse and clothoid. |
| Golden snapshots | `packages/core/__tests__/snapshots.test.ts` | "Did the exact `d` string change?" 40 curated cases, one block per curve type. |
| Runtime harness | `packages/*/​__tests__/runtime-harness.test.{ts,tsx}` | "Does ResizeObserver + rAF batching, prop updates, and cleanup work correctly per adapter?" |
| Adapter contract | `packages/*/​__tests__/contract.test.{ts,tsx}` | "Do React / Vue / Svelte feed the same props into core?" Shared fixture, 26 cases × 3 adapters. |
| Browser smoke | `tests/browser-smoke/*.test.tsx` | "Does Lisse hold up on real browsers at 500-element scale?" Main / tagged-release only. |
| Consumer smoke | `tests/consumer-smoke/*.{mjs,cjs}` | "Does the *packed* tarball install and import cleanly?" |
| Perf | `benchmarks/*.bench.ts` | "Did the JS hot path regress?" CodSpeed instruction-count, no wall-clock noise. |
| Size | `package.json#size-limit` | "Did the bundle size regress?" Per-package brotli-budgeted. |
| Dead code | `knip.json` | "Are there unused exports / files / deps?" |

## Running tests

```bash
pnpm test                # all projects (core / react / vue / svelte)
pnpm test --project=core # one project
pnpm coverage            # with coverage report (writes coverage/lcov.info)
pnpm bench               # benchmarks via vitest + CodSpeed plugin
pnpm size                # bundle-size check (rebuilds dist/ first)
pnpm knip                # dead-code check
pnpm consumer-smoke      # pack tarballs, lint, install in fixture, import
```

Browser smoke is heavy and is wired only in CI on main / tags. To run
locally: `cd tests/browser-smoke && pnpm test`. First run needs
`pnpm exec playwright install chromium webkit firefox`.

## The runtime harness pattern

`packages/core/__tests__/harness/runtime-harness.ts` installs a stub
`ResizeObserver` and a controllable `requestAnimationFrame` queue. Tests
that touch the resize / rAF batching path use it like this:

```ts
import { installHarness, uninstallHarness } from "../../core/__tests__/harness/runtime-harness.ts";

beforeEach(() => { h_ = installHarness(); });
afterEach(() => { uninstallHarness(); });

it("batches resize entries", () => {
  // ...mount, stub layout dimensions...
  h_.deliverResize(el, 200, 100);
  h_.deliverResize(el, 250, 120); // dedupes into the same rAF
  expect(h_.pendingRafCount()).toBe(1);

  h_.flushRaf(); // synchronously runs the rAF callback
  expect(el.style.clipPath).not.toBe("");
});
```

The harness ensures deterministic timing without `await new Promise(setTimeout)`.
The defect class it catches: missed cleanup, double subscriptions,
batching bugs, rAF leaks. See `packages/react/__tests__/runtime-harness.test.tsx`
for a fully worked example.

## The contract-test model

Three adapter packages all consume `@lisse/core`. The contract: each
wrapper feeds the same props, defaults, dimensions, and effects into
core. There is no independent oracle — these are contract tests, not
parity tests in the strict sense.

The matrices live in `packages/core/__fixtures__/contract.ts`:

- `PROP_MATRIX` — 20 cases spanning curve types × radii + layout
  variations (non-square, asymmetric per-corner, oversized, tiny).
- `EFFECTS_MATRIX` — 6 cases covering border / shadow / combined.

Each adapter's `contract.test.{ts,tsx}` iterates these, renders via
the adapter, reads `el.style.clipPath`, unwraps the `path("...")`, and
compares to `generatePath(width, height, corners)`. Drift in any
adapter (and not in the others) is the bug signal.

### Adding a contract case

1. Add an entry to `PROP_MATRIX` or `EFFECTS_MATRIX` with a unique
   `name`. Use `name = "<curve>_<axis>_<value>_<size>"` for greppability.
2. Run `pnpm test`. All three adapters run the case automatically.

## Snapshot workflow

`snapshots.test.ts` stores ~40 curated golden paths as keyed JSON
objects (one snapshot per curve family). Snapshots are an API lock on
identity — they don't prove correctness, only that the output didn't
change unintentionally.

```bash
pnpm test -- snapshots                    # verify
pnpm test -- snapshots -u                 # regenerate (intentional change)
```

Snapshot diffs are the PR review surface. A 10-line diff in
`squircle.snap` means a real geometric change — review it like any
code change.

Canonicalisation: paths flow through `svgpath(...).abs().round(4)`
before storage. Cosmetic float drift never churns a snapshot; an
actual geometry change always does.

## CodSpeed (perf gate)

`@codspeed/vitest-plugin` wraps every `bench()` in instruction
counting via Valgrind. Local `pnpm bench` runs tinybench's wall-clock
loop (the plugin is a no-op without the CI runner).

**Soft launch:** CodSpeed posts a per-PR comment with the per-bench
delta. **No hard fail** until the false-positive rate is known. To
calibrate before flipping the gate:

1. Run each bench 10-20 times against an unchanged base commit.
2. Compute the empirical p99 absolute delta as the noise floor.
3. Set the fail threshold to `max(2 × p99_noise, 1%)`.
4. Validate the threshold against 10-15 boring PRs.
5. Any bench needing a threshold above ~5% is unstable or low-value
   — fix the bench, simplify it, or drop it from gating.

Wall-clock heuristics ("wait 8 weeks") aren't calibration — measure.

CodSpeed *measures* JS hot paths only — it does **not** capture
paint, layout, compositor, or browser-specific rendering. Real perf
is the job of the browser-smoke run, which measures frame times under
6× CPU throttle on Chromium.

### Adding a bench

Drop a new `*.bench.ts` in `benchmarks/`. Vitest auto-discovers.
CodSpeed picks it up on the next CI run.

## Browser-smoke local run

```bash
cd tests/browser-smoke
pnpm exec playwright install chromium webkit firefox
pnpm test
```

The visual-snapshots test writes screenshots to
`tests/browser-smoke/screenshots/` for Argos upload in CI. Locally
they're disposable.

## Auto-effects contract (mount-time only)

`extractAndStripEffects` reads computed border/shadow **once at mount**.
It does **not** re-extract on:

- theme tokens / CSS variable updates
- dark mode flips
- ancestor class changes that affect computed style
- media query transitions

This is intentional: a `MutationObserver` on the host can't see
ancestor changes, and continuous `getComputedStyle` polling burns
budget. Consumers who change theme tokens at runtime must re-mount
the affected elements.

An imperative `refresh()` API for in-place re-extraction is planned
for **v0.4**. Track the issue in the repo's Issues tab.

Tests for re-extraction are deliberately omitted because the contract
is "no re-extraction." Tests would be premature until the contract
changes.

## When a test fails

| Failure | Likely cause | Fix shape |
|---|---|---|
| `contract.test.*` red on one adapter only | That adapter's wrapper is dropping a prop or measuring differently | Diff the adapter's hook/composable/action against core's `generatePath` |
| `runtime-harness.test.*` red | Batching / cleanup / dedup logic in `observe-resize.ts` | Re-read `flush()` and the unsubscribe path |
| `snapshots.test.ts` red | Geometry change — intentional or accidental | If intentional, `pnpm test -u`. If accidental, find the regression |
| `invariants.test.ts` red | Seed logged with the failure: re-run with that seed to reproduce | Investigate the specific seed-derived input |
| `reference-shape.test.ts` red | Cubic Bézier drift from analytic curve | Check the builder's Bézier control point math |
| `consumer-smoke` red on `publint` or `attw` | `package.json#exports` or types regression | Fix the manifest, don't paper over with ignores |
| `size-limit` red | Bundle bloat | Investigate; if intentional, raise the budget with a reason in the commit |
| Browser smoke red | Real-browser regression — likely Safari-specific | Reproduce locally with `cd tests/browser-smoke && pnpm test`. Use the parked BrowserStack OSS credentials if it's iOS-only |
| `knip` red on unused exports | A removed feature left dangling code | Delete the dead exports |
| CodSpeed >5% regression (post soft-launch) | Hot path slower | Profile via the named bench; revert or justify with a benchmark-backed reason |

## BrowserStack OSS (parked credentials)

Lisse has an approved [BrowserStack Open Source plan](https://www.browserstack.com/open-source).
Credentials are stored in 1Password under "BrowserStack — Lisse OSS".

**Do not wire up CI integration speculatively.** The trigger to wire
it up is the first user-reported iOS-Safari bug that's unreproducible
on Playwright's desktop WebKit. At that point, add a single
BrowserStack Automate job that reproduces the bug, gated on tagged
releases only. Until that day, the credentials sit unused.

## Test count snapshot

After all blueprint requirements landed:

- 411 unit tests (core / react / vue / svelte combined)
- 9 CodSpeed benches
- ~6 browser-smoke cases × 3 browsers = ~18 browser assertions
- 4 consumer-smoke imports
- 5 snapshot grids (one per curve family + one mixed)
- 6 property tests × 500 random cases = 3,000 fast-check assertions per run
- 8 reference-shape error tests

Coverage is a tracking metric, posted via Codecov, **not** a hard gate.
