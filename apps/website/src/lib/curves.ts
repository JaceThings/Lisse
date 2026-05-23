// Curve constructions for the math demo page. See docs/g2-curves.md
// for the full derivations — this file is the implementation half.
//
// Each builder produces a `Curve` containing:
//   - `segments`: an array of `Segment`s that the curvature comb samples.
//     Each segment exposes position, derivative, curvature, and an
//     "inward" normal direction (toward the corner interior).
//   - `path`: an SVG path-data string that draws the curve.
//   - `points`: labelled points (the seven control points for cubic
//     constructions; just endpoints + apex for the others).
//   - `arcCenter`: present only when an inscribed arc is part of the
//     construction (squircle).
//   - `info`: curve-specific scalar readouts (peak κ, exponent, etc.)
//     that the page lists below the diagram.
//
// All coordinates are in the page's display frame — the caller hands
// in `cornerX`/`cornerY` (already zoom-scaled), and each builder lays
// out its geometry relative to that point with the top edge horizontal
// and the right edge vertical.

import { getPathParamsForCorner } from "@lisse/core";

export type Pt = readonly [number, number];

export type CurveType = "arc" | "squircle" | "superellipse" | "clothoid";

export interface LabelledPt {
  point: Pt;
  label: string;
  offset: Pt;
  tone: "primary" | "muted";
}

interface Segment {
  point: (t: number) => Pt;
  deriv: (t: number) => Pt;
  curvature: (t: number) => number;
  /** Direction from the curve point toward the corner interior. The
   *  comb is drawn against this direction so whiskers fan outward. */
  inward: (t: number) => Pt;
}

export interface CurveInfo {
  label: string;
  value: string;
}

/** Arc-length-uniform samples of the curve. Same length across all
 *  curve types so the math page can lerp between curves point-by-point
 *  when the user switches between Arc / Squircle / Superellipse /
 *  Clothoid — every sample i corresponds to the same fractional
 *  position along each curve, so the morph is geometrically smooth.
 *
 *  `ks` holds the unsigned curvature at each sample for the comb
 *  (which only renders magnitudes; sign is irrelevant for whisker
 *  length and orientation).
 */
export interface CurveSamples {
  xs: number[];
  ys: number[];
  ks: number[];
}

export const SAMPLE_COUNT = 200;

// Velocity below this is treated as a degenerate point (κ undefined,
// returned as 0). Hit at the cusp of cubic shoulders and at endpoint
// limits of the superellipse parameterisation.
const CURVATURE_EPSILON = 1e-9;
// Arc-sweep angles below this in absolute radians are treated as a
// degenerate (zero-length) arc and the SVG `A` command is skipped.
// Comes up at smoothing → 1 in the clothoid construction where the
// central arc collapses to a point.
const ANGLE_EPSILON = 1e-6;

export interface Curve {
  segments: Segment[];
  /** Polyline path string derived from `samples`. Used directly for
   *  rendering; identical structure across curve types so SVG path
   *  morphing tools (or naive per-coordinate lerp) work. */
  path: string;
  /** Arc-length-uniform samples (length = SAMPLE_COUNT). */
  samples: CurveSamples;
  points: LabelledPt[];
  arcCenter?: Pt;
  /** Off-curve control polygons drawn dashed (Bézier handles). Each
   *  inner array is one polyline. */
  controlPolygons?: Pt[][];
  /** Optional reference quarter-circle path drawn dashed for comparison. */
  referenceArcPath?: string;
  /** Spokes drawn from the arc centre to the arc tangency points. Each
   *  inner array is [from, to]. */
  arcSpokes?: Pt[][];
  /** The on-curve extent in the display frame. Used by the caller to
   *  centre the curve in the viewBox (cornerX = HALF_VB + p/2). */
  displayP: number;
  /** Whether the curve passes G2-with-line at the seams (P0/P7). The
   *  diagram shows a G1/G2 label based on this. */
  g2: boolean;
  info: CurveInfo[];
}

