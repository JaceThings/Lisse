import { useCallback, useEffect, useRef, useState } from "react";
import type { BorderConfig, BorderStyle } from "@lisse/core";
import { Collapse } from "../Collapse.tsx";
import { FigureCard } from "../FigureCard.tsx";
import { Preview } from "../Preview.tsx";
import { RadioPillGroup } from "../RadioPillGroup.tsx";
import { Section } from "../Section.tsx";
import { Slider } from "../Slider.tsx";
import { useBorderKnobSpring, useStateSpring } from "../springs.ts";
import { ROW_DIVIDER } from "../styles.ts";

type BorderPreset = "none" | "solid" | "dashed" | "dotted" | "double" | "groove" | "ridge";
type DashCap = "butt" | "square" | "round";

const BORDER_PRESETS = [
  { value: "none", label: "None" },
  { value: "solid", label: "Solid" },
  { value: "dashed", label: "Dashed" },
  { value: "dotted", label: "Dotted" },
  { value: "double", label: "Double" },
  { value: "groove", label: "Groove" },
  { value: "ridge", label: "Ridge" },
] as const satisfies ReadonlyArray<{ value: BorderPreset; label: string }>;

const DASH_CAP_PRESETS = [
  { value: "butt", label: "No Dash Cap" },
  { value: "square", label: "Square Dash Cap" },
  { value: "round", label: "Round Dash Cap" },
] as const satisfies ReadonlyArray<{ value: DashCap; label: string }>;

const BORDER_COLOUR = "#eec494";

interface BorderSectionProps {
  title: string;
  description: string;
  position: "outer" | "inner" | "middle";
}

// Per-position defaults so each Border section opens on a preset that
// reads cleanly: outer/inner use a fine dotted ring; centre uses a wider
// dashed pattern so it doesn't visually fight the inner/outer rings on
// the same canvas.
const POSITION_DEFAULTS: Record<
  BorderSectionProps["position"],
  { preset: BorderPreset; thickness: number; dashCap: DashCap; dash: number; gap: number }
> = {
  outer: { preset: "dotted", thickness: 4, dashCap: "round", dash: 14, gap: 10 },
  inner: { preset: "dotted", thickness: 4, dashCap: "round", dash: 14, gap: 10 },
  middle: { preset: "dashed", thickness: 8, dashCap: "round", dash: 10, gap: 10 },
};

export function BorderSection({ title, description, position }: BorderSectionProps) {
  const defaults = POSITION_DEFAULTS[position];
  const [preset, setPreset] = useState<BorderPreset>(defaults.preset);
  const [thickness, setThickness] = useState(defaults.thickness);
  const [dashCap, setDashCap] = useState<DashCap>(defaults.dashCap);
  const [dash, setDash] = useState(defaults.dash);
  const [gap, setGap] = useState(defaults.gap);

  const aThickness = useBorderKnobSpring(thickness);
  const aDash = useBorderKnobSpring(dash);
  const aGap = useBorderKnobSpring(gap);

  // Keep the last visible style during a fade-out so toggling "None" tweens
  // opacity on the previous style rather than swapping geometry mid-fade.
  const lastVisibleStyleRef = useRef<BorderStyle>(preset === "none" ? "dashed" : (preset as BorderStyle));
  useEffect(() => {
    if (preset !== "none") lastVisibleStyleRef.current = preset as BorderStyle;
  }, [preset]);

  const aOpacity = useStateSpring(preset === "none" ? 0 : 1, false);

  const border: BorderConfig = {
    width: aThickness,
    color: BORDER_COLOUR,
    opacity: aOpacity,
    style: preset === "none" ? lastVisibleStyleRef.current : (preset as BorderStyle),
    dash: aDash,
    gap: aGap,
    lineCap: dashCap,
  };

  // Border knobs always tween (short 120ms), so we don't need to track
  // a fromDrag flag — drag and preset clicks both feed through the same
  // path and get the same smoothing. The state setters themselves are
  // identity-stable, so we hand them directly to <Slider>.

  const onPresetChange = useCallback((next: BorderPreset) => {
    setPreset(next);
    // Sync slider values per preset so Thickness/Dash/Gap reflect
    // the preset's intended look, not the previous custom state.
    if (next === "solid") {
      setThickness(2);
    } else if (next === "dashed") {
      setThickness(6); setDash(6); setGap(6);
    } else if (next === "dotted") {
      setThickness(4); setDash(0); setGap(8);
    } else if (next === "double") {
      setThickness(6);
    } else if (next === "groove" || next === "ridge") {
      setThickness(6);
    }
  }, []);

  // Slider relevance by preset. Thickness drives every visible border;
  // dash/gap/cap only apply to the dashed-pattern styles. Uniform styles
  // (solid/double/groove/ridge) keep Thickness but drop the pattern row.
  const showThickness = preset !== "none";
  const showDashRow = preset === "dashed" || preset === "dotted";

  return (
    <Section title={title} description={description}>
      <FigureCard>
        <Preview
          corners={{ radius: 20, smoothing: 0.6 }}
          outerBorder={position === "outer" ? border : undefined}
          innerBorder={position === "inner" ? border : undefined}
          middleBorder={position === "middle" ? border : undefined}
        />
        <div className={`w-full ${ROW_DIVIDER}`}>
          <RadioPillGroup
            ariaLabel={`${title} style`}
            options={BORDER_PRESETS}
            value={preset}
            onChange={onPresetChange}
            pillMinWidth="min-w-[110px]"
          />
        </div>
        <Collapse show={showThickness}>
          <div className={`flex w-full flex-col items-center justify-center p-figma-4 ${ROW_DIVIDER}`}>
            <Slider label="Thickness" value={thickness} min={1} max={20} onChange={setThickness} />
          </div>
        </Collapse>
        <Collapse show={showDashRow}>
          <div className={`w-full ${ROW_DIVIDER}`}>
            <RadioPillGroup
              ariaLabel={`${title} dash cap`}
              options={DASH_CAP_PRESETS}
              value={dashCap}
              onChange={setDashCap}
            />
          </div>
          <div className={`flex w-full flex-wrap content-center items-center justify-center ${ROW_DIVIDER}`}>
            <div className="flex flex-1 min-w-[210px] flex-col items-center justify-center p-figma-4">
              <Slider label="Dash" value={dash} min={0} max={30} onChange={setDash} />
            </div>
            <div className="flex flex-1 min-w-[210px] flex-col items-center justify-center pl-[14px] pr-figma-4 py-figma-4">
              <Slider label="Gap" value={gap} min={0} max={30} onChange={setGap} />
            </div>
          </div>
        </Collapse>
      </FigureCard>
    </Section>
  );
}
