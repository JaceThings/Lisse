# Blueprint — Curve-type option in `@lisse/core`

Synthesis of six parallel research investigations into how to ship a `curve` option in the Lisse library proper, alongside the existing Figma squircle. Four corner constructions: **Arc**, **Squircle** (current default), **Superellipse**, **Clothoid**.

The math for all four already exists and is working in the `g2-curves` branch — see `apps/website/src/lib/curves.ts` and `docs/g2-curves.md` on that branch. This blueprint is about porting that math into production library code with the right API, the right path representation, and a phased rollout that keeps existing consumers working.

---

## Goals

1. Add `curve?: 'arc' | 'squircle' | 'superellipse' | 'clothoid'` to `CornerConfig`. Default `'squircle'` so existing consumers see byte-identical output until they opt in.
2. Production-grade path strings — compact `M C A C L` form, not 200-vertex polylines.
3. Borders, drop shadows, and inner shadows continue to work for all four curve types without per-effect changes.
4. Per-corner curve mixing is supported but doesn't break the existing API surface.
5. Minor version bump (`0.4.0`) across all four published packages via the existing linked changeset setup.

## Non-goals

- **G3 corners** (curvature derivative continuity). Industrial-CAD territory; invisible at UI scale. Out of scope.
- **Apple-faithful iOS replica**. The reverse-engineered Rosenfeld constants are available but bring the known asymmetry bug and licence questions. Documented as a possible future addition but not in this rollout.
- **CSS `corner-shape: superellipse()` browser-native fallback**. We emit the path ourselves; documenting the equivalence (`n = 2K`) is a docs task, not an implementation task.
- **Visual-regression test harness**. The repo has no Playwright/screenshot infrastructure today. Adding one is a separate project; string snapshots + the `/math` demo page are the visual reference for this feature.

---

## Decisions

### D1. API shape — flat `CornerConfig` extension

**Chosen:**

```ts
export type CurveType = 'arc' | 'squircle' | 'superellipse' | 'clothoid';

export interface CornerConfig {
  radius: number;
  /** Corner construction. Default: 'squircle' */
  curve?: CurveType;
  /** Smoothing 0..1. Used by squircle and clothoid. Default: 0.6 */
  smoothing?: number;
  /** Superellipse exponent. Default: 4 (the CSS `corner-shape: squircle` value). */
  exponent?: number;
  /** Preserve smoothing under tight budgets. Default: true */
  preserveSmoothing?: boolean;
}
```

**Rejected:** discriminated union per curve (`{ curve: 'squircle' } | { curve: 'superellipse', exponent }`). Looks beautiful in isolation but is hostile to `PerCornerConfig['topLeft']` narrowing — every utility that reads `.radius` would need an exhaustiveness check, and the four-way union taxes every per-corner override the docs sell as the primary use case.

**Rejected:** generic `{ radius, curve, params: { ... } }`. No autocomplete on inner knobs; second object to keep stable across renders.

The flat shape is what `figma-squircle` and CSS `corner-shape` settled on. Existing consumers' `{ radius, smoothing }` keeps working unchanged.

### D2. Per-corner curve mixing — allowed

The existing path stitcher (`packages/core/src/draw.ts`) connects adjacent corners with straight `L` commands at the tangency points. Every reasonable corner curve (arc, squircle, superellipse n>2, line→clothoid→arc→clothoid→line) is tangent to its two adjacent edges by construction, so the `L` segment is G1-continuous regardless of which families sit on either side.

Today's library is G1 everywhere — mixing curve types doesn't degrade that. A clothoid in one corner and arcs in the other three produces a shape that's G2 at the clothoid's line tangencies and G1 elsewhere. Visually unusual but geometrically valid. We allow it.

### D3. Path representation per curve type

| Curve | Representation | Cmds/corner | Approx chars (R=200) | Hausdorff worst case |
|---|---|---|---|---|
| Arc | one SVG `A` | 1 | ~40 | exact |
| Squircle | `c…a…c` (unchanged) | 3 | ~150 | exact |
| Superellipse | **4 closed-form cubic Béziers** per corner | 4 | ~280 | <0.05 px @ R=200 |
| Clothoid | **Walton–Meek cubic per half-fillet** + native `A` | 5 | ~320 | <0.025 px @ R=200 |

All four ship as compact native SVG primitives — no sampled polylines.

