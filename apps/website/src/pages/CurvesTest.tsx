import { SmoothCorners, type CurveType } from "@lisse/react";
import type { BorderConfig, ShadowConfig } from "@lisse/core";

// Dev-only visual verification harness for the four curve types.
// Mounted at /curves-test. Renders each curve at the same radius
// against a matrix of effects (drop shadow, inner shadow, inner border,
// outer border, all stacked) so a reviewer can eyeball whether the
// shadow silhouette tracks the requested curve and the border doesn't
// facet on the superellipse approximation.

const CURVES: CurveType[] = ["arc", "squircle", "superellipse", "clothoid"];
const SIZE = 140;
const RADIUS = 40;
const SMOOTHING = 0.6;

interface EffectConfig {
  id: string;
  label: string;
  background: string;
  shadow?: ShadowConfig;
  innerShadow?: ShadowConfig;
  innerBorder?: BorderConfig;
  outerBorder?: BorderConfig;
  middleBorder?: BorderConfig;
}

const EFFECTS: EffectConfig[] = [
  { id: "none", label: "fill only", background: "#4a5b6b" },
  {
    id: "drop",
    label: "drop shadow",
    background: "#4a5b6b",
    shadow: { offsetX: 0, offsetY: 6, blur: 12, spread: 0, color: "#000", opacity: 0.35 },
  },
  {
    id: "inner",
    label: "inner shadow",
    background: "#7e8c98",
    innerShadow: { offsetX: 0, offsetY: 4, blur: 10, spread: 0, color: "#000", opacity: 0.45 },
  },
  {
    id: "innerBorder",
    label: "4 px inner border",
    background: "#4a5b6b",
    innerBorder: { width: 4, color: "#c1666b", opacity: 1 },
  },
  {
    id: "outerBorder",
    label: "4 px outer border",
    background: "#4a5b6b",
    outerBorder: { width: 4, color: "#c1666b", opacity: 1 },
  },
  {
    id: "thickBorder",
    label: "12 px border",
    background: "#4a5b6b",
    middleBorder: { width: 12, color: "#c1666b", opacity: 1 },
  },
  {
    id: "all",
    label: "shadow + border",
    background: "#7e8c98",
    shadow: { offsetX: 0, offsetY: 6, blur: 12, spread: 0, color: "#000", opacity: 0.35 },
    innerShadow: { offsetX: 0, offsetY: 2, blur: 6, spread: 0, color: "#000", opacity: 0.3 },
    innerBorder: { width: 2, color: "#c1666b", opacity: 1 },
  },
];

export function CurvesTest() {
  return (
    <div className="flex w-full flex-col" style={{ gap: 24, paddingBlock: 40 }}>
      <header>
        <h1 className="text-2xl">Curve × effect verification matrix</h1>
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          Radius {RADIUS}, smoothing {SMOOTHING}. Each row is one curve, each column is one effect.
        </p>
      </header>
      <table style={{ borderCollapse: "separate", borderSpacing: 24 }}>
        <thead>
          <tr>
            <th />
            {EFFECTS.map((e) => (
              <th key={e.id} style={{ fontSize: 12, fontWeight: 400, textAlign: "left" }}>{e.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {CURVES.map((curve) => (
            <tr key={curve}>
              <th style={{ fontSize: 13, fontWeight: 500, textAlign: "right", paddingRight: 8 }}>{curve}</th>
              {EFFECTS.map(({ id, background, ...effectProps }) => (
                <td key={id} style={{ padding: 12 }}>
                  <SmoothCorners
                    corners={{ radius: RADIUS, curve, smoothing: SMOOTHING }}
                    {...effectProps}
                    style={{ width: SIZE, height: SIZE, background }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
