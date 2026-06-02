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
import { m } from "../paraglide/messages.js";

export function Playground() {
  // Resolved per render so the request's active locale wins (a module-scope
  // m.*() call would lock to the import-time locale and show English on every
  // localized page). Shared by the three BorderSection variants below.
  const borderDesc = m.playground_border_description();
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
            title={m.playground_drop_shadow_title()}
            description={m.playground_drop_shadow_description()}
            kind="drop"
          />
        </Stagger>
        <Stagger index={10}>
          <ShadowSection
            title={m.playground_inner_shadow_title()}
            description={m.playground_inner_shadow_description()}
            kind="inner"
          />
        </Stagger>
        <Stagger index={11}>
          <BorderSection title={m.playground_outer_border_title()} description={borderDesc} position="outer" />
        </Stagger>
        <Stagger index={12}>
          <BorderSection title={m.playground_inner_border_title()} description={borderDesc} position="inner" />
        </Stagger>
        <Stagger index={13}>
          <BorderSection title={m.playground_center_border_title()} description={borderDesc} position="middle" />
        </Stagger>
        <Stagger index={14}>
          <CurveTypeSection />
        </Stagger>
      </div>
    </PlaygroundTuningProvider>
  );
}