// =========================================================================
// Segment factories — internal; segments are an implementation detail
// of how each builder feeds `resampleByArcLength` to produce the
// uniform `samples` exposed by `Curve`.
// =========================================================================

function cubic(P0: Pt, P1: Pt, P2: Pt, P3: Pt): Segment {
  const u = (t: number) => 1 - t;
  const point = (t: number): Pt => {
    const a = u(t) ** 3,
      b = 3 * u(t) ** 2 * t,
      c = 3 * u(t) * t * t,
      d = t ** 3;
    return [
      a * P0[0] + b * P1[0] + c * P2[0] + d * P3[0],
      a * P0[1] + b * P1[1] + c * P2[1] + d * P3[1],
    ];
  };
  const deriv = (t: number): Pt => {
    const a = 3 * u(t) ** 2,
      b = 6 * u(t) * t,
      c = 3 * t * t;
    return [
      a * (P1[0] - P0[0]) + b * (P2[0] - P1[0]) + c * (P3[0] - P2[0]),
      a * (P1[1] - P0[1]) + b * (P2[1] - P1[1]) + c * (P3[1] - P2[1]),
    ];
  };
  const second = (t: number): Pt => {
    const a = 6 * u(t),
      b = 6 * t;
    return [
      a * (P2[0] - 2 * P1[0] + P0[0]) + b * (P3[0] - 2 * P2[0] + P1[0]),
      a * (P2[1] - 2 * P1[1] + P0[1]) + b * (P3[1] - 2 * P2[1] + P1[1]),
    ];
  };
  const curvature = (t: number): number => {
    const [dx, dy] = deriv(t);
    const [ddx, ddy] = second(t);
    const num = dx * ddy - dy * ddx;
    const den = (dx * dx + dy * dy) ** 1.5;
    return den < CURVATURE_EPSILON ? 0 : num / den;
  };
  const inward = (t: number): Pt => {
    const [tx, ty] = deriv(t);
    const m = Math.hypot(tx, ty) || 1;
    return [-ty / m, tx / m];
  };
  return { point, deriv, curvature, inward };
}

function arcSegment(center: Pt, R: number, theta0: number, theta1: number): Segment {
  const sweep = theta1 - theta0;
  const point = (t: number): Pt => {
    const a = theta0 + sweep * t;
    return [center[0] + R * Math.cos(a), center[1] + R * Math.sin(a)];
  };
  const deriv = (t: number): Pt => {
    const a = theta0 + sweep * t;
    return [-R * Math.sin(a) * sweep, R * Math.cos(a) * sweep];
  };
  const curvature = () => 1 / R;
  const inward = (t: number): Pt => {
    const [px, py] = point(t);
    const dx = center[0] - px,
      dy = center[1] - py;
    const m = Math.hypot(dx, dy) || 1;
    return [dx / m, dy / m];
  };
  return { point, deriv, curvature, inward };
}

/**
 * Superellipse quadrant `|X/p|^n + |Y/p|^n = 1` mapped onto our corner.
 *
 * The normalized first-quadrant arc runs from (X=p, Y=0) to (X=0, Y=p)
 * with its bounding-square corner at (p, p) and the 45° apex at
 * (p·2^(−1/n), p·2^(−1/n)) — for n > 2 the apex sits *between* origin
 * and (p, p), so the squircle bulges toward the bounding-square corner.
 *
 * To make the corner-rendering match, we map the bounding-square corner
 * (p, p) onto the rectangle's sharp corner (cornerX, cornerY). That
 * makes the squircle apex sit near the sharp corner (correct outward
 * bulge), and the squircle's axis crossings land on the straight-edge
 * tangency points P0 and P7.
 *
 * Affine map: x_display = cornerX − p + Y,  y_display = cornerY + p − X.
 *
 * For n > 2 curvature is 0 at the axis crossings, so the curve meets the
 * straight edges with G2 continuity. n = 2 is an ordinary quarter
 * circle (with the standard κ jump). n < 2 would bulge *inward* — a
 * concave corner; we don't expose that range.
 */
