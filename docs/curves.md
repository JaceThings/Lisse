# G2 corner curves: research notes

> Working notes for adding curvature-continuous corner alternatives to
> the math demo page (`/math`) and, later, to the Lisse library proper.
> The current library ships the Figma squircle, which is **G1 only**.
> This document collects four candidate G2 constructions, derives the
> math, and recommends what to ship.

## 1. What G1 vs G2 actually means

Continuity at the seam where two curve segments meet:

| Level | Match at seam | Curvature comb | Zebra stripes |
|---|---|---|---|
| G0 | position only | position jump | break |
| G1 | + unit tangent | step (height jump) | bend at seam |
| G2 | + curvature value | continuous (may kink) | flow through |
| G3 | + curvature derivative | smooth (tangent-continuous) | indistinguishable from G2 at UI scale |

`Cn` (parametric) is strictly stronger than `Gn` (geometric): Cn requires the parametric derivatives to match exactly; Gn only requires the geometric properties (direction, curvature value) to match up to a scalar. UI corner rounding only cares about Gn.

Lisse today: the cubic Bézier shoulders meet the central circular arc with matching position and tangent direction but a step in curvature. The shoulder's curvature is 0 at P0 (the cubic is G2-flat with the straight edge — a stronger property than the "G1" headline label suggests), climbs to κ_b at P3, and then the arc instantly has κ = 1/R. The sign of the step depends on smoothing: at low smoothing (≲ 0.5) κ_b < 1/R, so the comb steps *up* into the arc; at higher smoothing the cubic overshoots and the comb steps *down* into the arc. Either way the curvature isn't continuous at P3/P4 — that's the discontinuity visible on the curvature comb on `/math`.

## 2. Why G2 (and why not G3)

- At UI scale (≤ ~200px), the G0 → G1 jump is what looks "cheap" (the corner reads as bolted on). That's why CSS `border-radius` looks the way it does.
- G1 → G2 is what Apple bought into for iOS icons: the curvature step is visible under critical inspection (especially under reflection, hover-shadow rendering, light gradients) but invisible on a button face.
- G2 → G3 is invisible at any UI scale. Industrial CAD ("Class A" auto surfaces) uses G3 because zebra stripes under spec-grade lighting will show G2 kinks; for screens, irrelevant.

Decision: G2 is the right target.

## 3. The four candidate constructions

### 3.1 Single quintic Bézier per corner

One degree-5 polynomial Bézier per corner replacing the entire (shoulder + arc + shoulder) stack.

**Setup** (top-right corner, V at origin of local frame, top edge horizontal):

```
B0 = (−p, 0)      ← curve starts here on top edge
B5 = (0, p)       ← curve ends here on right edge
```

Tangent constraints (G1, edge tangents):

```
B1 = (−p + a, 0)  ← on the top edge
B4 = (0, p − a)   ← on the right edge   (a ≥ 0)
```

Curvature-zero constraints (G2, both edges are straight so κ must equal 0):

```
B2 lies on the top-edge line:    B2 = (−p + a + d, 0)
B3 lies on the right-edge line:  B3 = (0, p − a − d)   (d ≥ 0)
```

(Derivation: B''(0) = 20(B2 − 2B1 + B0); curvature κ(0) = (x′·y″ − y′·x″)/|B′|³. With B0, B1 on the x-axis and B′(0) horizontal, we need y″(0) = 0, which forces B2.y = 0. By the 90°-symmetric argument at t = 1, B3.x = 0.)

Reflection symmetry across the 45° diagonal forces `b = a` (one tangent magnitude) and `B3 = R(B2)` where R(x, y) = (−y, −x).

One smoothing knob `s ∈ [0, 1]`:

```
a = d = p · (1 − s) / 2
```

So:

```
B0 = (−p,        0)
B1 = (−p + a,    0)
B2 = (−p · s,    0)       (because −p + a + d = −p·s)
B3 = (0,         p · s)
B4 = (0,         p − a)
B5 = (0,         p)
```

**Peak curvature** at the midpoint t = 0.5:

```
κ(0.5) = (384·√2 / 5) · (1 − s) / (p · (5 + 7s)²)
```

