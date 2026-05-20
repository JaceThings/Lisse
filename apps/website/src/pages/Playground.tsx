import { useEffect } from "react";
import { DialRoot, useDialKit } from "dialkit";
import "dialkit/styles.css";
import { Stagger } from "../components/Stagger.tsx";
import {
  DEFAULT_TUNING,
  PlaygroundTuningProvider,
} from "../components/playground/PlaygroundTuning.tsx";
import { BorderSection } from "../components/playground/sections/BorderSection.tsx";
import { CornerShapeSection } from "../components/playground/sections/CornerShapeSection.tsx";
import { PerCornerSection } from "../components/playground/sections/PerCornerSection.tsx";
import { RadiusSection } from "../components/playground/sections/RadiusSection.tsx";
import { ShadowSection } from "../components/playground/sections/ShadowSection.tsx";
import { soundConfig } from "../lib/sounds.ts";

const BORDER_DESC =
  "Stroke borders that follow the smooth corner path. Solid, dashed, dotted, double, groove, ridge — the standard CSS line styles.";

export function Playground() {
  // Spring/cursor/track values are baked in at DEFAULT_TUNING — the dial
  // now lives for sound tweaking instead. Each entry is [default, min,
  // max, step]; the playback-rate sliders double as pitch (>1 raises
  // pitch + shortens, <1 lowers + lengthens).
  const dial = useDialKit("Sounds", {
    click: {
      volume: [soundConfig.click.volume, 0, 1, 0.05],
      pitch: [soundConfig.click.pitch, 0.5, 2.0, 0.05],
    },
    pill: {
      volume: [soundConfig.pill.volume, 0, 1, 0.05],
      pitch: [soundConfig.pill.pitch, 0.5, 2.0, 0.05],
    },
    tick: {
      volume: [soundConfig.tick.volume, 0, 1, 0.01],
      pitch: [soundConfig.tick.pitch, 0.5, 2.0, 0.05],
    },
    copy: {
      volume: [soundConfig.copy.volume, 0, 1, 0.05],
      pitch: [soundConfig.copy.pitch, 0.5, 2.0, 0.05],
    },
  });

  // Mirror dial values into the mutable sound config so play() reads the
  // latest values without re-rendering anything that uses sounds.
  useEffect(() => {
    soundConfig.click.volume = dial.click.volume;
    soundConfig.click.pitch = dial.click.pitch;
    soundConfig.pill.volume = dial.pill.volume;
    soundConfig.pill.pitch = dial.pill.pitch;
    soundConfig.tick.volume = dial.tick.volume;
    soundConfig.tick.pitch = dial.tick.pitch;
    soundConfig.copy.volume = dial.copy.volume;
    soundConfig.copy.pitch = dial.copy.pitch;
  }, [
    dial.click.volume, dial.click.pitch,
    dial.pill.volume, dial.pill.pitch,
    dial.tick.volume, dial.tick.pitch,
    dial.copy.volume, dial.copy.pitch,
  ]);

  return (
    <PlaygroundTuningProvider value={DEFAULT_TUNING}>
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
            description="SVG-based drop shadows traced from the same squircle path as the element above. Matches the surface shape at any radius."
            kind="drop"
          />
        </Stagger>
        <Stagger index={10}>
          <ShadowSection
            title="Inner Shadow"
            description="Inset shadows rendered inside the smooth corner path. Useful for recessed surfaces, pressed states, or a soft fill underneath."
            kind="inner"
          />
        </Stagger>
        <Stagger index={11}>
          <BorderSection title="Outer Border" description={BORDER_DESC} position="outer" />
        </Stagger>
        <Stagger index={12}>
          <BorderSection title="Inner Border" description={BORDER_DESC} position="inner" />
        </Stagger>
        <Stagger index={13}>
          <BorderSection title="Center Border" description={BORDER_DESC} position="middle" />
        </Stagger>
      </div>
      {/* DialRoot lives inside the Playground so dialkit + its CSS only load
          on this route. `productionEnabled` defaults to false — dialkit hides
          itself in production builds. */}
      <DialRoot position="bottom-right" defaultOpen={false} />
    </PlaygroundTuningProvider>
  );
}
