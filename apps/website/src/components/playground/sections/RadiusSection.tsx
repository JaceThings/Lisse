import { useCallback, useState } from "react";
import { Collapse } from "../Collapse.tsx";
import { FigureCard } from "../FigureCard.tsx";
import { Preview } from "../Preview.tsx";
import { RadioPillGroup } from "../RadioPillGroup.tsx";
import { Section } from "../Section.tsx";
import { Slider } from "../Slider.tsx";
import { useStateSpring } from "../springs.ts";
import { ROW_DIVIDER } from "../styles.ts";
import { m } from "../../../paraglide/messages.js";

type RadiusPreset = "0" | "20" | "50" | "custom";

export function RadiusSection() {
  const RADIUS_PRESETS = [
    { value: "0", label: m.section_radius_preset_0() },
    { value: "20", label: m.section_radius_preset_20() },
    { value: "50", label: m.section_radius_preset_50() },
    { value: "custom", label: m.section_radius_preset_custom() },
  ] as const satisfies ReadonlyArray<{ value: RadiusPreset; label: string }>;

  const [preset, setPreset] = useState<RadiusPreset>("20");
  const [radius, setRadius] = useState(20);
  const [fromDrag, setFromDrag] = useState(false);

  const targetRadius =
    preset === "0" ? 0 : preset === "20" ? 20 : preset === "50" ? 50 : radius;
  const animatedRadius = useStateSpring(targetRadius, fromDrag);

  const onPresetChange = useCallback((next: RadiusPreset) => {
    setFromDrag(false);
    setPreset(next);
    if (next === "0") setRadius(0);
    else if (next === "20") setRadius(20);
    else if (next === "50") setRadius(50);
  }, []);

  const onRadiusChange = useCallback((v: number, fromDrag = false) => {
    setFromDrag(fromDrag);
    setRadius(v);
    setPreset("custom");
  }, []);

  return (
    <Section
      title={m.section_radius_title()}
      description={m.section_radius_desc()}
    >
      <FigureCard>
        <Preview corners={{ radius: animatedRadius, smoothing: 0.6 }} />
        <div className={`w-full ${ROW_DIVIDER}`}>
          <RadioPillGroup
            ariaLabel={m.section_radius_preset_aria()}
            options={RADIUS_PRESETS}
            value={preset}
            onChange={onPresetChange}
            pillBasis="max-[560px]:basis-[calc(50%-6px)]"
          />
        </div>
        <Collapse show={preset === "custom"}>
          <div className={`flex w-full flex-col items-center justify-center p-4 ${ROW_DIVIDER}`}>
            <Slider
              label={m.section_radius_slider_label()}
              value={radius}
              min={0}
              max={50}
              onChange={onRadiusChange}
            />
          </div>
        </Collapse>
      </FigureCard>
    </Section>
  );
}
