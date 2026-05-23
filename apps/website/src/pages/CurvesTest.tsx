import { SmoothCorners, type CurveType } from "@lisse/react";

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

type Effect =
  | "none"
  | "drop"
  | "inner"
  | "innerBorder"
  | "outerBorder"
  | "thickBorder"
  | "all";

const EFFECT_LABELS: Record<Effect, string> = {
  none: "fill only",
  drop: "drop shadow",
  inner: "inner shadow",
  innerBorder: "4 px inner border",
  outerBorder: "4 px outer border",
  thickBorder: "12 px border",
  all: "shadow + border",
};

const EFFECTS: Effect[] = ["none", "drop", "inner", "innerBorder", "outerBorder", "thickBorder", "all"];

function Cell({ curve, effect }: { curve: CurveType; effect: Effect }) {
  const corners = { radius: RADIUS, curve, smoothing: SMOOTHING };
  switch (effect) {
    case "drop":
      return (
        <SmoothCorners
          corners={corners}
          shadow={{ offsetX: 0, offsetY: 6, blur: 12, spread: 0, color: "#000", opacity: 0.35 }}
          style={{ width: SIZE, height: SIZE, background: "#4a5b6b" }}
        />
      );
    case "inner":
      return (
        <SmoothCorners
          corners={corners}
          innerShadow={{ offsetX: 0, offsetY: 4, blur: 10, spread: 0, color: "#000", opacity: 0.45 }}
          style={{ width: SIZE, height: SIZE, background: "#7e8c98" }}
        />
      );
    case "innerBorder":
      return (
        <SmoothCorners
          corners={corners}
          innerBorder={{ width: 4, color: "#c1666b", opacity: 1 }}
          style={{ width: SIZE, height: SIZE, background: "#4a5b6b" }}
        />
      );
    case "outerBorder":
      return (
        <SmoothCorners
          corners={corners}
          outerBorder={{ width: 4, color: "#c1666b", opacity: 1 }}
          style={{ width: SIZE, height: SIZE, background: "#4a5b6b" }}
        />
      );
    case "thickBorder":
      return (
        <SmoothCorners
          corners={corners}
          middleBorder={{ width: 12, color: "#c1666b", opacity: 1 }}
          style={{ width: SIZE, height: SIZE, background: "#4a5b6b" }}
        />
      );
    case "all":
      return (
        <SmoothCorners
          corners={corners}
          shadow={{ offsetX: 0, offsetY: 6, blur: 12, spread: 0, color: "#000", opacity: 0.35 }}
          innerBorder={{ width: 2, color: "#c1666b", opacity: 1 }}
          innerShadow={{ offsetX: 0, offsetY: 2, blur: 6, spread: 0, color: "#000", opacity: 0.3 }}
          style={{ width: SIZE, height: SIZE, background: "#7e8c98" }}
        />
      );
    case "none":
    default:
      return (
        <SmoothCorners
          corners={corners}
          style={{ width: SIZE, height: SIZE, background: "#4a5b6b" }}
        />
      );
  }
}

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
              <th key={e} style={{ fontSize: 12, fontWeight: 400, textAlign: "left" }}>{EFFECT_LABELS[e]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {CURVES.map((c) => (
            <tr key={c}>
              <th style={{ fontSize: 13, fontWeight: 500, textAlign: "right", paddingRight: 8 }}>{c}</th>
              {EFFECTS.map((e) => (
                <td key={e} style={{ padding: 12 }}>
                  <Cell curve={c} effect={e} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