**Superellipse cubics:** sample the parameterisation `(R cos^(2/n) θ, R sin^(2/n) θ)` at `θ = 0, π/6, π/3, π/2`. Fit a G1 cubic between consecutive pairs using the standard tangent-handle formula `handle = (4/3) · tan((θᵢ₊₁ − θᵢ)/4) · |chord|/2` with the gradient-derived tangent direction. Same scheme `figma-squircle` ships. Joins are only G1 internally (the four pieces have a sub-pixel curvature kink at the joins), but the curve-to-line seams are G2 (κ = 0) for n > 2.

**Clothoid Walton–Meek:** for each half-fillet (the clothoid spiral from edge tangency to arc tangency), one cubic Bézier with control points

```
B1 = P_a + (3·|c|·cos(α_b) / (2·(2 + cos(α_a + α_b)))) · T_a
B2 = P_b − (3·|c|·cos(α_a) / (2·(2 + cos(α_a + α_b)))) · T_b
```

where `c` is the chord, `T_a/T_b` are the unit tangents, and `α_a/α_b` are the angles between the chord and the tangents. The endpoint position + tangent come from the demo's `integrateClothoid` (Simpson's rule, already implemented). Bound from Walton & Meek (2005) eq. 17: `ε ≤ (Δθ)⁵ · L / 1920` — sub-pixel for any Lisse-realistic R/smoothing.

**Rejected:** sampled polyline (port-as-is from demo). 200 samples × 4 corners × `toFixed(3)` = ~10 KB per rect, re-emitted on every layout observation. The compact representation is 7–8× smaller and renders strokes/shadows more cleanly.

### D4. Builder dispatch architecture

New directory `packages/core/src/curves/`:

```
curves/
  types.ts          CurveBuilder signature, BuilderInput/Output
  integrate.ts      shared Simpson's-rule clothoid integration
  arc.ts            buildArc
  squircle.ts       buildSquircle (wraps existing getPathParamsForCorner)
  superellipse.ts   buildSuperellipse — 4-cubic per quadrant
  clothoid.ts       buildClothoid — Walton-Meek
  index.ts          getCurveBuilder(type) dispatch
```

Each builder returns

```ts
type CurveBuilder = (input: {
  cornerRadius: number;
  smoothing: number;          // ignored by arc/superellipse
  exponent: number;           // superellipse only
  preserveSmoothing: boolean;
  roundingAndSmoothingBudget: number;
}) => {
  p: number;                  // tangency distance from corner vertex
  pathSegment: (orient: 'TR' | 'BR' | 'BL' | 'TL') => string;
};
```

`draw.ts`'s skeleton (`M, L, …, Z`) is curve-type-agnostic. Per-corner `drawTopRightPath` / `drawBottomRightPath` / etc. become dispatch sites: `getCurveBuilder(corner.curve)(...).pathSegment('TR')`.

### D5. Budget pipeline — radius-space → p-space

`distribute.ts` currently allocates space in radius-space and proportions adjacent corners by `radius/(radius+adjacentRadius)`. That's a latent bug for the existing squircle (whose actual footprint is `(1 + smoothing) · R`) and a real bug for clothoid (whose `p` is a non-trivial function of R and the smoothing fraction).

Refactor to budget in **p-space**: each corner declares its desired `p` via its builder, the distributor proportions by `p_i / (p_i + p_j)`, and shrinking happens curve-specifically via each builder's `(R, budget) → reduced` knob. Fixes the existing squircle latent bug as a side-effect.

### D6. Effects compatibility

Borders use a stroke-half trick (clipPath / mask + `strokeMultiplier: 2`) and never shrink the underlying path — **curve type has zero effect on border math**. The stroke just follows whatever `d` we give it. Polylines would faceted; native cubic/arc primitives don't.

Drop and inner shadows do shrink the radius via `adjustOptions(options, spread)` (`packages/core/src/svg-shared.ts:52–69`). The current implementation preserves unknown top-level keys for `UniformCornerOptions` but **rebuilds the per-corner branch via a helper that may drop the `curve` field**. Phase 2 must add a regression test that `adjustOptions({ topLeft: { radius: 20, curve: 'clothoid' }, ... }, 4)` preserves `curve`. This is **risk #1** (see register).

Each curve builder must also handle `radius = 0` gracefully — `adjustOptions` clamps to `Math.max(0, R + spread)`, so a large negative spread can collapse a corner. Squircle survives; the new builders must explicitly emit a sharp 90° turn (degenerate `L … L`) in this case.

### D7. Versioning

