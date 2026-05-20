import { SmoothCorners } from "@lisse/react";
import type { ReactNode } from "react";
import { CARD_SHADOW } from "../lib/shadow.ts";

// Wraps via `asChild` so radius, smoothing, and the 5-layer shadow apply
// to the real button/div rather than an extra layer of DOM.
export function Card({ children }: { children: ReactNode }) {
  return (
    <SmoothCorners
      asChild
      autoEffects={false}
      corners={{ radius: 8, smoothing: 0.6 }}
      shadow={CARD_SHADOW}
    >
      {children}
    </SmoothCorners>
  );
}
