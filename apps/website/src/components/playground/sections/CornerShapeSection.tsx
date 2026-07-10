import { useCallback, useMemo, useState } from "react";
import { Collapse } from "../Collapse.tsx";
import { FigureCard } from "../FigureCard.tsx";
import { Preview } from "../Preview.tsx";
import { RadioPillGroup } from "../RadioPillGroup.tsx";
import { Section } from "../Section.tsx";
import { Slider } from "../Slider.tsx";
import { useStateSpring } from "../springs.ts";
import { ROW_DIVIDER } from "../styles.ts";
import { m } from "../../../paraglide/messages.js";

type SmoothingPreset = "off" | "on";

export function CornerShapeSection() {
  const SMOOTHING_PRESETS = [
    { value: "off", label: m.section_cornershape_preset_off() },
    { value: "on", label: m.section_cornershape_preset_on() },
  ] as const satisfies ReadonlyArray<{ value: SmoothingPreset; label: string }>;

  const [preset, setPreset] = useState<SmoothingPreset>("on");
  const [smoothing, setSmoothing] = useState(0.6);
  const [fromDrag, setFromDrag] = useState(false);

  const targetSmoothing = preset === "off" ? 0 : smoothing;
  const animatedSmoothing = useStateSpring(targetSmoothing, fromDrag);

  const onPresetChange = useCallback((next: SmoothingPreset) => {
    setFromDrag(false);
    setPreset(next);
    if (next === "off") setSmoothing(0);
    // Functional updater so the callback identity doesn't depend on `smoothing`.
    else if (next === "on") setSmoothing((s) => (s === 0 ? 0.6 : s));
  }, []);

  const onSmoothingChange = useCallback((v: number, fromDrag = false) => {
    setFromDrag(fromDrag);
    setSmoothing(v);
    setPreset("on");
  }, []);

  // Annotate the iOS/Apple/Figma squircle default with its name; every other
  // value reads as a plain two-decimal number.
  const formatSmoothing = useCallback(
    (v: number) =>
      Math.abs(v - 0.6) < 0.005
        ? m.section_cornershape_ios_label({ value: v.toFixed(2) })
        : v.toFixed(2),
    [],
  );
  const formatSmoothingSeed = useCallback((v: number) => v.toFixed(2), []);
  const formatSmoothingSamples = useMemo(() => [0.6] as const, []);

  return (
    <Section
      id="corner-shape"
      title={m.section_cornershape_title()}
      description={m.section_cornershape_desc()}
    >
      <FigureCard>
        <Preview corners={{ radius: 20, smoothing: animatedSmoothing }} />
        <div className={`w-full ${ROW_DIVIDER}`}>
          <RadioPillGroup
            ariaLabel={m.section_cornershape_preset_aria()}
            options={SMOOTHING_PRESETS}
            value={preset}
            onChange={onPresetChange}
          />
        </div>
        <Collapse show={preset === "on"}>
          <div className={`flex w-full flex-col items-center justify-center p-4 ${ROW_DIVIDER}`}>
            <Slider
              label={m.section_cornershape_slider_label()}
              value={smoothing}
              min={0}
              max={1}
              step={0.01}
              format={formatSmoothing}
              formatSeed={formatSmoothingSeed}
              formatSamples={formatSmoothingSamples}
              onChange={onSmoothingChange}
            />
          </div>
        </Collapse>
      </FigureCard>
    </Section>
  );
}