Linked changeset config (`.changeset/config.json:6–8`) means a single minor changeset bumps all four published packages in lockstep. Ship as `0.4.0` for `@lisse/core`, `@lisse/react`, `@lisse/svelte`, `@lisse/vue`.

---

## Phased rollout

Each phase = one PR.

### Phase 1 — Math port (`@lisse/core`, large PR)

- Create `packages/core/src/curves/` with the file layout above.
- Port `buildArc`, `buildSquircle`, `buildSuperellipse`, `buildClothoid` from `g2-curves:apps/website/src/lib/curves.ts`. Drop the demo-only fields (`segments`, `samples`, `points`, `info`, `g2`); production needs only `p` and `pathSegment`.
- Reimplement superellipse and clothoid as **compact native SVG primitives** (D3), not polylines.
- Move `integrateClothoid` (the Simpson-rule helper) to `curves/integrate.ts`.
- Add `CURVATURE_EPSILON`, `ANGLE_EPSILON` named constants (already in the demo).
- Snapshots-only; no API surface change yet, no `curve` field exposed.

Commits: (1) scaffold + types, (2) arc builder, (3) squircle wrap of existing math, (4) superellipse, (5) clothoid + integrate helper.

### Phase 2 — API surface (`@lisse/core`, medium PR)

- Extend `CornerConfig`, `UniformCornerOptions` with `curve?: CurveType` and `exponent?: number`.
- Update `withDefaults` / `resolveOptions` in `generate-path.ts` to default `curve: 'squircle'` and `exponent: 4`.
- Refactor `getSVGPathFromPathParams` to dispatch per-corner via `getCurveBuilder(...)`.
- Refactor `distribute.ts` and `corner-params.ts` to budget in p-space (D5). Existing squircle path output **must remain byte-identical** — re-run the existing snapshot tests unchanged as proof.
- Update `adjustOptions` (`svg-shared.ts`) to preserve `curve` and `exponent` through all branches, with a regression test.
- Re-export `CurveType` from `index.ts` and `path.ts`.

### Phase 3 — Bindings (small PR, three files)

- `@lisse/react`, `@lisse/svelte`: zero functional changes. Just re-export `CurveType` from `index.ts`.
- `@lisse/vue`: the component takes flat props mirroring `CornerConfig`. Add `curve` and `exponent` props to `packages/vue/src/smooth-corners.ts:38–62`. Add a typecheck test asserting `Vue props ⊇ keyof CornerConfig`.
- One changeset entry covers all three (linked).

### Phase 4 — Effects verification (small PR)

