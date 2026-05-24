# Lisse Testing Strategy — Blueprint (v2, post-spar)

## Context

Lisse is a multi-package smooth-corner library: `@lisse/core` (pure TypeScript, generates SVG path strings — 206 tests, ~1,765 LOC), `@lisse/react` (35 tests across `smooth-corners.test.tsx` and `ssr.test.tsx`), `@lisse/vue` (15 tests), and `@lisse/svelte` (6 tests). **Total existing suite: 262 tests.** Output is deterministic, math-based, and almost entirely string-shaped — a curve becomes a `d` attribute. The library is on the cusp of being recommended for production use; the `feat/curve-types` branch (22 commits ahead of main) adds four curve types (arc, squircle, superellipse, clothoid) and is the proximate trigger for hardening the test surface before it lands.

The current suite is unevenly distributed: core's pure math is well-covered, the React adapter has solid component-level tests but no contract against core, the Vue adapter has thin component tests with no parity guarantee, Svelte is barely tested, and there is no performance baseline, no cross-browser story, no visual regression coverage, no shared fixture exercising all three adapters with the same inputs, and no test that the *built and packed* artifacts work end-to-end. The benchmarks/ folder has a vitest bench config but it doesn't run in CI.

External pressure (Ayresia): local manual testing on top-spec devices is insufficient evidence the library works for real consumers — at scale (hundreds of corners on one page), on low-end hardware, with hardware acceleration disabled, on Safari (where this repo already has known SVG-scale and shadow-rendering quirks documented).

Research surveyed eight comparable libraries (tldraw, framer-motion, radix-ui, react-spectrum, satori, konva, zag.js, tanstack-query) to identify which testing practices actually catch bugs in the field versus which are gold-plating. The strategy was then sparred against a second model (Codex / gpt-5.5, xhigh reasoning) for two rounds, which materially revised the weighting away from snapshot volume and toward runtime behaviour and packaging.

## Problem

Three concrete failure modes the current suite cannot detect:

1. **ResizeObserver / rAF timing bugs in the runtime.** `observe-resize.ts` batches by `requestAnimationFrame`. The bugs Lisse keeps tripping over — duplicate subscriptions, missed cleanup, observer thrashing, effect-toggle restore failures, prop-update flushes — all live in this layer. The current tests mock `ResizeObserver` as a no-op and assert nothing about *timing*. A regression where a resize update happens twice per frame, or never, would pass every existing test.

2. **Packaging regressions ship invisibly.** Tests alias `@lisse/core` to source. Consumers import the built artifact through `package.json#exports` — `dist/index.js` (ESM), `dist/index.cjs` (CJS), `dist/index.d.ts` (types). A change to `tsup` config, `files`, `exports`, or `sideEffects` can break consumers without any source test failing. There is no consumer-facing smoke.

3. **Geometric regressions in the curve grid, on dimensions snapshots don't catch.** Property tests pin the endpoint; snapshots could pin the string. But "the curve is correct" is a separate question from "the curve hasn't changed." For superellipse and clothoid, there is an *analytic* reference shape — sampling points along the generated path and comparing to the closed-form curve catches drift that endpoint tests miss and snapshots can't prove.

Additional gaps closed in the same pass: no shared contract between adapters; no Safari/WebKit coverage despite repo-documented quirks; no perf signal in CI; no documented testing model for contributors.

## Requirements

### R1 — Deterministic ResizeObserver + rAF harness (highest priority)
- New file: `packages/core/__tests__/observe-resize-harness.test.ts` exposes (or uses, if already extractable) a test harness that combines a stub `ResizeObserver` (records callback + observed targets, exposes a `.deliver(entries)` method) with a controllable rAF queue (`flushRaf()`).
- Each adapter package adds **5 update-behaviour tests** using this harness:
  - **Resize batching**: deliver two `ResizeObserver` entries before any rAF tick; assert exactly one path update fires after `flushRaf()`.
  - **Prop-update flush**: change `radius` prop; assert the `<clipPath>` `d` attribute updates to the new geometry within the same tick.
  - **Effect toggle**: flip `autoEffects` from `true` to `false`; assert inline styles are restored, overlay SVG is removed.
  - **Cleanup on unmount**: unmount the component; assert no remaining `ResizeObserver`, no leaked overlay, no leftover inline styles.
  - **Duplicate-subscribe safety**: mount the same element twice (via React `<StrictMode>` double-invocation pattern); assert only one observer is attached and one update fires per resize.
