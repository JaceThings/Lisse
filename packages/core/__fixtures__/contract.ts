// Shared fixture matrix consumed by every adapter's `contract.test.*`.
//
// Each adapter renders the same inputs and reads the same output back
// from the DOM. The contract under test: each wrapper feeds the same
// props, defaults, dimensions, and effects into core. Drift in any
// adapter shows up as a labelled failure.
//
// This file is the ONE source of truth for the matrices — adapters
// only import; they never define their own cases. Adapter components
// have slightly different effect-prop shapes (React/Vue spread the
// effects fields as top-level props; Svelte nests them under `effects`)
// so each test file does the small translation.

import type {
  CornerConfig,
  PerCornerConfig,
  SmoothCornerOptions,
  EffectsConfig,
  CurveType,
} from "../src/types.js";

export interface ContractCase {
  /** Stable, unique slug used as the test case name and snapshot key. */
  name: string;
  /** Box dimensions the adapter must stub on the rendered element. */
  width: number;
  height: number;
  /** Corner config — either uniform or per-corner — passed to the adapter. */
  corners: SmoothCornerOptions;
}

export interface EffectsContractCase extends ContractCase {
  effects: EffectsConfig;
}

const RADII = [10, 40, 100] as const;
const CURVES: CurveType[] = ["arc", "squircle", "superellipse", "clothoid"];

/** Curve × radius cross-product + layout-shape edge cases. */
export const PROP_MATRIX: ContractCase[] = (() => {
  const cases: ContractCase[] = [];

  // 12 cases: 4 curves × 3 radii at smoothing=0.6 (the Figma default).
  for (const curve of CURVES) {
    for (const r of RADII) {
      const corners: CornerConfig = { radius: r, smoothing: 0.6, curve };
      cases.push({
        name: `${curve}_r${r}_s0.6_200x100`,
        width: 200,
        height: 100,
        corners,
      });
    }
  }

  // 4 cases: smoothing extremes for each curve at one canonical radius.
  for (const curve of CURVES) {
    const corners: CornerConfig = { radius: 40, smoothing: 1, curve };
    cases.push({
      name: `${curve}_r40_s1_200x100`,
      width: 200,
      height: 100,
      corners,
    });
  }

  // 1 case: non-square box. Catches anything that assumes square aspect.
  cases.push({
    name: `squircle_r24_s0.6_500x80_nonsquare`,
    width: 500,
    height: 80,
    corners: { radius: 24, smoothing: 0.6, curve: "squircle" },
  });

  // 1 case: asymmetric per-corner radii (number shorthand).
  const perCorner: PerCornerConfig = {
    topLeft: 10,
    topRight: 40,
    bottomRight: 10,
    bottomLeft: 40,
  };
  cases.push({
    name: `perCorner_asymmetric_200x100`,
    width: 200,
    height: 100,
    corners: perCorner,
  });

  // 1 case: oversized radius — must clamp to the half-side budget.
  cases.push({
    name: `squircle_r1000_clamps_200x100`,
    width: 200,
    height: 100,
    corners: { radius: 1000, smoothing: 0.6, curve: "squircle" },
  });

  // 1 case: tiny box. Edge case where geometry can underflow.
  cases.push({
    name: `arc_r4_s0_20x20_tiny`,
    width: 20,
    height: 20,
    corners: { radius: 4, smoothing: 0, curve: "arc" },
  });

  return cases;
})();

/** Border-only, shadow-only, and combined effects across two curves. */
export const EFFECTS_MATRIX: EffectsContractCase[] = [
  {
    name: "squircle_innerBorder",
    width: 200,
    height: 100,
    corners: { radius: 24, smoothing: 0.6, curve: "squircle" },
    effects: {
      innerBorder: { width: 2, color: "#000000", opacity: 1 },
    },
  },
  {
    name: "arc_innerBorder_thick",
    width: 200,
    height: 100,
    corners: { radius: 16, smoothing: 0, curve: "arc" },
    effects: {
      innerBorder: { width: 6, color: "rgb(255, 0, 0)", opacity: 0.5 },
    },
  },
  {
    name: "squircle_dropShadow",
    width: 200,
    height: 100,
    corners: { radius: 24, smoothing: 0.6, curve: "squircle" },
    effects: {
      shadow: { offsetX: 0, offsetY: 4, blur: 12, spread: 0, color: "#000000", opacity: 0.5 },
    },
  },
  {
    name: "squircle_combined",
    width: 200,
    height: 100,
    corners: { radius: 24, smoothing: 0.6, curve: "squircle" },
    effects: {
      innerBorder: { width: 2, color: "#000000", opacity: 1 },
      shadow: { offsetX: 0, offsetY: 4, blur: 12, spread: 0, color: "#000000", opacity: 0.5 },
    },
  },
  {
    name: "superellipse_innerBorder",
    width: 240,
    height: 120,
    corners: { radius: 32, smoothing: 0.6, exponent: 5, curve: "superellipse" },
    effects: {
      innerBorder: { width: 2, color: "#222222", opacity: 0.8 },
    },
  },
  {
    name: "clothoid_innerBorder",
    width: 240,
    height: 120,
    corners: { radius: 32, smoothing: 0.6, curve: "clothoid" },
    effects: {
      innerBorder: { width: 2, color: "#222222", opacity: 0.8 },
    },
  },
];