function superellipseSegment(cornerX: number, cornerY: number, p: number, n: number): Segment {
  const expo = 2 / n;
  const theta = (t: number) => (Math.PI / 2) * t;
  const cosθ = (t: number) => Math.cos(theta(t));
  const sinθ = (t: number) => Math.sin(theta(t));
  const signedPow = (base: number, exp: number) =>
    base === 0 ? 0 : Math.sign(base) * Math.abs(base) ** exp;
  const point = (t: number): Pt => [
    cornerX - p + p * signedPow(sinθ(t), expo),
    cornerY + p - p * signedPow(cosθ(t), expo),
  ];
  // x(t) = cornerX − p + p · sin^(2/n)(θ),
  // y(t) = cornerY + p − p · cos^(2/n)(θ),    θ = (π/2)·t.
  // dx/dt = p · (2/n) · sin^(2/n−1)(θ) · cos(θ) · (π/2)
  // dy/dt = p · (2/n) · cos^(2/n−1)(θ) · sin(θ) · (π/2)
  // For n > 2 the exponent (2/n − 1) is negative; sin^(<0)(0) is +∞
  // (vertical tangent at P0), cos^(<0)(π/2) is +∞ (horizontal tangent
  // at P7). The finite-difference second derivative handles the
  // endpoint blow-ups well enough for the demo.
  const deriv = (t: number): Pt => {
    const c = cosθ(t),
      s = sinθ(t);
    const dθ_dt = Math.PI / 2;
    const dx_dt = ((2 * p) / n) * signedPow(s, expo - 1) * c * dθ_dt;
    const dy_dt = ((2 * p) / n) * signedPow(c, expo - 1) * s * dθ_dt;
    return [dx_dt, dy_dt];
  };
  // Curvature via signed κ formula, with the second derivative
  // computed by a centred finite difference on the (already analytic)
  // first derivative. EPS = 1e-3 chosen empirically: at 1e-4 the dx/dt
  // values around the apex (~100s) differ in only the 5th significant
  // figure, and double-precision rounding turned the difference into
  // noise — the peak κ readout at n=4, R=160 came out ~40% low
  // (0.0096 vs the analytic 0.01577). 1e-3 keeps the truncation error
  // below 1% and removes the rounding noise. Endpoints are clamped to
  // [0, 1]; the comb's t-grid never lands on exact 0 or 1, so the
  // clamp doesn't introduce a one-sided-difference bias in practice.
  const EPS = 1e-3;
  const second = (t: number): Pt => {
    const [dxA, dyA] = deriv(Math.max(0, t - EPS));
    const [dxB, dyB] = deriv(Math.min(1, t + EPS));
    const span = Math.min(1, t + EPS) - Math.max(0, t - EPS);
    return [(dxB - dxA) / span, (dyB - dyA) / span];
  };
  const curvature = (t: number): number => {
    const [dx, dy] = deriv(t);
    const [ddx, ddy] = second(t);
    const num = dx * ddy - dy * ddx;
    const den = (dx * dx + dy * dy) ** 1.5;
    return den < CURVATURE_EPSILON ? 0 : num / den;
  };
  const inward = (t: number): Pt => {
    const [tx, ty] = deriv(t);
    const m = Math.hypot(tx, ty) || 1;
    return [-ty / m, tx / m];
  };
  return { point, deriv, curvature, inward };
}

interface ClothoidTables {
  xs: number[]; // cumulative x offsets at i/N along the clothoid
  ys: number[]; // cumulative y offsets at i/N along the clothoid
  L: number;    // arc length covered by the tables
  θ0: number;
  κ0: number;
  A: number;
}

