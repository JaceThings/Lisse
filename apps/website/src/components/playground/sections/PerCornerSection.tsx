import { useCallback, useMemo, useRef, useState } from "react";
import { Collapse } from "../Collapse.tsx";
import { FigureCard } from "../FigureCard.tsx";
import { Preview } from "../Preview.tsx";
import { RadioPillGroup } from "../RadioPillGroup.tsx";
import { Section } from "../Section.tsx";
import { Slider } from "../Slider.tsx";
import { useStateSpring } from "../springs.ts";
import { ROW_DIVIDER } from "../styles.ts";

type PerCornerPreset = "all" | "top" | "single" | "custom";

const PER_CORNER_PRESETS = [
  { value: "all", label: "All Equal" },
  { value: "top", label: "Top Only" },
  { value: "single", label: "Single" },
  { value: "custom", label: "Custom" },
] as const satisfies ReadonlyArray<{ value: PerCornerPreset; label: string }>;

type CornerKnob = "tl" | "tr" | "bl" | "br";
type CornerFromDrag = Record<CornerKnob, boolean>;
const NO_CORNER_DRAG: CornerFromDrag = { tl: false, tr: false, bl: false, br: false };

export function PerCornerSection() {
  const [preset, setPreset] = useState<PerCornerPreset>("custom");
  const [tl, setTl] = useState(20);
  const [tr, setTr] = useState(20);
  const [bl, setBl] = useState(20);
  const [br, setBr] = useState(20);
  const [fromDrag, setFromDrag] = useState<CornerFromDrag>(NO_CORNER_DRAG);

  const targets = useMemo(() => {
    if (preset === "all") {
      return { tl: 20, tr: 20, bl: 20, br: 20, smoothing: 0.6 };
    }
    if (preset === "top") {
      return { tl: 30, tr: 30, bl: 0, br: 0, smoothing: 0.6 };
    }
    if (preset === "single") {
      return { tl: 40, tr: 0, bl: 0, br: 0, smoothing: 0.6 };
    }
    return { tl, tr, bl, br, smoothing: 0.6 };
  }, [preset, tl, tr, bl, br]);

  const aTl = useStateSpring(targets.tl, fromDrag.tl);
  const aTr = useStateSpring(targets.tr, fromDrag.tr);
  const aBl = useStateSpring(targets.bl, fromDrag.bl);
  const aBr = useStateSpring(targets.br, fromDrag.br);

  const corners = {
    topLeft: { radius: aTl, smoothing: targets.smoothing },
    topRight: { radius: aTr, smoothing: targets.smoothing },
    bottomLeft: { radius: aBl, smoothing: targets.smoothing },
    bottomRight: { radius: aBr, smoothing: targets.smoothing },
  };

  // Mirror the latest preset + preset-derived targets into refs so the
  // per-corner handlers stay identity-stable. Without this, each render
  // would hand four fresh callbacks to <Slider>, defeating any downstream
  // memoisation.
  const presetRef = useRef(preset);
  presetRef.current = preset;
  const targetsRef = useRef(targets);
  targetsRef.current = targets;

  // When the user starts dragging a corner, sync the *other* corners'
  // React state to their currently-displayed (preset-derived) target so
  // switching into custom doesn't pop the siblings to stale defaults.
  const makeSetCorner = useCallback(
    (knob: CornerKnob, setter: (n: number) => void) =>
      (v: number, fromDrag = false) => {
        const p = presetRef.current;
        const t = targetsRef.current;
        if (p !== "custom") {
          setTl(t.tl); setTr(t.tr);
          setBl(t.bl); setBr(t.br);
        }
        setFromDrag({ ...NO_CORNER_DRAG, [knob]: fromDrag });
        setter(v);
        setPreset("custom");
      },
    [],
  );

  const onTlChange = useMemo(() => makeSetCorner("tl", setTl), [makeSetCorner]);
  const onTrChange = useMemo(() => makeSetCorner("tr", setTr), [makeSetCorner]);
  const onBlChange = useMemo(() => makeSetCorner("bl", setBl), [makeSetCorner]);
  const onBrChange = useMemo(() => makeSetCorner("br", setBr), [makeSetCorner]);

  const onPresetChange = useCallback((next: PerCornerPreset) => {
    setFromDrag(NO_CORNER_DRAG);
    setPreset(next);
    if (next === "all") {
      setTl(20); setTr(20); setBl(20); setBr(20);
    } else if (next === "top") {
      setTl(30); setTr(30); setBl(0); setBr(0);
    } else if (next === "single") {
      setTl(40); setTr(0); setBl(0); setBr(0);
    }
  }, []);

  return (
    <Section
      title="Per-Corner Radius"
      description="Each corner can have its own radius and smoothing, independently controlled."
    >
      <FigureCard>
        <Preview corners={corners} />
        <div className={`w-full ${ROW_DIVIDER}`}>
          <RadioPillGroup
            ariaLabel="Per-corner preset"
            options={PER_CORNER_PRESETS}
            value={preset}
            onChange={onPresetChange}
          />
        </div>
        <Collapse show={preset === "custom"}>
          <div className="flex w-full flex-wrap items-start">
            <div className={`flex flex-1 min-w-[210px] flex-col items-center justify-center pl-figma-4 pr-[14px] py-figma-4 ${ROW_DIVIDER}`}>
              <Slider label="Top Left" value={tl} min={0} max={50} onChange={onTlChange} />
            </div>
            <div className={`flex flex-1 min-w-[210px] flex-col items-center justify-center pl-[14px] pr-figma-4 py-figma-4 ${ROW_DIVIDER}`}>
              <Slider label="Top Right" value={tr} min={0} max={50} onChange={onTrChange} />
            </div>
            <div className="flex flex-1 min-w-[210px] flex-col items-center justify-center pl-figma-4 pr-[14px] py-figma-4">
              <Slider label="Bottom Left" value={bl} min={0} max={50} onChange={onBlChange} />
            </div>
            <div className="flex flex-1 min-w-[210px] flex-col items-center justify-center pl-[14px] pr-figma-4 py-figma-4">
              <Slider label="Bottom Right" value={br} min={0} max={50} onChange={onBrChange} />
            </div>
          </div>
        </Collapse>
      </FigureCard>
    </Section>
  );
}
