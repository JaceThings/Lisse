import { useCallback, useMemo, useState } from "react";
import { Collapse } from "../Collapse.tsx";
import { FigureCard } from "../FigureCard.tsx";
import { Preview } from "../Preview.tsx";
import { RadioPillGroup } from "../RadioPillGroup.tsx";
import { Section } from "../Section.tsx";
import { Slider } from "../Slider.tsx";
import { useStateSpring } from "../springs.ts";
import { ROW_DIVIDER } from "../styles.ts";

type SmoothingPreset = "off" | "on";

const SMOOTHING_PRESETS = [
  { value: "off", label: "Without Smoothing" },
  { value: "on", label: "With Smoothing" },
] as const satisfies ReadonlyArray<{ value: SmoothingPreset; label: string }>;

export function CornerShapeSection() {
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
    (v: number) => (Math.abs(v - 0.6) < 0.005 ? "iOS – 0.60" : v.toFixed(2)),
    [],
  );
  const formatSmoothingSeed = useCallback((v: number) => v.toFixed(2), []);
  const formatSmoothingSamples = useMemo(() => [0.6] as const, []);

  return (
    <Section
      title="Corner Shape"
      description="Smoothing controls how gradually the curve transitions into the straight edge. 0 gives a circular arc, 1 a full squircle."
    >
      <FigureCard>
        <Preview corners={{ radius: 20, smoothing: animatedSmoothing }} />
        <div className={`w-full ${ROW_DIVIDER}`}>
          <RadioPillGroup
            ariaLabel="Smoothing preset"
            options={SMOOTHING_PRESETS}
            value={preset}
            onChange={onPresetChange}
          />
        </div>
        <Collapse show={preset === "on"}>
          <div className={`flex w-full flex-col items-center justify-center p-4 ${ROW_DIVIDER}`}>
            <Slider
              label="Smoothing"
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
