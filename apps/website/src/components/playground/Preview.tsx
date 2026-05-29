import { AnimatePresence, motion } from "framer-motion";
import { SmoothCorners } from "@lisse/react";
import type { BorderConfig, ShadowConfig, SmoothCornerOptions } from "@lisse/core";
import { useIsSafari } from "./is-safari.ts";

interface PreviewProps {
  corners: SmoothCornerOptions;
  shadow?: ShadowConfig | ShadowConfig[];
  innerShadow?: ShadowConfig | ShadowConfig[];
  outerBorder?: BorderConfig;
  innerBorder?: BorderConfig;
  middleBorder?: BorderConfig;
  /** Fill colour for the demo square. Defaults to the Figma swatch. */
  fill?: string;
  /** Square edge length in px. Figma uses 100. */
  size?: number;
}

// Figma "Figure Content" frames across every section.
const CANVAS_HEIGHT = 255;
const DEFAULT_SIZE = 100;
const DEFAULT_FILL = "#7e766d";

// Cap-change crossfade. SVG's `stroke-linecap` is a discrete enum
// (butt | round | square) — there's no native interpolation between
// values. Workaround: stack two transparent border-only SmoothCorners
// keyed by the cap, so AnimatePresence keeps the old one painting at
// opacity 1→0 while the new one fades 0→1. Both layers are visible
// simultaneously during the transition, which reads as a morph rather
// than a blink.
const CAP_CROSSFADE = {
  duration: 0.22,
  ease: [0.32, 0.72, 0, 1] as [number, number, number, number],
};

interface BorderLayerProps {
  corners: SmoothCornerOptions;
  border: BorderConfig | undefined;
  slot: "outer" | "inner" | "middle";
  size: number;
}

// Keyed by lineCap so cap toggles crossfade; other prop updates pass
// through to the same SmoothCorners and animate via parent springs.
// Explicit pixel dimensions (not 100%) so SmoothCorners measures the
// path on first paint without relying on ResizeObserver feedback.
function BorderLayer({ corners, border, slot, size }: BorderLayerProps) {
  const capKey = border?.lineCap ?? "butt";
  return (
    <AnimatePresence initial={false}>
      {border && (
        <motion.div
          key={capKey}
          className="pointer-events-none absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={CAP_CROSSFADE}
        >
          <SmoothCorners
            corners={corners}
            outerBorder={slot === "outer" ? border : undefined}
            innerBorder={slot === "inner" ? border : undefined}
            middleBorder={slot === "middle" ? border : undefined}
            style={{
              width: size,
              height: size,
              backgroundColor: "transparent",
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Preview({
  corners,
  shadow,
  innerShadow,
  outerBorder,
  innerBorder,
  middleBorder,
  fill = DEFAULT_FILL,
  size = DEFAULT_SIZE,
}: PreviewProps) {
  // Server + first client render use "svg"; Safari flips to "box-shadow"
  // after mount (invisible at rest), keeping hydration markup matched.
  const isSafari = useIsSafari();
  return (
    <div
      className="flex w-full items-center justify-center overflow-hidden p-3"
      style={{ height: CANVAS_HEIGHT }}
    >
      <div className="relative" style={{ width: size, height: size }}>
        {/* Base: fill + shadow + inner shadow on a stable SmoothCorners.
            Borders live in separate stacked layers (BorderLayer) so cap
            toggles can crossfade via AnimatePresence without disturbing
            the fill or shadows. `autoEffects` is left at its default so
            the wrapper div never collapses — see the long-form note in
            the git history for the SVG-overlay reparenting bug that
            `autoEffects={false}` previously triggered. */}
        {/* Safari rasterises the SVG <feGaussianBlur> filter software-side
            (WebKit bug 283156). With the shadow params spring-tweening on
            every preset toggle, the filter regenerates 60×/sec and that
            cost compounds with whatever else is repainting. The CSS
            box-shadow path skips the filter graph entirely. Trade-off:
            the silhouette becomes a rounded-rect, not the squircle path
            — visible only on close inspection at the resting state, and
            invisible during the transition that motivated this. */}
        <SmoothCorners
          corners={corners}
          shadow={shadow}
          innerShadow={innerShadow}
          shadowStrategy={isSafari ? "box-shadow" : "svg"}
          style={{
            width: size,
            height: size,
            backgroundColor: fill,
          }}
        />
        <BorderLayer corners={corners} border={outerBorder} slot="outer" size={size} />
        <BorderLayer corners={corners} border={innerBorder} slot="inner" size={size} />
        <BorderLayer corners={corners} border={middleBorder} slot="middle" size={size} />
      </div>
    </div>
  );
}
