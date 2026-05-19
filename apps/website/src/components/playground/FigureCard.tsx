import { SmoothCorners } from "@lisse/react";
import type { ReactNode } from "react";
import type { ShadowConfig } from "@lisse/core";

// Figma's white control-card sits on a 1px hairline plus a soft 2px lift
// (rgba(119,119,119,0.08)). Rendered via Lisse so the silhouette traces
// the asymmetric corners (12px top, 20px bottom) — a CSS box-shadow would
// bleed past the squircle outline that Lisse clips.
const FIGURE_SHADOW: ShadowConfig[] = [
  { offsetX: 0, offsetY: 0, blur: 0, spread: 1, color: "#777777", opacity: 0.08 },
  { offsetX: 0, offsetY: 2, blur: 1, spread: -0.5, color: "#777777", opacity: 0.08 },
];

export function FigureCard({ children }: { children: ReactNode }) {
  return (
    <SmoothCorners
      asChild
      autoEffects={false}
      corners={{
        topLeft: { radius: 12, smoothing: 0.6 },
        topRight: { radius: 12, smoothing: 0.6 },
        bottomLeft: { radius: 20, smoothing: 0.6 },
        bottomRight: { radius: 20, smoothing: 0.6 },
      }}
      shadow={FIGURE_SHADOW}
    >
      <div className="flex w-full flex-col items-center justify-center overflow-hidden bg-white">
        {children}
      </div>
    </SmoothCorners>
  );
}