/**
 * Simpson's-rule integration of the position integrals
 *     X(L) = ∫ cos θ(s) ds,  Y(L) = ∫ sin θ(s) ds
 * for a clothoid with curvature κ(s) = κ₀ + A·s and initial tangent
 * angle θ0. Returns N+1 cumulative offsets so callers can both
 * (a) read the endpoint (the last entry) and (b) interpolate the
 * curve at arbitrary t ∈ [0, 1] without re-integrating.
 *
 * Closed-form Fresnel-via-Taylor would be faster but the demo's
 * sample rate isn't a bottleneck.
 */
function integrateClothoid(θ0: number, κ0: number, A: number, L: number, N: number): ClothoidTables {
  const xs = new Array<number>(N + 1).fill(0);
  const ys = new Array<number>(N + 1).fill(0);
  if (L <= 0) return { xs, ys, L, θ0, κ0, A };
  const step = L / N;
  let xAcc = 0,
    yAcc = 0;
  for (let i = 1; i <= N; i++) {
    const sA = (i - 1) * step;
    const sB = sA + step;
    const sM = (sA + sB) / 2;
    const θA = θ0 + κ0 * sA + (A / 2) * sA * sA;
    const θB = θ0 + κ0 * sB + (A / 2) * sB * sB;
    const θM = θ0 + κ0 * sM + (A / 2) * sM * sM;
    xAcc += (step / 6) * (Math.cos(θA) + 4 * Math.cos(θM) + Math.cos(θB));
    yAcc += (step / 6) * (Math.sin(θA) + 4 * Math.sin(θM) + Math.sin(θB));
    xs[i] = xAcc;
    ys[i] = yAcc;
  }
  return { xs, ys, L, θ0, κ0, A };
}

/**
 * Single clothoid segment whose curvature varies linearly with arc
 * length s: κ(s) = κ₀ + A · s. Parameterised by t ∈ [0, 1] with arc
 * length s = L · t. Used in pairs (symmetric reflection across the
 * 45° axis) to replace the Lisse arc with a G2 blend.
 *
 * Caller passes a pre-built `ClothoidTables` so `buildClothoid` can
 * integrate once for its endpoint geometry and reuse the same tables
 * for the segment — earlier versions ran Simpson's rule twice for the
 * same parameters.
 */
function clothoidSegment(
  start: Pt,
  tables: ClothoidTables,
  interiorPivot: Pt,
): Segment {
  const N = tables.xs.length - 1;
  const { L, θ0, κ0, A } = tables;

  const lookup = (t: number, table: number[]): number => {
    const idx = t * N;
    const i = Math.floor(idx);
    if (i >= N) return table[N];
    const frac = idx - i;
    return table[i] * (1 - frac) + table[i + 1] * frac;
  };

  const point = (t: number): Pt => [
    start[0] + lookup(t, tables.xs),
    start[1] + lookup(t, tables.ys),
  ];
  const deriv = (t: number): Pt => {
    const s = L * t;
    const θ = θ0 + κ0 * s + (A / 2) * s * s;
    return [L * Math.cos(θ), L * Math.sin(θ)];
  };
  const curvature = (t: number): number => κ0 + A * L * t;
  const inward = (t: number): Pt => {
    const [px, py] = point(t);
    const dx = interiorPivot[0] - px,
      dy = interiorPivot[1] - py;
    const m = Math.hypot(dx, dy) || 1;
    return [dx / m, dy / m];
  };
  return { point, deriv, curvature, inward };
}

// =========================================================================
// Sampling: turn a chain of segments into a fixed-length, arc-length-
// uniform sample array. This is the common representation that lets the
// math page lerp smoothly between curve types — each curve's sample i
// always corresponds to the same fractional position along that curve.
// =========================================================================

const FINE_PER_SEGMENT = 64;

