import { useCallback, useMemo, useRef, useState } from "react";
import type { ShadowConfig } from "@lisse/core";
import { Collapse } from "../Collapse.tsx";
import { FigureCard } from "../FigureCard.tsx";
import { Preview } from "../Preview.tsx";
import { RadioPillGroup } from "../RadioPillGroup.tsx";
import { Section } from "../Section.tsx";
import { Slider } from "../Slider.tsx";
import { useStateSpring } from "../springs.ts";
import { ROW_DIVIDER } from "../styles.ts";
import { m } from "../../../paraglide/messages.js";

type ShadowPreset = "none" | "subtle" | "medium" | "custom";

const SHADOW_COLOUR = "#7e756c";

type ShadowKnob = "x" | "y" | "blur" | "spread";
type ShadowFromDrag = Record<ShadowKnob, boolean>;
const NO_DRAG: ShadowFromDrag = { x: false, y: false, blur: false, spread: false };

interface ShadowSectionProps {
  /** Anchor slug for this variant's header. */
  id: string;
  title: string;
  description: string;
  kind: "drop" | "inner";
}

export function ShadowSection({ id, title, description, kind }: ShadowSectionProps) {
  const SHADOW_PRESETS = [
    { value: "none", label: m.section_shadow_preset_none() },
    { value: "subtle", label: m.section_shadow_preset_subtle() },
    { value: "medium", label: m.section_shadow_preset_medium() },
    { value: "custom", label: m.section_shadow_preset_custom() },
  ] as const satisfies ReadonlyArray<{ value: ShadowPreset; label: string }>;

  // Inner shadows look like a blur-bomb at drop-shadow defaults — tight
  // 3px blur reads as a soft edge instead of a halo.
  const defaults = kind === "inner"
    ? { x: 0, y: 0, blur: 3, spread: 0 }
    : { x: 0, y: 0, blur: 8, spread: 6 };
  const [preset, setPreset] = useState<ShadowPreset>("custom");
  const [x, setX] = useState(defaults.x);
  const [y, setY] = useState(defaults.y);
  const [blur, setBlur] = useState(defaults.blur);
  const [spread, setSpread] = useState(defaults.spread);
  // Per-knob drag flags: only the knob currently being dragged snaps;
  // sibling knobs spring toward whatever target the new preset implies.
  // Without this, dragging X while leaving Subtle would snap Y/Blur/Spread
  // from Subtle's targets to the (stale) custom state in one frame.
  const [fromDrag, setFromDrag] = useState<ShadowFromDrag>(NO_DRAG);

  const targets = useMemo(() => {
    if (preset === "none") return { x: 0, y: 0, blur: 0, spread: 0, opacity: 0 };
    if (preset === "subtle") return { x: 0, y: 2, blur: 6, spread: 0, opacity: 0.18 };
    if (preset === "medium") return { x: 0, y: 5, blur: 12, spread: 0, opacity: 0.32 };
    return { x, y, blur, spread, opacity: 0.48 };
  }, [preset, x, y, blur, spread]);

  const aX = useStateSpring(targets.x, fromDrag.x);
  const aY = useStateSpring(targets.y, fromDrag.y);
  const aBlur = useStateSpring(targets.blur, fromDrag.blur);
  const aSpread = useStateSpring(targets.spread, fromDrag.spread);
  // Opacity always tweens — even when a knob is mid-drag — so toggling
  // "None" while dragging fades the shadow out rather than killing it.
  const aOpacity = useStateSpring(targets.opacity, false);

  const shadow: ShadowConfig = {
    offsetX: aX,
    offsetY: aY,
    blur: aBlur,
    spread: aSpread,
    color: SHADOW_COLOUR,
    opacity: aOpacity,
  };

  // Inner-shadow demos use a paler fill so the shadow reads — Figma uses
  // `#f0eeed` against `#7e766d` for the drop-shadow variant.
  const fill = kind === "inner" ? "#f0eeed" : undefined;

  // Mirror preset + targets into refs so the per-knob handlers stay
  // identity-stable across renders.
  const presetRef = useRef(preset);
  presetRef.current = preset;
  const targetsRef = useRef(targets);
  targetsRef.current = targets;

  const makeSetKnob = useCallback(
    (knob: ShadowKnob, setter: (n: number) => void) =>
      (v: number, fromDrag = false) => {
        // Sync the other knobs' React state to the preset's targets before
        // switching to custom — otherwise the non-dragged knobs would spring
        // from preset values to stale custom defaults.
        const p = presetRef.current;
        const t = targetsRef.current;
        if (p !== "custom") {
          if (knob !== "x") setX(t.x);
          if (knob !== "y") setY(t.y);
          if (knob !== "blur") setBlur(t.blur);
          if (knob !== "spread") setSpread(t.spread);
        }
        setFromDrag({ ...NO_DRAG, [knob]: fromDrag });
        setter(v);
        setPreset((cp) => (cp === "custom" ? cp : "custom"));
      },
    [],
  );

  const onXChange = useMemo(() => makeSetKnob("x", setX), [makeSetKnob]);
  const onYChange = useMemo(() => makeSetKnob("y", setY), [makeSetKnob]);
  const onBlurChange = useMemo(() => makeSetKnob("blur", setBlur), [makeSetKnob]);
  const onSpreadChange = useMemo(() => makeSetKnob("spread", setSpread), [makeSetKnob]);

  // Sync React state to the preset's targets so a later drag from "custom"
  // doesn't snap back to a stale value. fromDrag is false here, so the
  // change springs.
  const onPresetChange = useCallback((next: ShadowPreset) => {
    setFromDrag(NO_DRAG);
    if (next === "subtle") {
      setX(0); setY(2); setBlur(6); setSpread(0);
    } else if (next === "medium") {
      setX(0); setY(5); setBlur(12); setSpread(0);
    } else if (next === "none") {
      setX(0); setY(0); setBlur(0); setSpread(0);
    }
    setPreset(next);
  }, []);

  return (
    <Section id={id} title={title} description={description}>
      <FigureCard>
        <Preview
          corners={{ radius: 20, smoothing: 0.6 }}
          fill={fill}
          shadow={kind === "drop" ? shadow : undefined}
          innerShadow={kind === "inner" ? shadow : undefined}
        />
        <div className={`w-full ${ROW_DIVIDER}`}>
          <RadioPillGroup
            ariaLabel={m.section_shadow_preset_aria({ title })}
            options={SHADOW_PRESETS}
            value={preset}
            onChange={onPresetChange}
          />
        </div>
        <Collapse show={preset === "custom"}>
          <div className="flex w-full flex-wrap items-start">
            <div className={`flex flex-1 min-w-[210px] flex-col items-center justify-center p-4 ${ROW_DIVIDER}`}>
              <Slider label={m.section_shadow_x_label()} value={x} min={-20} max={20} onChange={onXChange} />
            </div>
            <div className={`flex flex-1 min-w-[210px] flex-col items-center justify-center pl-[14px] pr-4 py-4 ${ROW_DIVIDER} max-[560px]:shadow-none`}>
              <Slider label={m.section_shadow_y_label()} value={y} min={-20} max={20} onChange={onYChange} />
            </div>
            <div className="flex flex-1 min-w-[210px] flex-col items-center justify-center p-4">
              <Slider label={m.section_shadow_blur_label()} value={blur} min={0} max={40} onChange={onBlurChange} />
            </div>
            <div className="flex flex-1 min-w-[210px] flex-col items-center justify-center pl-[14px] pr-4 py-4">
              <Slider label={m.section_shadow_spread_label()} value={spread} min={-20} max={40} onChange={onSpreadChange} />
            </div>
          </div>
        </Collapse>
      </FigureCard>
    </Section>
  );
}