- Three adapters × 5 tests = **15 new harness-driven tests.**

### R2 — Packed-tarball consumer smoke (highest ROI new addition)
- New CI job `consumer-smoke` runs on every PR. Steps:
  1. `pnpm pack` each package (`@lisse/core`, `@lisse/react`, `@lisse/vue`, `@lisse/svelte`) — produces `.tgz` tarballs.
  2. Run `publint <tarball>` on each — fails on bad `exports`/`files`/`sideEffects`/missing types/etc.
  3. Run `attw --pack <tarball>` (Are The Types Wrong?) on each — fails on broken type resolution across `node10` / `node16` / `bundler` resolution modes.
  4. A fixture project at `tests/consumer-smoke/` installs the four tarballs as dependencies (via local file paths) and runs four micro-tests:
     - ESM `import { generatePath } from '@lisse/core'` → call it, assert non-empty string.
     - CJS `const { generatePath } = require('@lisse/core')` → same.
     - Subpath import (if any are exported, e.g. `@lisse/core/curves`) → same.
     - SSR render: `renderToString(<SmoothCorners corners={{ radius: 12 }} />)` from `@lisse/react` → assert HTML contains the expected SVG.
- Total: **3 tools (`pnpm pack`, `publint`, `attw`) + 4 consumer micro-tests.**
- This catches the failure class that source-aliased tests cannot — `files`, `exports`, `.d.ts` emission, CJS/ESM dual-build correctness, tarball contents.

### R3 — Reference-shape error tests for superellipse and clothoid
- New file: `packages/core/__tests__/reference-shape.test.ts`.
- For superellipse at `(exponent, radius)` ∈ {(2, 40), (4, 40), (4, 100), (5, 60)}:
  - Sample 32 points along the generated TR-quadrant path via the browser's `SVGPathElement.getPointAtLength` shim (use `svg-path-properties` package in Node).
  - Compute the analytic point on `|x/R|^n + |y/R|^n = 1` at the same arc-length fraction.
  - Assert max Euclidean error < `R × 0.01` (1% of radius).
- For clothoid at `(smoothing, radius)` ∈ {(0.3, 40), (0.6, 40), (0.6, 100), (1.0, 50)}:
  - Sample 32 points along the generated path.
  - Compute the closed-form clothoid via the same `integrateClothoid` already in `packages/core/src/curves/integrate.ts` at the same arc-length fractions.
  - Assert max Euclidean error < `R × 0.01`.
- **8 reference-shape tests total.** This is the strongest "is the math correct" test the suite can have for these curves — stronger than snapshots, stronger than endpoint pins.

### R4 — Curated golden snapshots (not the 800-grid)
- `packages/core/__tests__/snapshots/curves.snap.ts` contains a hand-picked set: **~40 cases total, ~10 per curve type**, focused on:
  - Boundaries: `radius=0`, `smoothing=0`, `smoothing=1`, oversized radius (clamps to half-side).
  - Layout-level cases (these are the ones snapshots actually earn their keep on): non-square boxes (200×100), asymmetric per-corner radii (`{TL: 10, TR: 40, BR: 10, BL: 40}`), oversized radii that trigger budget clamping, mixed curve types per corner.
  - The squircle "Apple-equivalent" canonical case (`smoothing=0.6`, default radius) as a byte-level lock — shipped output here is effectively part of the public spec.
- Canonicalized via `svgpath` before storage; `expect.addSnapshotSerializer` registered in `vitest.setup.ts`.
- **Snapshots are an API lock on identity, not a proof of correctness.** Correctness comes from R3 + R5.