function resampleByArcLength(segments: Segment[], N: number = SAMPLE_COUNT): CurveSamples {
  // First pass: dense sampling of every segment to estimate cumulative
  // chord length. Chord length is a good proxy for arc length at this
  // density (FINE_PER_SEGMENT × ≤4 segments = ≥256 chords per curve).
  const dense: { x: number; y: number; k: number; cum: number }[] = [];
  let cum = 0;
  let prev: Pt | null = null;
  for (const seg of segments) {
    for (let i = 0; i <= FINE_PER_SEGMENT; i++) {
      // Skip the segment-boundary point on every segment except the
      // first to avoid double-counting position-coincident samples.
      if (i === 0 && dense.length > 0) continue;
      const t = i / FINE_PER_SEGMENT;
      const [x, y] = seg.point(t);
      const k = Math.abs(seg.curvature(t));
      if (prev) cum += Math.hypot(x - prev[0], y - prev[1]);
      dense.push({ x, y, k, cum });
      prev = [x, y];
    }
  }
  const total = cum > CURVATURE_EPSILON ? cum : 1;

  // Second pass: pick N samples at uniformly-spaced cumulative-length
  // targets, linearly interpolating between the dense samples.
  const xs = new Array<number>(N);
  const ys = new Array<number>(N);
  const ks = new Array<number>(N);
  let cursor = 0;
  for (let i = 0; i < N; i++) {
    const target = (i / (N - 1)) * total;
    while (cursor + 1 < dense.length && dense[cursor + 1].cum < target) cursor++;
    if (cursor + 1 >= dense.length) {
      const last = dense[dense.length - 1];
      xs[i] = last.x; ys[i] = last.y; ks[i] = last.k;
      continue;
    }
    const a = dense[cursor];
    const b = dense[cursor + 1];
    const denom = b.cum - a.cum;
    const frac = denom > CURVATURE_EPSILON ? (target - a.cum) / denom : 0;
    xs[i] = a.x + (b.x - a.x) * frac;
    ys[i] = a.y + (b.y - a.y) * frac;
    ks[i] = a.k + (b.k - a.k) * frac;
  }
  return { xs, ys, ks };
}

/** Linear interpolation between two CurveSamples of the same length. */
export function lerpSamples(a: CurveSamples, b: CurveSamples, t: number): CurveSamples {
  const N = a.xs.length;
  const xs = new Array<number>(N);
  const ys = new Array<number>(N);
  const ks = new Array<number>(N);
  for (let i = 0; i < N; i++) {
    xs[i] = a.xs[i] + (b.xs[i] - a.xs[i]) * t;
    ys[i] = a.ys[i] + (b.ys[i] - a.ys[i]) * t;
    ks[i] = a.ks[i] + (b.ks[i] - a.ks[i]) * t;
  }
  return { xs, ys, ks };
}

export function pathFromSamples(s: CurveSamples): string {
  const N = s.xs.length;
  if (N === 0) return "";
  let d = `M ${s.xs[0].toFixed(3)} ${s.ys[0].toFixed(3)}`;
  for (let i = 1; i < N; i++) {
    d += ` L ${s.xs[i].toFixed(3)} ${s.ys[i].toFixed(3)}`;
  }
  return d;
}

// =========================================================================
// Curve builders
// =========================================================================

function makePoint(point: Pt, label: string, offset: Pt, tone: "primary" | "muted" = "primary"): LabelledPt {
  return { point, label, offset, tone };
}



/** Plain quarter-circle (CSS border-radius). G1 with line: tangent
 *  matches but curvature jumps 0 → 1/R at the seam. */
function buildArc(R: number, cornerX: number, cornerY: number): Curve {
  const center: Pt = [cornerX - R, cornerY + R];
  const P0: Pt = [cornerX - R, cornerY];
  const P7: Pt = [cornerX, cornerY + R];
  const θ0 = Math.atan2(P0[1] - center[1], P0[0] - center[0]);
  const θ1 = Math.atan2(P7[1] - center[1], P7[0] - center[0]);
  const segments = [arcSegment(center, R, θ0, θ1)];
  const samples = resampleByArcLength(segments);
  return {
    segments,
    path: pathFromSamples(samples),
    samples,
    points: [
      makePoint(P0, "P0", [0, -14]),
      makePoint(P7, "P7", [14, 0]),
    ],
    arcCenter: center,
    arcSpokes: [
      [center, P0],
      [center, P7],
    ],
    displayP: R,
    g2: false,
    info: [{ label: "κ", value: (1 / R).toFixed(4) }],
  };
}

