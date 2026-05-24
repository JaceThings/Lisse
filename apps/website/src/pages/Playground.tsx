import { Stagger } from "../components/Stagger.tsx";
import {
  DEFAULT_TUNING,
  PlaygroundTuningProvider,
} from "../components/playground/PlaygroundTuning.tsx";
import { BorderSection } from "../components/playground/sections/BorderSection.tsx";
import { CornerShapeSection } from "../components/playground/sections/CornerShapeSection.tsx";
import { CurveTypeSection } from "../components/playground/sections/CurveTypeSection.tsx";
import { PerCornerSection } from "../components/playground/sections/PerCornerSection.tsx";
import { RadiusSection } from "../components/playground/sections/RadiusSection.tsx";
import { ShadowSection } from "../components/playground/sections/ShadowSection.tsx";

const BORDER_DESC =
  "Stroke borders that follow the smooth corner path. Solid, dashed, dotted, double, groove, ridge — the standard CSS line styles.";

export function Playground() {
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
        <Stagger index={14}>
          <CurveTypeSection />
        </Stagger>
      </div>
    </PlaygroundTuningProvider>
  );
}