### R5 — Semantic geometric properties via fast-check
- `packages/core/__tests__/invariants.test.ts` generates **500 random** `(curveType, radius, smoothing, exponent)` tuples per property:
  - **Monotonic progress**: parsing the TR-quadrant path, x and y are monotonically non-decreasing along the curve.
  - **No self-crossing**: no point on the sampled curve lies within ε of any non-adjacent point.
  - **Symmetry**: TR mirrored across `y=x` matches BL within float tolerance; TR mirrored across `x=p` matches TL.
  - **Scale invariance**: scaling all inputs by `k` scales the output path by `k` exactly.
  - **Tangent direction at endpoints**: numerical derivative at the start = (0, 1); at the end = (1, 0), within ε.
  - **Budget clamping**: when natural `p` would exceed the corner budget, returned `p` is exactly `budget`; when natural `p` fits, returned `p` is the natural value.
- **6 properties × 500 cases = 3,000 invariant assertions per test run.** fast-check seed logged on failure.

### R6 — Adapter contract tests (formerly "parity")
- A shared fixture at `packages/core/__fixtures__/contract.ts` defines `PROP_MATRIX: Array<{ name; props }>` with **20 entries** (down from 24) and `EFFECTS_MATRIX` with **6 entries** (down from 8). Pruned to the cases most likely to surface contract drift.
- Each adapter package adds a `contract.test.{ts,tsx}` that:
  - Iterates `PROP_MATRIX`, renders, reads `path.getAttribute('d')`, asserts equality with core's output for the same inputs.
  - Iterates `EFFECTS_MATRIX`, renders, normalizes generated IDs in `<defs>`, asserts equality of the normalized HTML subtree.