- Add per-curve fixtures in `packages/core/__tests__/svg-effects.test.ts` and `drop-shadow.test.ts`: a 200×200 with `{ radius: 40, curve: X }` and a 4px border / 8px shadow for each X. Snapshot the produced SVG markup.
- Add per-curve `adjustOptions` test (the key regression — see risk #1).
- No code changes expected; this PR is verification + tests.

### Phase 5 — Tests + budget edge cases (medium PR)

- Path snapshots per curve at (R = 40, smoothing = 0.6, exponent = 4) on a 200×200 box.
- Budget edges per curve: R = 200 on 100×100 (clamp), R = 50 on 100×100 (half-side), R = 0 on one corner / non-zero on the others. Assert no `NaN`/`Infinity` in any output.
- Per-corner curve mixing: `{ topLeft: { radius: 20, curve: 'clothoid' }, topRight: { radius: 20, curve: 'arc' }, ... }`. Assert valid closed path.
- The "back-compat snapshot unchanged" assertion — existing snapshots from Phase 2 still byte-identical.

### Phase 6 — Docs + demo (medium PR)

- Move `g2-curves:docs/g2-curves.md` to `docs/curves.md` as the math reference.
- `README.md` — add "Four curve types: arc, squircle (default), superellipse, clothoid" to the Features list. Add one collapsed `<details>` block showing `curve: 'clothoid'` usage in Quick Start.
- Land the `/math` demo page from `g2-curves` (the whole `apps/website/src/pages/Math.tsx` + `lib/{curves,comb,overlay,svg-export}.ts` + `hooks/useMorphedCurve.ts` files, plus the App.tsx route registration).
- Update `Playground.tsx`: add a 4-segment curve-type selector above the existing radius/smoothing sliders. Disable smoothing when `curve === 'arc'`; show an exponent slider (range 2.5–8, default 4) when `curve === 'superellipse'`.
- Update `What.tsx` to mention the curve options.

### Phase 7 — Release (trivial PR — single `.changeset/` file)

- One changeset file marked `minor` for `@lisse/core`. Linked config bumps the bindings automatically.
- Merge to `main`; the GitHub Action releases all four packages as `0.4.0` via OIDC trusted publishing.

---

## Risk register

Ranked by likelihood × severity (descending):

1. **`adjustOptions` silently drops `curve` field for per-corner configs.** The function at `svg-shared.ts:52–69` rebuilds per-corner objects via a `{...v, radius}` spread that *should* preserve unknown keys, but it's not explicitly tested. If `curve` is dropped, shadows render with squircle while the main path renders the requested curve — visually subtle, hard to debug. **Mitigation:** explicit regression test in Phase 2.

2. **New curve builders don't handle `radius = 0`.** `adjustOptions` clamps to `Math.max(0, R + spread)`. Squircle survives because `getPathParamsForCorner` short-circuits at `cornerRadius ≤ 0`. Clothoid and superellipse builders must explicitly emit a sharp 90° corner. **Mitigation:** unit test per builder with `radius: 0` input.

3. **Budget pipeline refactor breaks existing squircle output.** D5 changes how `distribute.ts` allocates space, which is load-bearing for the current squircle path. Existing snapshots must remain byte-identical or the change is wrong. **Mitigation:** Phase 2 verification step — run existing test suite untouched and confirm zero snapshot diffs.

4. **Path-cache key omits `curve`.** `svg-shared.ts:42` keys on `JSON.stringify(options)`. Since `curve` lives inside the options object, this works automatically — but worth a regression test that changing only `curve` invalidates the cache. **Mitigation:** test in Phase 2.

5. **Walton–Meek implementation error on clothoid cubics.** The formula has angle conventions that are easy to get wrong. **Mitigation:** add a property-based test that the resulting cubic's endpoint position and tangent match the Simpson-integrated truth values within `1e-6` for a range of (R, smoothing) inputs.

6. **Vue prop shape drifts from `CornerConfig`.** Vue is the only binding with flat props; future `CornerConfig` additions could be forgotten. **Mitigation:** Phase 3 typecheck test.

7. **Stroke micro-faceting on the superellipse 4-cubic approximation under thick borders.** Sub-pixel Hausdorff error at the join, but borders > 8 px might reveal the kinks. **Mitigation:** Phase 4 visual fixtures at border widths up to 12 px. If visible, consider bumping to 6 cubics per quadrant for superellipse (cheap).

---

## Open questions

- **Should the `/playground` page also expose `curve`, or just the new `/math` page?** The playground today is a deeper showcase of the squircle's effects (borders, shadows, dashed strokes). Showing all four curves with all of those effects bloats the UI substantially. Recommendation: yes, expose curve in `/playground`, but only the radius + smoothing controls per curve — keep the effects panel curve-agnostic.

- **Apple-replica curve as a fifth option?** Liam Rosenfeld's reverse-engineered constants give pixel-exact iOS reproduction but carry the asymmetry bug. Not in this rollout; documented as a potential future addition in `docs/curves.md`.

- **Migration story for users who relied on Lisse's exact path string output (e.g. baked into snapshot tests downstream)?** With `curve` defaulting to `'squircle'`, the path is byte-identical. But once a downstream user adopts `curve: 'clothoid'` in some component, their own snapshots will need refreshing. Mention in the 0.4.0 changelog.

---

## Sources

Six parallel research investigations against the working math demo on the `g2-curves` branch:

- Core API surface map (agent #1) — `packages/core/src/` audit, public/internal boundary, path generation flow, per-corner composition, effects machinery, tests.
- Per-curve path representation (agent #2) — opinionated production representations with Hausdorff-error bounds; cites `figma-squircle`, MartinRGB, Walton & Meek (2005), Levien (2009), Farin (2002), Wikipedia Superellipse.
- Per-corner composition rules (agent #3) — tangency math, budget redistribution, mixing curve types per corner.
- Framework bindings + DX (agent #4) — React/Svelte/Vue API surface, type re-exports, backwards compatibility, knob-naming options, semver impact.
- Borders + shadows compatibility (agent #5) — stroke-half trick for borders, `adjustOptions` risks, gradient borders, inner-shadow fill rule, test coverage gaps.
- Implementation phasing (agent #6) — file layout, commit grouping, test infrastructure, release strategy.

Math reference: `g2-curves:docs/g2-curves.md` (4-curve derivations with primary-source citations). Code reference: `g2-curves:apps/website/src/lib/curves.ts` (working implementation of all four constructions).
