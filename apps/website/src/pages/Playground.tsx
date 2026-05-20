import { useMemo } from "react";
import { DialRoot, useDialKit } from "dialkit";
import "dialkit/styles.css";
import { Stagger } from "../components/Stagger.tsx";
import {
  DEFAULT_TUNING,
  PlaygroundTuningProvider,
  type PlaygroundTuning,
} from "../components/playground/PlaygroundTuning.tsx";
import { BorderSection } from "../components/playground/sections/BorderSection.tsx";
import { CornerShapeSection } from "../components/playground/sections/CornerShapeSection.tsx";
import { PerCornerSection } from "../components/playground/sections/PerCornerSection.tsx";
import { RadiusSection } from "../components/playground/sections/RadiusSection.tsx";
import { ShadowSection } from "../components/playground/sections/ShadowSection.tsx";

export function Playground() {
  const dial = useDialKit("Playground Tuning", {
    stretch: {
      maxStretchPx: [DEFAULT_TUNING.maxStretchPx, 2, 50, 1],
      deadZonePx: [DEFAULT_TUNING.deadZonePx, 0, 100, 2],
      cursorRangePx: [DEFAULT_TUNING.cursorRangePx, 50, 600, 10],
      compressY: [DEFAULT_TUNING.compressY, 0.5, 1, 0.01],
    },
    release: {
      springStiffness: [DEFAULT_TUNING.springStiffness, 50, 1000, 10],
      springDamping: [DEFAULT_TUNING.springDamping, 5, 100, 1],
      springMass: [DEFAULT_TUNING.springMass, 0.1, 5, 0.1],
    },
    track: {
      height: [DEFAULT_TUNING.trackHeight, 2, 20, 1],
      smoothing: [DEFAULT_TUNING.trackSmoothing, 0, 1, 0.05],
    },
    stepHaptic: DEFAULT_TUNING.stepHaptic,
  });

  // dialkit returns a fresh nested object on every store update, so a plain
  // object literal here would invalidate context for every Slider on each
  // dialkit keystroke. Memoise on primitive deps so identity only changes
  // when a tuning value actually changes.
  const tuning: PlaygroundTuning = useMemo(
    () => ({
      maxStretchPx: dial.stretch.maxStretchPx,
      deadZonePx: dial.stretch.deadZonePx,
      cursorRangePx: dial.stretch.cursorRangePx,
      compressY: dial.stretch.compressY,
      springStiffness: dial.release.springStiffness,
      springDamping: dial.release.springDamping,
      springMass: dial.release.springMass,
      trackHeight: dial.track.height,
      trackSmoothing: dial.track.smoothing,
      stepHaptic: dial.stepHaptic,
    }),
    [
      dial.stretch.maxStretchPx,
      dial.stretch.deadZonePx,
      dial.stretch.cursorRangePx,
      dial.stretch.compressY,
      dial.release.springStiffness,
      dial.release.springDamping,
      dial.release.springMass,
      dial.track.height,
      dial.track.smoothing,
      dial.stepHaptic,
    ],
  );

  return (
    <PlaygroundTuningProvider value={tuning}>
      {/* Indices 0–5 are reserved for the Header; body starts at 6.
          48px between sections matches Figma `--p-12`. */}
      <div className="flex w-full flex-col" style={{ gap: 48 }}>
        <Stagger index={6}>
          <RadiusSection />
        </Stagger>
        <Stagger index={7}>
          <CornerShapeSection />
        </Stagger>
        <Stagger index={8}>
          <PerCornerSection />
        </Stagger>
        <Stagger index={9}>
          <ShadowSection
            title="Drop Shadow"
            description="SVG-based drop shadows that follow the smooth corner path exactly."
            kind="drop"
          />
        </Stagger>
        <Stagger index={10}>
          <ShadowSection
            title="Inner Shadow"
            description="Inset shadows rendered inside the smooth corner path for depth and dimension."
            kind="inner"
          />
        </Stagger>
        <Stagger index={11}>
          <BorderSection
            title="Outer Border"
            description="Stroke borders that perfectly trace the smooth corner path. Supports multiple line styles."
            position="outer"
          />
        </Stagger>
        <Stagger index={12}>
          <BorderSection
            title="Inner Border"
            description="Stroke borders that perfectly trace the smooth corner path. Supports multiple line styles."
            position="inner"
          />
        </Stagger>
        <Stagger index={13}>
          <BorderSection
            title="Center Border"
            description="Stroke borders that perfectly trace the smooth corner path. Supports multiple line styles."
            position="middle"
          />
        </Stagger>
      </div>
      {/* DialRoot lives inside the Playground so dialkit + its CSS only load
          on this route. `productionEnabled` defaults to false — dialkit hides
          itself in production builds. */}
      <DialRoot position="bottom-right" defaultOpen={false} />
    </PlaygroundTuningProvider>
  );
}
