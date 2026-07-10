// Curated golden snapshots.
//
// These are an API lock on identity, not a proof of correctness:
// correctness is covered by property tests (invariants.test.ts) and
// reference-shape tests (reference-shape.test.ts). The snapshots here
// catch any unintentional change to the exact `d` string a real
// consumer sees — including subtle cubic Bézier control point drift
// that all the other tests would let through.
//
// Cases are hand-picked for diversity, not Cartesian coverage:
//   - boundaries: radius=0, smoothing extremes, oversized radius
//   - layout: non-square boxes, asymmetric per-corner radii
//   - canonical: Apple-equivalent squircle output is part of the spec
//
// ~40 entries grouped by curve type. Each is stored once in the .snap
// file; PR review surface is the snap diff.
import { describe, it, expect } from "vitest";
import { generatePath } from "../src/generate-path.js";
import svgpath from "svgpath";
import type { SmoothCornerOptions } from "../src/types.js";

/**
 * Canonicalise SVG path strings before snapshot storage. Round to 4
 * decimals (the same precision `generatePath` uses) so cosmetic float
 * drift never churns the snapshot. Always absolute commands; whitespace
 * normalised.
 */
function canonical(d: string): string {
  return svgpath(d).abs().round(4).toString();
}

interface SnapshotCase {
  name: string;
  width: number;
  height: number;
  opts: SmoothCornerOptions;
}

const ARC_CASES: SnapshotCase[] = [
  { name: "radius_0", width: 200, height: 100, opts: { radius: 0, curve: "arc" } },
  { name: "small_r4_s0", width: 200, height: 100, opts: { radius: 4, smoothing: 0, curve: "arc" } },
  { name: "medium_r40_s0", width: 200, height: 100, opts: { radius: 40, smoothing: 0, curve: "arc" } },
  { name: "oversized_clamps", width: 200, height: 100, opts: { radius: 1000, curve: "arc" } },
  { name: "nonsquare_500x80", width: 500, height: 80, opts: { radius: 20, curve: "arc" } },
  { name: "tiny_20x20", width: 20, height: 20, opts: { radius: 4, curve: "arc" } },
];

const SQUIRCLE_CASES: SnapshotCase[] = [
  {
    name: "apple_canonical_default",
    width: 200,
    height: 200,
    opts: { radius: 24, smoothing: 0.6, curve: "squircle" },
  },
  {
    name: "smoothing_0_collapse_to_arc",
    width: 200,
    height: 100,
    opts: { radius: 24, smoothing: 0, curve: "squircle" },
  },
  {
    name: "smoothing_1_max",
    width: 200,
    height: 100,
    opts: { radius: 40, smoothing: 1, curve: "squircle" },
  },
  {
    name: "small_r4_default",
    width: 200,
    height: 100,
    opts: { radius: 4, smoothing: 0.6, curve: "squircle" },
  },
  {
    name: "oversized_clamps_to_budget",
    width: 200,
    height: 100,
    opts: { radius: 1000, smoothing: 0.6, curve: "squircle" },
  },
  {
    name: "nonsquare_500x80",
    width: 500,
    height: 80,
    opts: { radius: 24, smoothing: 0.6, curve: "squircle" },
  },
  {
    name: "asymmetric_per_corner",
    width: 200,
    height: 100,
    opts: {
      topLeft: { radius: 10, smoothing: 0.6, curve: "squircle" },
      topRight: { radius: 40, smoothing: 0.6, curve: "squircle" },
      bottomRight: { radius: 10, smoothing: 0.6, curve: "squircle" },
      bottomLeft: { radius: 40, smoothing: 0.6, curve: "squircle" },
    },
  },
  {
    name: "asymmetric_per_corner_shorthand",
    width: 200,
    height: 100,
    opts: { topLeft: 8, topRight: 32, bottomRight: 8, bottomLeft: 32 },
  },
];

const SUPERELLIPSE_CASES: SnapshotCase[] = [
  {
    name: "n2_quarter_circle",
    width: 200,
    height: 100,
    opts: { radius: 40, exponent: 2, curve: "superellipse" },
  },
  {
    name: "n4_default",
    width: 200,
    height: 100,
    opts: { radius: 40, exponent: 4, curve: "superellipse" },
  },
  {
    name: "n5_sharper",
    width: 200,
    height: 100,
    opts: { radius: 40, exponent: 5, curve: "superellipse" },
  },
  {
    name: "n8_extreme",
    width: 200,
    height: 100,
    opts: { radius: 40, exponent: 8, curve: "superellipse" },
  },
  {
    name: "small_r4_n4",
    width: 200,
    height: 100,
    opts: { radius: 4, exponent: 4, curve: "superellipse" },
  },
  {
    name: "oversized_clamps",
    width: 200,
    height: 100,
    opts: { radius: 1000, exponent: 4, curve: "superellipse" },
  },
  {
    name: "nonsquare_500x80",
    width: 500,
    height: 80,
    opts: { radius: 24, exponent: 4, curve: "superellipse" },
  },
];