- These are renamed from "parity" because the framing was wrong. They prove **each adapter feeds the same props, defaults, dimensions, and effects into core** — a contract check, not a parity check. (Real "parity" would require an oracle independent of core, which doesn't exist.)
- 3 adapters × (20 + 6) = **78 contract assertions.**

### R7 — CodSpeed, soft-launched
- CodSpeed wired via `@codspeed/vitest-plugin` and the official GitHub Action. Requires Vitest 3.2+ (current repo: 3.0; bump required).
- 9 benches: 4 single-corner `generatePath` (one per curve type) + 4 500-element batch `generatePath` + 1 `createSvgEffects`.
- **PR comment only, no hard fail, for the first 8 weeks** (8 PRs minimum) while thresholds calibrate. After that, per-benchmark thresholds may be enabled if false-positive rate is acceptable.
- Documentation says clearly: "CodSpeed guards JS hot-path regressions. It does **not** measure paint, layout, compositor, or browser-specific rendering performance. Real device behaviour is measured by the browser-smoke job on main."

### R8 — Browser smoke on main (Chromium + WebKit + Firefox)
- One Vitest browser test (`packages/react/__tests__/browser-smoke.test.tsx`) using `@vitest/browser` with the Playwright provider.
- Browsers: **Chromium, WebKit, and Firefox** — Firefox added because it's free in the Playwright matrix (no marginal install or maintenance cost) and provides a third independent rendering engine. WebKit covers documented Safari-specific SVG scale and shadow quirks.
- Tests:
  - Render 500 `<SmoothCorners />` elements, dispatch 60 resize events over 1s, assert median frame time < 16.7ms (60fps budget).
  - Same with `CDP.Emulation.setCPUThrottlingRate({ rate: 6 })`; assert median < 33ms (30fps budget for low-end). (Chromium only — CDP throttling isn't available in WebKit/Firefox.)
  - 4 visual snapshots (`toHaveScreenshot`) of a default-config square per curve type, `maxDiffPixelRatio: 0.02`.
  - One focus-ring smoke: a focused `<button>` inside a `<SmoothCorners>` element; assert focus outline is visible (not clipped by `clip-path`). This is the one a11y test that earns its place.
- Job runs on **push-to-main and tagged releases only**, not per-PR. PR feedback loop stays under 2 minutes.

### R9 — Test infrastructure consolidation
- Migrate from single `vitest.config.ts` to **Vitest projects** (3.2 API), named: `core`, `react`, `vue`, `svelte`. Use `extends: true` explicitly (Vitest project config inheritance has sharp edges).
- **Vitest dep bump: `^3.0.0` → `^3.2.0`** in root `package.json`. Required for both projects API and CodSpeed plugin.
- One `pnpm test` runs all projects with labelled failure output.
- Shared `vitest.setup.ts` registers snapshot serializers, fixtures, the ResizeObserver harness, `expect.extend` helpers.

### R10 — Documented contracts
- New file: `docs/testing.md` (< 400 lines). Explains: the runtime harness pattern (how to write a new harness-driven test), the snapshot workflow (when to update, how to review diffs), the contract-test model (why it's "contract" not "parity"), the CodSpeed interpretation guide, how to run the browser smoke locally, and **explicitly documents the auto-effects-extraction contract** (see R11).
- A `CHANGELOG.md` entry under "Unreleased" notes the testing-infrastructure additions.

### R11 — Document the auto-effects mount-time contract
- `extractAndStripEffects` reads computed border/shadow **once at mount**. It does not re-extract on theme change, dark mode flip, CSS variable update, or ancestor class change.
- This is documented plainly in `docs/testing.md` and in `README.md` under "Caveats": *"Lisse's auto-effects extraction is a mount-time snapshot. If you change theme tokens at runtime, re-mount the affected elements. A `refresh()` API for in-place re-extraction is planned for v0.4."*
- An open issue is filed (`Lisse#TBD`) tracking the v0.4 `refresh()` API.
- **No tests are added for re-extraction**, because the contract is "no re-extraction." Tests would be premature until the contract changes.

### R12 — Bundle-size regression guard (size-limit)
- `size-limit` configured in root `package.json` with per-package targets:
  - `@lisse/core` ESM: 12 KB gzipped (current ~10 KB, headroom for the curve types).
  - `@lisse/react` ESM: 4 KB gzipped on top of core.
  - `@lisse/vue` ESM: 4 KB gzipped on top of core.
  - `@lisse/svelte` ESM: 2 KB gzipped on top of core.
- Wired via `andresz1/size-limit-action` — posts a PR comment with per-target byte delta. Hard-fails the PR if any target exceeds budget.
- Catches the failure class CodSpeed can't: a dep accidentally added, a refactor that bloats output, a curve-type module that pulls in too much.

### R13 — Coverage reporting (Codecov)
- `codecov/codecov-action@v5` in the existing test workflow. Uploads Vitest coverage from `coverage/lcov.info`.
- Posts a PR comment with line/branch coverage delta per package.
- **No coverage threshold gate** — coverage is a tracking metric, not a gate. Hard targets create perverse incentives (testing for the metric, not for behaviour).
- Free for public repos, no signup beyond linking the GitHub org.

### R14 — Static security analysis (CodeQL)
- `github/codeql-action` configured for TypeScript via `.github/workflows/codeql.yml`.
- Runs on push-to-main and weekly schedule (`cron: '0 6 * * 1'`).
- Findings appear in the GitHub Security tab; high-severity findings post issues.
- ~5-10 min per run, async, doesn't block PRs.

### R15 — Dead-code reaper (Knip)
- `knip` configured in root with per-package entry points pulled from `package.json#exports`.
- Runs in CI as `pnpm knip --reporter compact` on every PR. Hard-fails on unused exports or unused files.
- Why this matters for a published library: dead exports inflate the tarball, confuse consumers, and make the type-resolution surface noisier than it should be.

### R16 — Preview releases per PR (pkg.pr.new)
- Wire `pkg.pr.new` GitHub App + `npx pkg-pr-new publish` step in CI on every PR.
- Each PR gets a URL-installable preview: `npm install https://pkg.pr.new/...@<sha>`.
- Pairs with R2 (consumer-smoke) — R2 proves the *built* artifact works; pkg.pr.new lets a *human* try the PR in their own project before merge.
- Comments are posted on the PR with the install URL.

### R17 — Automated dep updates (Renovate)
- `renovate.json` at repo root configured with:
  - **Grouped weekly updates** for devDependencies (single PR per week, easier to review than per-dep PRs).
  - **Immediate security updates** for any flagged CVE.
  - **Lockfile maintenance** monthly.
  - **Auto-merge** for patch updates that pass all CI checks (after the suite has stabilised — opt-in later).
- Renovate's grouped PRs are strictly better than Dependabot's per-dep PRs for a library of this size — fewer notifications, fewer rebases.

### R18 — Visual-regression review surface (Argos CI)
- Argos CI integration via `@argos-ci/playwright` in the browser smoke test (R8).
- The 4 curve-type screenshots from R8 upload to Argos on each main-branch run; Argos diffs against the last approved baseline and posts a PR-comment-style review on the commit.
- Click-to-approve UI replaces the "commit PNGs to git" workflow. Snapshots no longer live in the repo at all.
- Free OSS tier; no Storybook dependency.
- Initially read-only (visual changes surface as comments, don't block) — graduate to blocking after 4 weeks of clean signal.

### R19 — Real-device fallback (BrowserStack OSS, parked)
- Apply to BrowserStack's Open Source program (`browserstack.com/open-source`) now. Application takes ~1-2 weeks.
- **Do not wire up CI integration speculatively.** Park the credentials in 1Password.
- The trigger to wire up: the first user-reported bug that's iOS-Safari-specific *and* unreproducible on Playwright's desktop WebKit. At that point, add a single BrowserStack Automate job that reproduces the bug, gated on tagged releases only.
- This is the explicit "we have it ready when we need it" lever — not a default CI cost.

## Constraints

- **No additional runtime dependencies.** All new tooling lives in `devDependencies`: `fast-check`, `svgpath`, `svg-path-properties`, `@vitest/browser`, `@codspeed/vitest-plugin`, `@vitejs/plugin-react`, `@vitejs/plugin-vue`, `@sveltejs/vite-plugin-svelte`, `@testing-library/react`, `@testing-library/vue`, `playwright`, `publint`, `@arethetypeswrong/cli`, `size-limit`, `@size-limit/preset-small-lib`, `knip`, `@argos-ci/playwright`.
- **Vitest bumped to `^3.2.0`** — single root dep change, no API breakage expected, but verify all existing 262 tests pass after the bump before adding anything else.
- **PR feedback loop ≤ 2 minutes** for blocking jobs (`test`, `consumer-smoke`). CodSpeed runs but doesn't gate. Browser smoke on main can take ~5 minutes.
- **No checked-in image artifacts > 50 KB each.** Visual snapshots committed; debug diffs gitignored. Total snapshot dir cap: 1 MB.
- **No SaaS dependency requiring a paid plan for OSS.** CodSpeed free tier for public repos; if pricing changes, fall back to tinybench tracking-only without rewriting bench code.
- **Behaviour is sacred.** No test added in this plan changes the behaviour of any existing curve, effect, adapter, or extraction logic. The point is to lock in current behaviour. Genuine bugs surfaced by new tests are filed as separate issues and fixed in their own PRs. The exception is the documented v0.4 `refresh()` API — explicitly out of scope here.
- **Existing 262 tests must keep passing unchanged** post-migration to Vitest projects.
- **No per-PR cross-browser matrix.** WebKit on main only.
- **Floating-point precision is solved at the source.** Path generators round to 4 decimals before stringifying; tests assert exact string equality.

## Architecture Decisions

### Runtime harness (ResizeObserver + rAF) is the single highest-value new category
The defect class this repo keeps tripping over lives in the batching, dedup, cleanup, and observer-timing layer — not in the path math. Property tests + reference-shape tests cover the math; the runtime harness covers everything else. **Rejected**: relying on real-browser tests for this. Real browsers are slow, flaky, and over-engineered for a problem that's deterministic when you control the rAF queue.

### Packed-tarball smoke beats `dist/`-aliased smoke
A consumer-facing smoke that doesn't install through `pnpm pack` + `publint` + `attw` doesn't actually catch the failures it should. `publint` catches `exports` / `files` / `sideEffects` errors; `attw` catches type-resolution failures across `node10` / `node16` / `bundler`; the install-tarball-and-run fixture catches actual import-time breakage. **Rejected**: running tests against `dist/` directly via path aliases — misses `package.json#exports` resolution, doesn't test type resolution, doesn't exercise tarball contents.

### Reference-shape error > snapshot grid for superellipse & clothoid
These curves have a closed-form analytic definition. Sampling 32 points along the generated curve and comparing to the analytic curve catches *any* drift in the cubic Bézier approximation that doesn't violate endpoint or budget invariants. A 200-case snapshot grid would notice the drift only after it had already been "approved" by a `-u` regeneration. **Rejected**: massive snapshot grid for these curves; **kept**: small golden for the squircle (Apple-equivalent canonical output is part of the public spec).

### Snapshots are an API lock on identity, not a proof of correctness
~40 curated goldens focused on boundaries and layout-level cases. Cases where snapshots earn their keep: oversized radii triggering budget clamping, asymmetric per-corner radii, non-square boxes, mixed curves on one element — none of which the property tests directly cover. **Rejected**: 200-per-curve grid (diff theater, snapshot fatigue, no marginal signal); **rejected**: zero snapshots (loses the API-lock function).

### Property tests are not strictly better than snapshots
The spar surfaced this clearly: a curve can stay monotonic, symmetric, tangent-correct, non-self-crossing, scale-invariant, and budget-clamped while still becoming visibly wrong because shoulder curvature drifted. Generic invariants miss that. The mix of (curated goldens + properties + reference-shape) is strictly better than any single approach.

### "Parity" was the wrong word — it's a contract test
Adapters all consume core. There's no independent oracle to compare them against. What the tests actually prove is "each adapter feeds the same props, defaults, dimensions, and effects into core." That's a contract test, not a parity test. The framing matters because it sets the right expectation: if core changes, all three adapter contract tests update in lockstep — that's correct, not a flaw.

### CodSpeed soft-launch
Instruction-count regressions are useful signal, but **the claim that >5% should hard-fail PRs is unearned** until the benchmarks demonstrate their false-positive rate. Comment-only for 8 weeks. Honest framing: CodSpeed guards JS hot-paths, not real device performance. Real perf is measured by the browser smoke on main.

### WebKit in the smoke, not just Chromium
The repo has documented Safari-specific quirks. Skipping WebKit while documenting Safari issues is incoherent. Add WebKit to the on-main job. **Rejected**: Firefox (no documented Firefox quirks, would add CI time without commensurate signal); **rejected**: real Safari iOS via BrowserStack (cost not justified for the bug rate observed).

### CSS auto-extraction is a documented mount-time contract, not auto-reactive
- **Rejected (a)**: MutationObserver on host `[class]`/`[style]` — false confidence; computed border/shadow can change from an ancestor class, a CSS variable, or a media query without ever touching the host. Adds cost, doesn't solve the actual problem.
- **Rejected (b)**: `prefers-color-scheme` media listener — only catches OS-level theme switch, misses in-app theme toggles.
- **Chosen**: Document the contract plainly. Auto-extraction is mount-time. Re-mount to re-extract. An imperative `refresh()` is the first believable extension point, scoped to v0.4 and tracked in an open issue.

### Vitest projects, not workspaces
Vitest 3.2 deprecated `workspace` in favour of `projects`. Use `extends: true` explicitly. **Rejected**: per-package vitest configs (loses cross-package visibility, four CI invocations).

### Test location stays at `packages/*/__tests__/`
Existing convention. New fixture directory at `packages/core/__fixtures__/`; new docs at `docs/`; new consumer-smoke fixture at `tests/consumer-smoke/`.

### CI gating philosophy
- **Snapshot mismatch**: hard fail.
- **Property test fail (fast-check)**: hard fail with seed logged.
- **Reference-shape test fail**: hard fail.
- **Contract test fail**: hard fail.
- **publint / attw fail**: hard fail.
- **Consumer-smoke fail**: hard fail.
- **size-limit budget exceeded**: hard fail.
- **Knip unused-exports**: hard fail.
- **CodSpeed regression (any %)**: PR comment only, no fail (8-week soft launch).
- **Codecov coverage delta**: PR comment only, never fail.
- **CodeQL findings**: tracked in Security tab, do not block PRs (async weekly cron).
- **Argos visual diff**: PR comment for first 4 weeks (read-only); graduate to hard fail thereafter.
- **Browser smoke fail on main**: GitHub issue + Slack notification, do not block (job ran post-merge).
- **Visual snapshot pixel-diff > 2%**: hard fail on the main-only job (the Playwright `toHaveScreenshot` assertion, separate from Argos's review surface).

### Service tools we deliberately wire (the free OSS landscape)
The blueprint folds in the seven free-tier tools that earn their wiring:
- **size-limit** (R12) — bundle-size guard.
- **Codecov** (R13) — coverage tracking.
- **CodeQL** (R14) — security baseline.
- **Knip** (R15) — dead-code reaper.
- **pkg.pr.new** (R16) — preview releases per PR.
- **Renovate** (R17) — automated dep updates.
- **Argos CI** (R18) — visual-regression review surface.
- **BrowserStack OSS** (R19) — applied for, parked, wired only on first real iOS-Safari bug.

**Rejected from the free landscape**:
- **iOS Simulator on macOS runners** — boots in 60-120s, flaky; Playwright's WebKit-on-macOS gives ~95% of the signal at ~10% of the cost. Skip until a real iOS bug forces it (then use the parked BrowserStack credentials).
- **Android emulator on Linux runners** — 2-5 min boot, flaky; Chrome-on-Android renders SVG identically to Chrome-on-Linux for what Lisse does.
- **Lighthouse CI / WebPageTest / Unlighthouse** — wrong shape. They test *pages*; Lisse has no page. Belongs in `apps/website` CI, not the library CI.
- **Percy / Chromatic** — Percy is overkill for a clip-path library; Chromatic requires Storybook (which Lisse doesn't have and shouldn't add just for this). Argos is the right shape.
- **Sauce Labs / LambdaTest / CrossBrowserTesting OSS** — strictly worse than BrowserStack OSS for this use case; pick one cloud.
- **Bencher / Tachometer** — redundant with CodSpeed's instruction-count model.
- **SonarCloud / DeepSource** — noisy on small libraries; CodeQL covers the security baseline.
- **playwright-axe / pa11y-ci** — Lisse renders a semantic-free `<clipPath>`; nothing for axe to assert. Belongs on the marketing site, not the library.
- **Coveralls / bundlewatch** — pick one of each category; Codecov + size-limit win.

## Verification

For each requirement, the test of completion:

- **R1.** `pnpm test` reports 15 new tests across React/Vue/Svelte covering: resize batching, prop-update flush, effect toggle, cleanup, duplicate-subscribe safety. Manually breaking the rAF batching in `observe-resize.ts` causes the batching test in all three adapters to fail with a deterministic message.
- **R2.** New CI job `consumer-smoke` runs in < 90s, executes `pnpm pack` + `publint` + `attw` on all four packages, plus the 4 consumer micro-tests. A deliberate breakage of `package.json#exports` produces a red check with a `publint` error pointing at the bad export.
- **R3.** 8 reference-shape tests pass. A deliberate 2% error injected into `superellipse.ts` produces a red test naming the failing sample point and computed error magnitude.
- **R4.** ~40 curated golden snapshots in `curves.snap.ts`. `vitest --run` passes; `vitest -u` on an unchanged tree produces no diff. A geometry change shows a localized diff (not 800 lines).
- **R5.** `pnpm test invariants` runs 6 properties × 500 cases in under 5 seconds. Seed-on-failure logging works.
- **R6.** Each adapter has a `contract.test.*` with 26 assertions (20 PROP_MATRIX + 6 EFFECTS_MATRIX). Breaking a wrapper produces a labelled `[react]` / `[vue]` / `[svelte]` failure.
- **R7.** CodSpeed posts PR comments on every push. 9 benches measured. No hard fail configured for 8 weeks. Documentation reflects the soft-launch posture.
- **R8.** `.github/workflows/browser-smoke.yml` runs on `push: main` and `push: tags/v*`. Job completes in < 6 minutes. Tests pass on Chromium and WebKit: 1 resize-FPS unthrottled, 1 resize-FPS 6× throttle, 4 visual snapshots, 1 focus-ring a11y. Total 7 cases × 2 browsers = 14 assertions.
- **R9.** `pnpm test` runs all four projects in one invocation. Existing 262 tests still pass after Vitest 3.0 → 3.2 bump. Failures are labelled by project.
- **R10.** `docs/testing.md` exists, under 400 lines, linked from README. A new contributor can use it to: add a harness-driven test, update a snapshot, interpret a CodSpeed comment, run the browser smoke locally.
- **R11.** `docs/testing.md` and `README.md` both document the mount-time auto-extraction contract. An open issue tracks the v0.4 `refresh()` API.
- **R12.** `size-limit` config in `package.json` with 4 per-package targets. A deliberate +5 KB bloat in `@lisse/core` produces a red PR check and a comment showing the byte delta.
- **R13.** Codecov PR comments appear on every PR with line/branch coverage delta. No threshold gate configured.
- **R14.** `.github/workflows/codeql.yml` runs on push-to-main and weekly Mondays at 06:00 UTC. Findings appear in the GitHub Security tab.
- **R15.** `pnpm knip` reports zero unused exports on a clean tree; a deliberate unused export produces a red PR check.
- **R16.** Every PR shows a `pkg.pr.new` comment with a `npm install <url>` snippet. Manual install of that URL in a fresh project succeeds.
- **R17.** `renovate.json` exists; Renovate creates the first grouped weekly devDependency PR within 7 days of merging.
- **R18.** Argos CI shows the 4 R8 screenshots on each main-branch run; an intentional visual change appears as a side-by-side diff in the Argos dashboard with a one-click approve flow.
- **R19.** BrowserStack OSS application submitted; credentials stored. No CI wiring until justified by a real bug.

### Net test count after rollout
- Existing: 262
- R1 runtime harness: +15
- R2 consumer micro-tests: +4 (plus 8 tool invocations for publint/attw)
- R3 reference-shape: +8
- R4 curated snapshots: +1 snapshot block (~40 entries)
- R5 properties: +6 properties × 500 cases each
- R6 contract: +78
- R8 browser smoke (main only): +14
- **Total: ~388 unit/contract tests** + 8 tool checks + 1 snapshot block locking ~40 cases + 3,000 property assertions per run + browser-smoke matrix.

### Order of execution (suggested)
1. **R9** — Vitest projects + 3.2 bump first. Risk: breaks existing tests. Verify all 262 still pass.
2. **R1** — Runtime harness. Single highest-value addition.
3. **R2** — Packed-tarball smoke. Fastest ROI, catches the second-biggest failure class.
4. **R12 + R15 + R13** — size-limit + Knip + Codecov bundled. All three are sub-day wiring jobs that show value immediately on every PR.
5. **R14** — CodeQL. One workflow file, async signal.
6. **R17** — Renovate. Configure once, runs forever.
7. **R16** — pkg.pr.new. Lets contributors test PRs before merge.
8. **R6** — Contract tests on top of the existing adapter test files.
9. **R5** — Property tests in core.
10. **R3** — Reference-shape tests in core.
11. **R4** — Curated snapshots.
12. **R7** — CodSpeed wiring (soft-launch).
13. **R11** — Documentation contract update.
14. **R8** — Browser smoke (main job only).
15. **R18** — Argos CI for visual regression on the R8 screenshots.
16. **R19** — BrowserStack OSS application (parallel admin task, no code change).
17. **R10** — `docs/testing.md`.

Each step ships as its own PR. No big-bang merge.
