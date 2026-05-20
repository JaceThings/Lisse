import { useCallback, useState } from "react";
import { Collapse } from "../Collapse.tsx";
import { FigureCard } from "../FigureCard.tsx";
import { Preview } from "../Preview.tsx";
import { RadioPillGroup } from "../RadioPillGroup.tsx";
import { Section } from "../Section.tsx";
import { Slider } from "../Slider.tsx";
import { useStateSpring } from "../springs.ts";
import { ROW_DIVIDER } from "../styles.ts";

type RadiusPreset = "0" | "20" | "50" | "custom";

const RADIUS_PRESETS = [
  { value: "0", label: "Radius: 0" },
  { value: "20", label: "Radius: 20" },
  { value: "50", label: "Radius: 50" },
  { value: "custom", label: "Custom" },
] as const satisfies ReadonlyArray<{ value: RadiusPreset; label: string }>;

export function RadiusSection() {
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
      title="Radius"
      description="Control the corner radius. Higher values produce rounder corners — at the maximum, the box becomes a full circle."
    >
      <FigureCard>
        <Preview corners={{ radius: animatedRadius, smoothing: 0.6 }} />
        <div className={`w-full ${ROW_DIVIDER}`}>
          <RadioPillGroup
            ariaLabel="Radius preset"
            options={RADIUS_PRESETS}
            value={preset}
            onChange={onPresetChange}
            pillBasis="max-[560px]:basis-[calc(50%-6px)]"
          />
        </div>
        <Collapse show={preset === "custom"}>
          <div className={`flex w-full flex-col items-center justify-center p-4 ${ROW_DIVIDER}`}>
            <Slider
              label="Radius"
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