At `s = 0`: κ ≈ 4.34 / p (about 4.3× sharper than a quarter circle of radius p at its apex). At `s = 1`: κ = 0 (the curve degenerates to a straight diagonal chamfer from B0 to B5 — all interior control points collapse onto the endpoints).

**Caveat**: a single quintic over a whole corner *concentrates curvature in the middle* (because κ is forced to 0 at both ends). At large `p` the pinch is perceptible — the apex reads as a "soft point." Acceptable for UI corners up to ~80–100 px; visible above that.

**SVG**: native — quintics aren't supported, but you can subdivide into 2 cubics with G2-Hermite construction (closed-form, sub-pixel error at UI scale).

Source: derivation independent (Farin §3.5 for Bézier derivatives, §10.2 for endpoint curvature condition; symmetric one-parameter family worked out from first principles).

### 3.2 Clothoid (Euler-spiral) blend replacing the central arc

Keep Lisse's existing cubic shoulders as-is; replace the central circular arc with a **clothoid segment** so that curvature varies *linearly along arc length* and can be matched to the shoulder's endpoint curvature `κ_b` at both seams.

**Clothoid definition**: κ(s) = A · s where s is arc length. Position via Fresnel integrals:

```
x(t) = √(π/A) · C(t),   C(t) = ∫₀ᵗ cos(πu²/2) du
y(t) = √(π/A) · S(t),   S(t) = ∫₀ᵗ sin(πu²/2) du
```

**G2 matching for the symmetric half-fillet** (P3 → midpoint M on the 45° axis):

- κ(start) = κ_b (matches the shoulder)
- κ(end)   = κ_max (free, equal at both halves by symmetry)
- Tangent rotation Δθ = (π/4) − θ_3 over the half-fillet

Two equations from the mean-value theorem identity:

```
Δθ        = ½ · (κ_b + κ_max) · L
κ_max     = κ_b + A · L
```

plus a third (the geometric "land on the diagonal" condition) gives a 2-equation nonlinear system in (A, L, κ_max) — solvable in 3–5 Newton iterations from a circular-arc seed at param-update time (not render time). Memoise on (R, s).

**SVG approximation**: clothoid has no SVG primitive. Standard approach is **Walton & Meek (2005), "A controlled clothoid spline"** — closed-form cubic Bézier approximation with Hausdorff error bounded by

```
ε ≤ (Δθ)⁵ · L / 1920
```

For typical UI corners (Δθ ≤ π/8 ≈ 0.39 rad, L ≤ 50 px): ε < 2 × 10⁻⁴ px. Sub-pixel across the entire 4–200 px corner-radius range with **one cubic per half-fillet** (two cubics total replacing the original arc).

**Worked example, R = 60, s = 0.6** (Figma defaults):
- shoulder endpoint curvature κ_b ≈ 0.0078 /px
- half-fillet arc length L ≈ 32 px
- κ_max from the mean-value identity ≈ 0.0167 /px (lands on what 1/R would have been)
- ramp coefficient A ≈ 2.8 × 10⁻⁴ /px²
- peak normal deviation vs the original arc: ~0.38 px at R=60, ~1.3 px at R=200 (visually slight "fattening" near the seams, slight "thinning" at the apex; curvature comb is now continuous)

Source: Levien, *From Spiral to Spline* (PhD, UC Berkeley 2009) §3.2 + §9; Walton & Meek, *Computers & Graphics* 29 (2005) 353–363.

### 3.3 Superellipse (Lamé curve)

`|x/a|^n + |y/b|^n = 1`. For **n > 2**, curvature at the axis-aligned crossings (x = ±a, y = 0) and (0, ±b) is **exactly 0**. That means a superellipse meets a straight edge with G2 continuity automatically — no shoulder construction needed.

**Derivation**: near x = a, the curve is y ≈ b · (1 − x/a)^(1/n) up to a constant. Curvature κ = |y″| / (1 + y′²)^(3/2). For n > 2, the exponent 1/n < 1/2, so y″ → 0 as x → a. Therefore κ(±a, 0) = κ(0, ±b) = 0.

**Peak curvature** (at the 45° apex, via implicit-form κ = (F_xx · F_y² + F_yy · F_x²) / (F_x² + F_y²)^(3/2) on F = |x/R|^n + |y/R|^n − 1):

