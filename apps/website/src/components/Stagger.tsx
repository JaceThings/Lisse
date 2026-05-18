import type { ReactNode } from "react";

interface StaggerProps {
  /** Retained for API compatibility; no longer used. */
  index: number;
  children: ReactNode;
}

/**
 * No-op wrapper. Previously rendered a fade-in-blur entrance animation
 * on first page load. Removed because Safari's SVG-filter rasterisation
 * budget got demoted as the multi-Stagger entrance settled across the
 * page — visible as harder, heavier shadows on the demo's toggle pills
 * compared to the install rows below. Disabling the entrance brought
 * the homepage back into parity with the `/lab` reference renders.
 *
 * `index` and the wrapper `<div>` stay so callers (Header / Intro /
 * Install / App) don't have to change and React's keying behaviour
 * stays stable.
 */
export function Stagger({ children }: StaggerProps) {
  return <div>{children}</div>;
}