const CLOTHOID_CASES: SnapshotCase[] = [
  {
    name: "smoothing_0_collapse_to_arc",
    width: 200,
    height: 100,
    opts: { radius: 40, smoothing: 0, curve: "clothoid" },
  },
  {
    name: "smoothing_03",
    width: 200,
    height: 100,
    opts: { radius: 40, smoothing: 0.3, curve: "clothoid" },
  },
  {
    name: "smoothing_06_default",
    width: 200,
    height: 100,
    opts: { radius: 40, smoothing: 0.6, curve: "clothoid" },
  },
  {
    name: "smoothing_1_pure_cornu",
    width: 200,
    height: 100,
    opts: { radius: 40, smoothing: 1, curve: "clothoid" },
  },
  {
    name: "small_r4",
    width: 200,
    height: 100,
    opts: { radius: 4, smoothing: 0.6, curve: "clothoid" },
  },
  {
    name: "large_r100",
    width: 400,
    height: 200,
    opts: { radius: 100, smoothing: 0.6, curve: "clothoid" },
  },
  {
    name: "oversized_clamps",
    width: 200,
    height: 100,
    opts: { radius: 1000, smoothing: 0.6, curve: "clothoid" },
  },
  {
    name: "nonsquare_500x80",
    width: 500,
    height: 80,
    opts: { radius: 24, smoothing: 0.6, curve: "clothoid" },
  },
];

const MIXED_CASES: SnapshotCase[] = [
  {
    name: "mixed_curves_per_corner",
    width: 200,
    height: 100,
    opts: {
      topLeft: { radius: 20, curve: "arc" },
      topRight: { radius: 20, smoothing: 0.6, curve: "squircle" },
      bottomRight: { radius: 20, exponent: 5, curve: "superellipse" },
      bottomLeft: { radius: 20, smoothing: 0.6, curve: "clothoid" },
    },
  },
  {
    name: "mixed_radii_same_curve",
    width: 300,
    height: 150,
    opts: {
      topLeft: { radius: 8, smoothing: 0.6, curve: "squircle" },
      topRight: { radius: 24, smoothing: 0.6, curve: "squircle" },
      bottomRight: { radius: 48, smoothing: 0.6, curve: "squircle" },
      bottomLeft: { radius: 16, smoothing: 0.6, curve: "squircle" },
    },
  },
  {
    name: "mixed_curves_oversized_one_corner",
    width: 200,
    height: 100,
    opts: {
      topLeft: { radius: 8, smoothing: 0.6, curve: "squircle" },
      topRight: { radius: 500, smoothing: 0.6, curve: "squircle" },
      bottomRight: { radius: 8, smoothing: 0.6, curve: "squircle" },
      bottomLeft: { radius: 8, smoothing: 0.6, curve: "squircle" },
    },
  },
  {
    name: "mixed_zero_some_corners",
    width: 200,
    height: 100,
    opts: {
      topLeft: { radius: 0, curve: "arc" },
      topRight: { radius: 24, smoothing: 0.6, curve: "squircle" },
      bottomRight: { radius: 0, curve: "arc" },
      bottomLeft: { radius: 24, smoothing: 0.6, curve: "squircle" },
    },
  },
  {
    name: "mixed_smoothing_extremes_per_corner",
    width: 200,
    height: 100,
    opts: {
      topLeft: { radius: 24, smoothing: 0, curve: "squircle" },
      topRight: { radius: 24, smoothing: 0.6, curve: "squircle" },
      bottomRight: { radius: 24, smoothing: 1, curve: "squircle" },
      bottomLeft: { radius: 24, smoothing: 0.3, curve: "squircle" },
    },
  },
  {
    name: "mixed_pill_shape_400x80",
    width: 400,
    height: 80,
    opts: { radius: 40, smoothing: 0.6, curve: "squircle" },
  },
  {
    name: "mixed_portrait_tall_100x500",
    width: 100,
    height: 500,
    opts: { radius: 40, smoothing: 0.6, curve: "squircle" },
  },
  {
    name: "mixed_pill_arc",
    width: 400,
    height: 80,
    opts: { radius: 40, curve: "arc" },
  },
  {
    name: "mixed_tight_square_50x50",
    width: 50,
    height: 50,
    opts: { radius: 12, smoothing: 0.6, curve: "squircle" },
  },
];

function runSuite(title: string, cases: SnapshotCase[]): void {
  describe(title, () => {
    // One snapshot per curve family: store the whole grid as one keyed
    // object. PR diffs land in a single block per family, not 8 noise
    // sub-snapshots.
    it("matches golden grid", () => {
      const grid: Record<string, string> = {};
      for (const c of cases) {
        grid[c.name] = canonical(generatePath(c.width, c.height, c.opts));
      }
      expect(grid).toMatchSnapshot();
    });
  });
}

runSuite("Snapshots — arc", ARC_CASES);
runSuite("Snapshots — squircle", SQUIRCLE_CASES);
runSuite("Snapshots — superellipse", SUPERELLIPSE_CASES);
runSuite("Snapshots — clothoid", CLOTHOID_CASES);
runSuite("Snapshots — mixed", MIXED_CASES);