κ_peak = (n − 1) · 2^(1/n − 1/2) / R

For n = 4, R = 160: κ_peak = 3 · 2^(−1/4) / 160 ≈ 0.01577. The diagram's readout matches this analytically after bumping the finite-difference step (the original ε = 1e-4 was too tight and produced ~0.0096 from double-precision rounding noise).

**CSS spec**: `corner-shape: squircle` resolves to `superellipse(2)` where the argument K means `|x|^(2K) + |y|^(2K) = 1`. So `squircle` = exponent 4. `superellipse(1)` = circular arc; `superellipse(∞)` = sharp corner; negative K = inward "scoop." Chrome ships this; Safari has it flagged.

**Best fit to Figma squircle**: there isn't one — the Figma curve is *not* a superellipse. Numerical fits land around n ≈ 5 for an iOS-shaped target, but that's a 1D approximation of a 2D shape and the residual is systematic (Furse's "blind alley" quote).

**SVG approximation**: 4 cubic Béziers per quadrant gives < 1% radius error for K ∈ [1, 5]; 8 cubics per quadrant for tighter. Both `figma-squircle` and `squircle.js` ship this.

**Trade-off**: cheapest G2 to implement (single closed-form, one knob = the exponent). Aligns with what CSS is shipping. But the curvature distribution differs from the Apple/Figma shape — at smoothing-equivalent settings the superellipse reads as a *different* shape, not as a smoother version of the same one.

Source: Wikipedia (Superellipse, §"Mathematical properties"); CSS Borders 4 draft; MDN.

### 3.4 Three-Bézier Apple replica

What Apple actually ships. Each corner is **three cubic Béziers** plus short straight-line splices into the edges. The construction is G2 at the inter-Bézier seams. Liam Rosenfeld extracted the actual CGPath and reproduced it with **zero-pixel error** using ~8 normalised constants:

```
1.528665, 1.08849296, 0.86840694, 0.63149379,
0.07491139, 0.37282383, 0.16905956, 0.0
```

Scaled by the corner radius, these constants give exact iOS-faithful output (for square cases).

**Known defects**:
- The two halves of each corner are **not exact mirror images** — there's a tiny straight segment on one side that doesn't belong (Furse's "minuscule straight segment which clearly doesn't belong"). Likely a bug preserved across releases; Apple has never commented.
- At low aspect ratios the shape **abruptly falls back** to a circular-arc rounded rectangle. Threshold not publicly documented.
- Apple's SDK documents this as `.continuous` but does not formally commit to a continuity class. The G2 claim is community-verified, not Apple-asserted.

**Recommendation**: include as an option ("Apple-faithful") on the math page for visual comparison, but **don't ship it in the library** — you'd inherit the asymmetry and the aspect-ratio fallback. Both are exactly what Figma deliberately walked away from.

Source: Rosenfeld, "My Quest for the Apple Icon Shape"; Swanson, "Unleashing Genetic Algorithms on the iOS 7 Icon"; Furse, "Desperately Seeking Squircles."

## 4. Comparison

| Construction | Continuity | One knob? | Apple-like? | Implementation cost | Visual character |
|---|---|---|---|---|---|
| **Quarter circle** (CSS) | G1 (κ jumps 0 → 1/R) | radius only | no | trivial | hard transition at seam |
| **Figma squircle** (current Lisse) | G1 (small κ jump) | smoothing | yes | done | Apple-feel, comb has step |
| **Quintic Bézier** | G2 | smoothing | no | medium (1 closed-form + subdivide to cubics) | sharp midpoint pinch at high p |
| **Clothoid blend** | G2 | smoothing (existing) | yes (preserves Figma look) | medium-high (Newton solve at param time, Walton-Meek cubic at render) | Apple-feel, comb is continuous, no pinch |
| **Superellipse** | G2 | exponent | no | low (closed-form, 4 cubics/quadrant) | distinct shape — squarer/rounder, not "Apple smoother" |
| **Three-Bézier Apple replica** | G2 | radius only | exact | low (just hardcode the constants) | exact iOS match, asymmetry included |

## 5. Recommendation

For the **math demo page** (`/math`): expose all four as a curve-type selector. Pedagogically the most useful comparison is showing how each affects the curvature comb. Order:

1. **Arc** (G1 with hard jump) — baseline
2. **Squircle** (G1, current Lisse — smaller jump)
3. **Superellipse** (G2, one knob = exponent — different shape family)
4. **Clothoid blend** (G2, preserves Figma feel, comb is continuous)

Optionally a 5th: **Apple replica** (G2, exact iOS constants, asymmetry preserved). Useful for "see what Apple actually does" but visually almost identical to the clothoid for square corners.

For the **library proper** (separate decision, later): the natural addition is the **clothoid blend** as a `curve: 'g2'` option alongside the existing `'squircle'`. It preserves the smoothing dial users already know, doesn't change the path's macroscopic shape (peak deviation ≤ 1.3 px at R = 200), and removes the comb discontinuity that's the entire motivation for going G2. Superellipse is also defensible as a third option for users who want the CSS `corner-shape: squircle` aesthetic (the family that's shipping in browsers).

Skip: quintic-only (the midpoint pinch is a real defect at large radii); Apple replica (the asymmetry is a known bug, no upside over the clothoid for non-iOS-faithful use cases).

## 6. Open questions

- **Curvature continuity of the clothoid at the *line* seam (P0 / P7).** The cubic shoulder starts with κ = 0 at P0 (G2-flat with the straight edge) and ramps up. The clothoid match at P3/P4 only fixes the *arc-replacement* seam. Net result: line→shoulder→clothoid→shoulder→line, with G2 everywhere if the existing shoulder math is already G2-flat at P0. Worth verifying numerically: compute κ at P0 from the existing `getPathParamsForCorner` output. Cheap check.

- **Behaviour at `smoothing = 0`.** The Figma squircle collapses to a plain quarter circle. The clothoid replacement should also collapse (κ_b at the shoulder endpoint → 1/R as smoothing → 0; the clothoid degenerates to a constant-κ arc, i.e. the same circle). Verify the math doesn't blow up in the limit.

- **Per-corner composition.** Lisse supports different radii per corner. The clothoid solve has to happen per corner (the (R, s) → (A, L, κ_max) memoisation is per-corner). The Newton seed needs to be stable.

- **Stroke/border thickness with G2 curves.** Borders trace offset paths. Offset of a clothoid is *not* a clothoid; the offset path's curvature depends on signed-distance. Visually probably fine at typical stroke widths (1–4 px) but worth a sanity check before promising "borders look identical."

- **`corner-shape: squircle` as a same-tab fallback.** Browsers that ship CSS `corner-shape` will render superellipses natively. If Lisse exposes a superellipse mode, document the relationship.

## 7. Sources

- Daniel Furse — [Desperately Seeking Squircles](https://www.figma.com/blog/desperately-seeking-squircles/) (Figma Blog)
- Mike Swanson — [Unleashing Genetic Algorithms on the iOS 7 Icon](https://blog.mikeswanson.com/unleashing-genetic-algorithms-on-the-ios-7-icon/)
- Liam Rosenfeld — [My Quest for the Apple Icon Shape](https://liamrosenfeld.com/posts/apple_icon_quest/)
- Manfred Schwind — [Exploring iOS 7 Rounded Corners](http://www.mani.de/backstage/?p=483)
- Raph Levien — [From Spiral to Spline: Optimal Techniques in Interactive Curve Design](https://levien.com/phd/thesis.pdf) (PhD thesis, UC Berkeley 2009)
- Walton & Meek — "A controlled clothoid spline," *Computers & Graphics* 29 (2005) 353–363
- Farin — *Curves and Surfaces for CAGD* (5th ed., 2002), §3.5, §10.2
- Wikipedia — [Superellipse](https://en.wikipedia.org/wiki/Superellipse)
- W3C CSS Borders 4 draft — [drafts.csswg.org/css-borders-4](https://drafts.csswg.org/css-borders-4/)
- MDN — [`superellipse()`](https://developer.mozilla.org/en-US/docs/Web/CSS/superellipse), [`corner-shape`](https://developer.mozilla.org/en-US/docs/Web/CSS/corner-shape)