/** Figma squircle — cubic shoulders + central arc. G1: tangent matches
 *  but curvature steps at the cubic↔arc seams (P3, P4). What Lisse
 *  ships today. */
function buildSquircle(R: number, smoothing: number, cornerX: number, cornerY: number): Curve {
  const params = getPathParamsForCorner({
    cornerRadius: R,
    cornerSmoothing: smoothing,
    preserveSmoothing: true,
    roundingAndSmoothingBudget: 1e9,
  });
  const { a, b, c, d, p, arcSectionLength, cornerRadius: rR } = params;
  const P0: Pt = [cornerX - p, cornerY];
  const P1: Pt = [cornerX - p + a, cornerY];
  const P2: Pt = [cornerX - p + a + b, cornerY];
  const P3: Pt = [cornerX - p + a + b + c, cornerY + d];
  const P4: Pt = [cornerX - p + a + b + c + arcSectionLength, cornerY + d + arcSectionLength];
  const P5: Pt = [P4[0] + d, P4[1] + c];
  const P6: Pt = [P4[0] + d, P4[1] + b + c];
  const P7: Pt = [P4[0] + d, P4[1] + a + b + c];
  const center: Pt = [cornerX - rR, cornerY + rR];
  const θ_P3 = Math.atan2(P3[1] - center[1], P3[0] - center[0]);
  const θ_P4 = Math.atan2(P4[1] - center[1], P4[0] - center[0]);

  const segments: Segment[] = [
    cubic(P0, P1, P2, P3),
    arcSegment(center, rR, θ_P3, θ_P4),
    cubic(P4, P5, P6, P7),
  ];
  const samples = resampleByArcLength(segments);
  const referenceArcPath = `M ${cornerX - rR} ${cornerY} A ${rR} ${rR} 0 0 1 ${cornerX} ${cornerY + rR}`;
  return {
    segments,
    path: pathFromSamples(samples),
    samples,
    points: [
      makePoint(P0, "P0", [0, -14]),
      makePoint(P1, "P1", [0, -14], "muted"),
      makePoint(P2, "P2", [0, -14], "muted"),
      makePoint(P3, "P3", [-16, -8]),
      makePoint(P4, "P4", [16, -8]),
      makePoint(P5, "P5", [14, 0], "muted"),
      makePoint(P6, "P6", [14, 0], "muted"),
      makePoint(P7, "P7", [14, 0]),
    ],
    arcCenter: center,
    arcSpokes: [
      [center, P3],
      [center, P4],
    ],
    controlPolygons: [
      [P0, P1, P2, P3],
      [P4, P5, P6, P7],
    ],
    referenceArcPath,
    displayP: p,
    g2: false,
    info: [
      { label: "p", value: p.toFixed(2) },
      { label: "a", value: a.toFixed(2) },
      { label: "b", value: b.toFixed(2) },
      { label: "c", value: c.toFixed(2) },
      { label: "d", value: d.toFixed(2) },
      { label: "arc", value: arcSectionLength.toFixed(2) },
    ],
  };
}

/** Superellipse `|x|^n + |y|^n = R^n`. For n > 2 the curvature is
 *  exactly 0 at the axis crossings, so the curve meets the straight
 *  edges with G2 continuity — no shoulder construction needed. The
 *  CSS `corner-shape: squircle` keyword resolves to n = 4. */
