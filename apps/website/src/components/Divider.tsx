import { SmoothCorners } from "@lisse/react";

// Wrapped in SmoothCorners (radius is cosmetic at 1.25px) to keep every
// rounded surface on this page routed through Lisse.
export function Divider() {
  return (
    <SmoothCorners
      asChild
      autoEffects={false}
      corners={{ radius: 0.625, smoothing: 0 }}
    >
      <div
        role="separator"
        className="h-[1.25px] w-full bg-gradient-to-r from-divider-from to-divider-to"
      />
    </SmoothCorners>
  );
}
