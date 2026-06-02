import { SmoothCorners, type CurveType } from "@lisse/react";
import type { BorderConfig, ShadowConfig } from "@lisse/core";
import { m } from "../paraglide/messages.js";

// Dev-only visual verification harness for the four curve types.
// Mounted at /curves-test. Each curve renders at the same radius across
// a matrix of effects (drop shadow, inner shadow, inner border, outer
// border, all stacked) so a reviewer can eyeball whether the shadow
// silhouette tracks the requested curve and the border doesn't facet
// on the superellipse approximation.

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

const buildEffects = (): EffectConfig[] => [
  { id: "none", label: m.curves_effect_fill_only(), background: "#4a5b6b" },
  {
    id: "drop",
    label: m.curves_effect_drop_shadow(),
    background: "#4a5b6b",
    shadow: { offsetX: 0, offsetY: 6, blur: 12, spread: 0, color: "#000", opacity: 0.35 },
  },
  {
    id: "inner",
    label: m.curves_effect_inner_shadow(),
    background: "#7e8c98",
    innerShadow: { offsetX: 0, offsetY: 4, blur: 10, spread: 0, color: "#000", opacity: 0.45 },
  },
  {
    id: "innerBorder",
    label: m.curves_effect_inner_border({ n: 4 }),
    background: "#4a5b6b",
    innerBorder: { width: 4, color: "#c1666b", opacity: 1 },
  },
  {
    id: "outerBorder",
    label: m.curves_effect_outer_border({ n: 4 }),
    background: "#4a5b6b",
    outerBorder: { width: 4, color: "#c1666b", opacity: 1 },
  },
  {
    id: "thickBorder",
    label: m.curves_effect_border({ n: 12 }),
    background: "#4a5b6b",
    middleBorder: { width: 12, color: "#c1666b", opacity: 1 },
  },
  {
    id: "all",
    label: m.curves_effect_shadow_and_border(),
    background: "#7e8c98",
    shadow: { offsetX: 0, offsetY: 6, blur: 12, spread: 0, color: "#000", opacity: 0.35 },
    innerShadow: { offsetX: 0, offsetY: 2, blur: 6, spread: 0, color: "#000", opacity: 0.3 },
    innerBorder: { width: 2, color: "#c1666b", opacity: 1 },
  },
];

export function CurvesTest() {
  // Built per render so the request's active locale wins (a module-scope m.*()
  // array would lock to the import-time locale). Feeds the matrix below.
  const EFFECTS = buildEffects();
  return (
    <div className="flex w-full flex-col" style={{ gap: 24, paddingBlock: 40 }}>
      <header>
        <h1 className="text-2xl">{m.curves_matrix_title()}</h1>
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          {m.curves_matrix_description({ radius: RADIUS, smoothing: SMOOTHING })}
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