function buildSuperellipse(R: number, exponent: number, cornerX: number, cornerY: number): Curve {
  const P0: Pt = [cornerX - R, cornerY];
  const P7: Pt = [cornerX, cornerY + R];
  const seg = superellipseSegment(cornerX, cornerY, R, exponent);
  // 45° apex point — useful as a labelled landmark.
  const apex = seg.point(0.5);
  const samples = resampleByArcLength([seg]);
  // Peak curvature is at the 45° apex.
  const peakK = Math.abs(seg.curvature(0.5));
  const referenceArcPath = `M ${cornerX - R} ${cornerY} A ${R} ${R} 0 0 1 ${cornerX} ${cornerY + R}`;
  return {
    segments: [seg],
    path: pathFromSamples(samples),
    samples,
    points: [
      makePoint(P0, "P0", [0, -14]),
      makePoint(apex, "apex", [16, -8], "muted"),
      makePoint(P7, "P7", [14, 0]),
    ],
    referenceArcPath,
    displayP: R,
    g2: exponent > 2,
    info: [
      { label: "n", value: exponent.toFixed(2) },
      { label: "peak κ", value: peakK.toFixed(4) },
      { label: "1/R", value: (1 / R).toFixed(4) },
    ],
  };
}

/** Clothoid blend: line → clothoid → arc → clothoid → line.
 *
 *  This is the classic highway/rail transition: curvature ramps
 *  linearly along arc length from 0 (matching the straight edge) up
 *  to 1/R (matching a central circular arc), then mirrored on the
 *  way out. G2 at every seam — the line/clothoid joins are G2-flat
 *  because κ = 0 on both sides, and the clothoid/arc joins are G2
 *  because κ = 1/R on both sides.
 *
 *  Smoothing s ∈ [0, 1] splits the corner's 90° tangent rotation
 *  between the two clothoid halves (each rotating π/4 · s) and the
 *  central arc (rotating (π/2)·(1 − s)). s = 0 collapses to a plain
 *  quarter circle; s = 1 is the pure-clothoid Cornu corner.
 */
function buildClothoid(R: number, smoothing: number, cornerX: number, cornerY: number): Curve {
  const s = Math.max(0, Math.min(1, smoothing));
  // Each clothoid handles (π/4)·s of the 90° corner rotation; the
  // central arc handles the rest.
  const Δθ = (Math.PI / 4) * s;
  // Mean-value Δθ = (1/2)(0 + 1/R)·L ⇒ L = 2RΔθ = πR·s/2.
  const L = (Math.PI / 2) * R * s;

  // Integrate the first clothoid in a *local frame* where P0 sits at
  // the origin with tangent along +x. The same tables drive both
  // (a) the geometry calculation below — we need the endpoint
  // (x_cloth, y_cloth) to know where the arc starts — and (b) the
  // `cloth1` segment further down. Previously these were separate
  // integrations with different N; one Simpson at N=80 here serves both.
  const N_INTEGRATE = 80;
  const A = L > 0 ? 1 / (R * L) : 0;
  const cloth1Tables = integrateClothoid(0, 0, A, L, N_INTEGRATE);
  const x_cloth = cloth1Tables.xs[N_INTEGRATE];
  const y_cloth = cloth1Tables.ys[N_INTEGRATE];

  // Where does the corner (the imagined sharp tip where the two
  // extended edges would meet) sit relative to P0? After the clothoid
  // we're at (x_cloth, y_cloth) with tangent angle Δθ. The arc centre
  // is offset (-sin Δθ, cos Δθ)·R from that point. By the symmetry of
  // the construction the arc centre lies on the corner's 45°-symmetric
  // axis x + y = p — that determines p.
  const arcCentre_local_x = x_cloth - R * Math.sin(Δθ);
  const arcCentre_local_y = y_cloth + R * Math.cos(Δθ);
  const p = arcCentre_local_x + arcCentre_local_y;

  // Translate the local frame so P0 sits at the global (cornerX − p,
  // cornerY); the top edge then runs left from P0 along y = cornerY.
  const P0: Pt = [cornerX - p, cornerY];
  const P7: Pt = [cornerX, cornerY + p];

  const cloth1_start: Pt = P0;
  const arcStart: Pt = [P0[0] + x_cloth, P0[1] + y_cloth];
  const arcCenter: Pt = [P0[0] + arcCentre_local_x, P0[1] + arcCentre_local_y];

  // By symmetry the arc end is the reflection of arcStart across the
  // 45° axis x + y = (cornerX − p) + cornerY + p = cornerX + cornerY.
  const D = cornerX + cornerY;
  const reflect = (pt: Pt): Pt => [D - pt[1], D - pt[0]];
  const arcEnd: Pt = reflect(arcStart);

  // Angles for the SVG arc command.
  const arcStartAngle = Math.atan2(arcStart[1] - arcCenter[1], arcStart[0] - arcCenter[0]);
  const arcEndAngle = Math.atan2(arcEnd[1] - arcCenter[1], arcEnd[0] - arcCenter[0]);

  // Build the per-segment Segment objects for the curvature comb.
  // Clothoid 1: reuses the tables we already integrated above.
  // Clothoid 2: mirror of clothoid 1 — different θ0/κ0/A so it needs
  // its own integration. The arc piece is always present (may be tiny
  // when s → 1, in which case the SVG-A guard skips it).
  const interior: Pt = [cornerX, cornerY];
  const segments: Segment[] = [];
  if (L > 0) {
    segments.push(clothoidSegment(cloth1_start, cloth1Tables, interior));
  }
  const arcSweep = arcEndAngle - arcStartAngle;
  if (Math.abs(arcSweep) > ANGLE_EPSILON) {
    segments.push(arcSegment(arcCenter, R, arcStartAngle, arcEndAngle));
  }
  if (L > 0) {
    // Tangent at arc end is π/2 − Δθ (by symmetry); curvature 1/R
    // ramps back to 0 as the spiral exits.
    const cloth2Tables = integrateClothoid(Math.PI / 2 - Δθ, 1 / R, -A, L, N_INTEGRATE);
    segments.push(clothoidSegment(arcEnd, cloth2Tables, interior));
  }

  const samples = resampleByArcLength(segments);
  const path = pathFromSamples(samples);
  const referenceArcPath = `M ${cornerX - p} ${cornerY} A ${p} ${p} 0 0 1 ${cornerX} ${cornerY + p}`;

  return {
    segments,
    path,
    samples,
    points: [
      makePoint(P0, "P0", [0, -14]),
      makePoint(arcStart, "arc₀", [-16, -8], "muted"),
      makePoint(arcEnd, "arc₁", [16, 0], "muted"),
      makePoint(P7, "P7", [14, 0]),
    ],
    arcCenter,
    arcSpokes: L > 0 || Math.abs(arcSweep) > ANGLE_EPSILON
      ? [
          [arcCenter, arcStart],
          [arcCenter, arcEnd],
        ]
      : [],
    referenceArcPath,
    displayP: p,
    g2: true,
    info: [
      { label: "p", value: p.toFixed(2) },
      { label: "L (each)", value: L.toFixed(2) },
      { label: "1/R", value: (1 / R).toFixed(4) },
      { label: "Δθ_half", value: ((Δθ * 180) / Math.PI).toFixed(1) + "°" },
      { label: "arc sweep", value: (((Math.PI / 2 - 2 * Δθ) * 180) / Math.PI).toFixed(1) + "°" },
    ],
  };
}

// =========================================================================
// Top-level dispatch
// =========================================================================

export interface BuildArgs {
  type: CurveType;
  R: number;
  smoothing: number;
  exponent: number;
  cornerX: number;
  cornerY: number;
}

export function buildCurve(args: BuildArgs): Curve {
  switch (args.type) {
    case "arc":
      return buildArc(args.R, args.cornerX, args.cornerY);
    case "squircle":
      return buildSquircle(args.R, args.smoothing, args.cornerX, args.cornerY);
    case "superellipse":
      return buildSuperellipse(args.R, args.exponent, args.cornerX, args.cornerY);
    case "clothoid":
      return buildClothoid(args.R, args.smoothing, args.cornerX, args.cornerY);
  }
}
