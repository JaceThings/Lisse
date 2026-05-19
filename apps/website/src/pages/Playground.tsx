import { useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useDialKit } from "dialkit";
import type { BorderConfig, BorderStyle, ShadowConfig } from "@lisse/core";
import { Layout } from "../components/Layout.tsx";
import { Divider } from "../components/Divider.tsx";
import { FigureCard } from "../components/playground/FigureCard.tsx";
import { Preview } from "../components/playground/Preview.tsx";
import { RadioPillGroup } from "../components/playground/RadioPillGroup.tsx";
import { Section } from "../components/playground/Section.tsx";
import { Slider } from "../components/playground/Slider.tsx";
import {
  DEFAULT_TUNING,
  PlaygroundTuningProvider,
  type PlaygroundTuning,
} from "../components/playground/PlaygroundTuning.tsx";
import { useSpringNumber } from "../hooks/useSpringNumber.ts";

// Per-section dividers (Figma `#edece8` 1px top border between every
// figure-content slot). A `box-shadow: inset` lives inside the element's
// padding box, so the hairline tucks behind the FigureCard's Lisse clip
// at the rounded edges — a real `border-top` would visibly peek past
// the corner clip on the left/right.
const ROW_DIVIDER = "shadow-[inset_0_1px_0_0_#edece8]";

type RadiusPreset = "0" | "20" | "50" | "custom";
type SmoothingPreset = "off" | "on";
type PerCornerPreset = "all" | "top" | "single" | "custom";
type ShadowPreset = "none" | "subtle" | "medium" | "custom";
type BorderPreset = "none" | "solid" | "dashed" | "dotted" | "double" | "groove" | "ridge";
type DashCap = "butt" | "square" | "round";

const RADIUS_PRESETS = [
  { value: "0", label: "Radius: 0" },
  { value: "20", label: "Radius: 20" },
  { value: "50", label: "Radius: 50" },
  { value: "custom", label: "Custom" },
] as const satisfies ReadonlyArray<{ value: RadiusPreset; label: string }>;

const SMOOTHING_PRESETS = [
  { value: "off", label: "Without Smoothing" },
  { value: "on", label: "With Smoothing" },
] as const satisfies ReadonlyArray<{ value: SmoothingPreset; label: string }>;

const PER_CORNER_PRESETS = [
  { value: "all", label: "All Equal" },
  { value: "top", label: "Top Only" },
  { value: "single", label: "Single" },
  { value: "custom", label: "Custom" },
] as const satisfies ReadonlyArray<{ value: PerCornerPreset; label: string }>;

const SHADOW_PRESETS = [
  { value: "none", label: "None" },
  { value: "subtle", label: "Subtle" },
  { value: "medium", label: "Medium" },
  { value: "custom", label: "Custom" },
] as const satisfies ReadonlyArray<{ value: ShadowPreset; label: string }>;

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
const SHADOW_COLOUR = "#7e756c";

function buildBorder(
  preset: BorderPreset,
  thickness: number,
  dash: number,
  gap: number,
  lineCap: DashCap,
): BorderConfig | undefined {
  if (preset === "none") return undefined;
  return {
    width: thickness,
    color: BORDER_COLOUR,
    opacity: 1,
    style: preset as BorderStyle,
    dash,
    gap,
    lineCap,
  };
}

function NoteBlock() {
  return (
    <header className="flex w-full flex-col gap-figma-5">
      <div className="flex w-full flex-col gap-2.5" role="group" aria-labelledby="playground-heading">
        <div className="flex items-end gap-figma-2 whitespace-nowrap text-text-primary">
          <h1
            id="playground-heading"
            className="text-[16px] leading-none font-[550] tracking-[-0.25px]"
          >
            lisse
          </h1>
          <p className="text-[14px] leading-none font-[450] tracking-[-0.25px]">
            <span aria-hidden>
              /lēs/ <em className="italic">adj.</em> [F.{" "}
              <em className="italic">lisse</em>,{" "}
              <em className="italic">smooth</em>]
            </span>
            <span className="sr-only">
              Pronounced lees, adjective, from French lisse meaning smooth.
            </span>
          </p>
        </div>
        <div className="flex flex-col gap-figma-2 pl-figma-2 text-text-secondary">
          <p className="text-[14px] leading-[1.2] font-medium tracking-[-0.25px]">
            <span className="font-[550] proportional-nums">1</span> having an even,
            unbroken surface; smooth to the touch (
            <em className="italic">un galet lisse</em>).
          </p>
          <p className="text-[14px] leading-[1.2] font-medium tracking-[-0.25px]">
            <span className="font-[550] proportional-nums">2</span> a sleek; without
            break or rough patch (cheveux lisses).
          </p>
          <p className="pl-figma-2 text-[14px] leading-[1.2] font-medium tracking-[-0.25px]">
            <span className="font-[550] proportional-nums">b</span> (of a curve, line,
            or transition) continuous; without abrupt change (une courbe lisse).
          </p>
          <p className="text-[14px] leading-[1.2] font-medium tracking-[-0.25px]">
            <span className="font-[550] proportional-nums">3</span> fig. polished,
            frictionless; flowing without interruption.
          </p>
        </div>
      </div>
      <Divider />
    </header>
  );
}

function Footer() {
  return (
    <footer className="flex w-full flex-col gap-figma-5">
      <Divider />
      <nav
        aria-label="Site"
        className="flex w-full items-start gap-figma-4 text-[14px] leading-[1.2] font-medium tracking-[-0.25px] text-text-secondary whitespace-nowrap"
      >
        {/* `py-2 -my-2` extends tap target to ~33px tall without changing
            the visible footer layout — text stays on its baseline. */}
        <a href="/what" className="py-2 -my-2 hover:text-text-primary" data-focus-ring>
          What?
        </a>
        <a href="/playground" className="py-2 -my-2 hover:text-text-primary" data-focus-ring>
          Playground
        </a>
        <a href="/" className="py-2 -my-2 hover:text-text-primary" data-focus-ring>
          Docs
        </a>
      </nav>
    </footer>
  );
}

// Spring height/opacity collapse for slider rows that aren't relevant to
// the active preset. Slider values live in the parent section so they
// survive the collapse — the children mount/unmount, but the controlled
// `value` prop persists. Physics mirror the state-change spring so the
// transition reads as the same beat as the preview animation.
const COLLAPSE_SPRING = { type: "spring" as const, stiffness: 380, damping: 38, mass: 0.9 };

function Collapse({ show, children }: { show: boolean; children: ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          // 4px upward tuck on exit only — the disappearance reads as a
          // soft retreat rather than a pure collapse. Entrance keeps the
          // straight height/opacity ramp so the row drops in neutrally.
          exit={{ height: 0, opacity: 0, y: -4 }}
          transition={COLLAPSE_SPRING}
          style={{ overflow: "hidden", width: "100%" }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Preview state-change tween — fixed values, not tunable via the dialkit
// panel. The user wants the dialkit panel to drive slider behaviour only,
// not the preview-square's preset-click animation.
const STATE_CHANGE_DURATION = 0.35;
const STATE_CHANGE_EASE: [number, number, number, number] = [0.32, 0.72, 0, 1];

function useStateSpring(target: number, fromDrag: boolean) {
  return useSpringNumber(target, {
    duration: STATE_CHANGE_DURATION,
    ease: STATE_CHANGE_EASE,
    fromDrag,
  });
}

// Border knobs (thickness / dash / gap) tween even while the user is
// dragging — the slider reports integer steps, so without this short
// tween the rendered border would visibly snap from 5px → 6px → 7px on
// each step. 120ms is fast enough to feel live but smooths the jumps.
const BORDER_KNOB_DURATION = 0.12;
function useBorderKnobSpring(target: number) {
  return useSpringNumber(target, {
    duration: BORDER_KNOB_DURATION,
    ease: STATE_CHANGE_EASE,
    fromDrag: false,
  });
}

function RadiusSection() {
  const [preset, setPreset] = useState<RadiusPreset>("20");
  const [radius, setRadius] = useState(20);
  const [fromDrag, setFromDrag] = useState(false);

  const targetRadius =
    preset === "0" ? 0 : preset === "20" ? 20 : preset === "50" ? 50 : radius;
  const animatedRadius = useStateSpring(targetRadius, fromDrag);

  return (
    <Section
      title="Radius"
      description="Control the corner radius. Higher values produce rounder corners."
    >
      <FigureCard>
        <Preview corners={{ radius: animatedRadius, smoothing: 0.6 }} />
        <div className={`w-full ${ROW_DIVIDER}`}>
          <RadioPillGroup
            ariaLabel="Radius preset"
            options={RADIUS_PRESETS}
            value={preset}
            onChange={(next) => {
              setFromDrag(false);
              setPreset(next);
              if (next === "0") setRadius(0);
              else if (next === "20") setRadius(20);
              else if (next === "50") setRadius(50);
            }}
          />
        </div>
        <Collapse show={preset === "custom"}>
          <div className={`flex w-full flex-col items-center justify-center p-figma-4 ${ROW_DIVIDER}`}>
            <Slider
              label="Radius"
              value={radius}
              min={0}
              max={50}
              onChange={(v, fromDrag = false) => {
                setFromDrag(fromDrag);
                setRadius(v);
                setPreset("custom");
              }}
            />
          </div>
        </Collapse>
      </FigureCard>
    </Section>
  );
}

function CornerShapeSection() {
  const [preset, setPreset] = useState<SmoothingPreset>("on");
  const [smoothing, setSmoothing] = useState(0.6);
  const [fromDrag, setFromDrag] = useState(false);

  const targetSmoothing = preset === "off" ? 0 : smoothing;
  const animatedSmoothing = useStateSpring(targetSmoothing, fromDrag);

  return (
    <Section
      title="Corner Shape"
      description="Smoothing controls how gradually the curve transitions into the straight edge. A value of 0 gives standard circular arcs, while 1 produces a full squircle."
    >
      <FigureCard>
        <Preview corners={{ radius: 20, smoothing: animatedSmoothing }} />
        <div className={`w-full ${ROW_DIVIDER}`}>
          <RadioPillGroup
            ariaLabel="Smoothing preset"
            options={SMOOTHING_PRESETS}
            value={preset}
            onChange={(next) => {
              setFromDrag(false);
              setPreset(next);
              if (next === "off") setSmoothing(0);
              else if (next === "on" && smoothing === 0) setSmoothing(0.6);
            }}
          />
        </div>
        <Collapse show={preset === "on"}>
          <div className={`flex w-full flex-col items-center justify-center p-figma-4 ${ROW_DIVIDER}`}>
            <Slider
              label="Smoothing"
              value={smoothing}
              min={0}
              max={1}
              step={0.01}
              format={(v) => v.toFixed(2)}
              onChange={(v, fromDrag = false) => {
                setFromDrag(fromDrag);
                setSmoothing(v);
                setPreset("on");
              }}
            />
          </div>
        </Collapse>
      </FigureCard>
    </Section>
  );
}

type CornerKnob = "tl" | "tr" | "bl" | "br";
type CornerFromDrag = Record<CornerKnob, boolean>;
const NO_CORNER_DRAG: CornerFromDrag = { tl: false, tr: false, bl: false, br: false };

function PerCornerSection() {
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

  // When the user starts dragging a corner, sync the *other* corners'
  // React state to their currently-displayed (preset-derived) target so
  // switching into custom doesn't pop the siblings to stale defaults.
  const setCorner =
    (knob: CornerKnob, setter: (n: number) => void) =>
    (v: number, fromDrag = false) => {
      if (preset !== "custom") {
        setTl(targets.tl); setTr(targets.tr);
        setBl(targets.bl); setBr(targets.br);
      }
      setFromDrag({ ...NO_CORNER_DRAG, [knob]: fromDrag });
      setter(v);
      setPreset("custom");
    };

  const onPresetChange = (next: PerCornerPreset) => {
    setFromDrag(NO_CORNER_DRAG);
    setPreset(next);
    if (next === "all") {
      setTl(20); setTr(20); setBl(20); setBr(20);
    } else if (next === "top") {
      setTl(30); setTr(30); setBl(0); setBr(0);
    } else if (next === "single") {
      setTl(40); setTr(0); setBl(0); setBr(0);
    }
  };

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
              <Slider label="Top Left" value={tl} min={0} max={50} onChange={setCorner("tl", setTl)} />
            </div>
            <div className={`flex flex-1 min-w-[210px] flex-col items-center justify-center pl-[14px] pr-figma-4 py-figma-4 ${ROW_DIVIDER}`}>
              <Slider label="Top Right" value={tr} min={0} max={50} onChange={setCorner("tr", setTr)} />
            </div>
            <div className="flex flex-1 min-w-[210px] flex-col items-center justify-center pl-figma-4 pr-[14px] py-figma-4">
              <Slider label="Bottom Left" value={bl} min={0} max={50} onChange={setCorner("bl", setBl)} />
            </div>
            <div className="flex flex-1 min-w-[210px] flex-col items-center justify-center pl-[14px] pr-figma-4 py-figma-4">
              <Slider label="Bottom Right" value={br} min={0} max={50} onChange={setCorner("br", setBr)} />
            </div>
          </div>
        </Collapse>
      </FigureCard>
    </Section>
  );
}

interface ShadowSectionProps {
  title: string;
  description: string;
  kind: "drop" | "inner";
}

type ShadowKnob = "x" | "y" | "blur" | "spread";
type ShadowFromDrag = Record<ShadowKnob, boolean>;
const NO_DRAG: ShadowFromDrag = { x: false, y: false, blur: false, spread: false };

function ShadowSection({ title, description, kind }: ShadowSectionProps) {
  // Inner shadows look like a blur-bomb at the drop-shadow defaults; pick
  // a tight 3px blur with no spread so the preview reads as a soft inner
  // edge instead of a halo.
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

  const anyDrag = fromDrag.x || fromDrag.y || fromDrag.blur || fromDrag.spread;
  const shadow: ShadowConfig | undefined =
    preset === "none" && !anyDrag
      ? undefined
      : {
          offsetX: aX,
          offsetY: aY,
          blur: aBlur,
          spread: aSpread,
          color: SHADOW_COLOUR,
          opacity: targets.opacity,
        };

  // Inner-shadow demos use a paler fill so the shadow reads — Figma uses
  // `#f0eeed` against `#7e766d` for the drop-shadow variant.
  const fill = kind === "inner" ? "#f0eeed" : undefined;

  const setKnob =
    (knob: ShadowKnob, setter: (n: number) => void) =>
    (v: number, fromDrag = false) => {
      // Sync the other knobs' React state to the current preset's targets
      // before switching to custom — otherwise the non-dragged knobs would
      // spring from their preset values to the stale custom defaults.
      if (preset !== "custom") {
        if (knob !== "x") setX(targets.x);
        if (knob !== "y") setY(targets.y);
        if (knob !== "blur") setBlur(targets.blur);
        if (knob !== "spread") setSpread(targets.spread);
      }
      setFromDrag({ ...NO_DRAG, [knob]: fromDrag });
      setter(v);
      setPreset((p) => (p === "custom" ? p : "custom"));
    };

  // When switching presets, sync the React state to the preset's targets
  // so a later drag from "custom" doesn't snap back to a stale value. The
  // animation springs because fromDrag is false here.
  const onPresetChange = (next: ShadowPreset) => {
    setFromDrag(NO_DRAG);
    if (next === "subtle") {
      setX(0); setY(2); setBlur(6); setSpread(0);
    } else if (next === "medium") {
      setX(0); setY(5); setBlur(12); setSpread(0);
    } else if (next === "none") {
      setX(0); setY(0); setBlur(0); setSpread(0);
    }
    setPreset(next);
  };

  return (
    <Section title={title} description={description}>
      <FigureCard>
        <Preview
          corners={{ radius: 20, smoothing: 0.6 }}
          fill={fill}
          shadow={kind === "drop" ? shadow : undefined}
          innerShadow={kind === "inner" ? shadow : undefined}
        />
        <div className={`w-full ${ROW_DIVIDER}`}>
          <RadioPillGroup
            ariaLabel={`${title} preset`}
            options={SHADOW_PRESETS}
            value={preset}
            onChange={onPresetChange}
          />
        </div>
        <Collapse show={preset === "custom"}>
          <div className="flex w-full flex-wrap items-start">
            <div className={`flex flex-1 min-w-[210px] flex-col items-center justify-center p-figma-4 ${ROW_DIVIDER}`}>
              <Slider label="X" value={x} min={-20} max={20} onChange={setKnob("x", setX)} />
            </div>
            <div className={`flex flex-1 min-w-[210px] flex-col items-center justify-center pl-[14px] pr-figma-4 py-figma-4 ${ROW_DIVIDER}`}>
              <Slider label="Y" value={y} min={-20} max={20} onChange={setKnob("y", setY)} />
            </div>
            <div className="flex flex-1 min-w-[210px] flex-col items-center justify-center p-figma-4">
              <Slider label="Blur" value={blur} min={0} max={40} onChange={setKnob("blur", setBlur)} />
            </div>
            <div className="flex flex-1 min-w-[210px] flex-col items-center justify-center pl-[14px] pr-figma-4 py-figma-4">
              <Slider label="Spread" value={spread} min={-20} max={40} onChange={setKnob("spread", setSpread)} />
            </div>
          </div>
        </Collapse>
      </FigureCard>
    </Section>
  );
}

interface BorderSectionProps {
  title: string;
  description: string;
  position: "outer" | "inner" | "middle";
}

function BorderSection({ title, description, position }: BorderSectionProps) {
  const [preset, setPreset] = useState<BorderPreset>("dashed");
  const [thickness, setThickness] = useState(6);
  const [dashCap, setDashCap] = useState<DashCap>("round");
  const [dash, setDash] = useState(6);
  const [gap, setGap] = useState(6);

  const aThickness = useBorderKnobSpring(thickness);
  const aDash = useBorderKnobSpring(dash);
  const aGap = useBorderKnobSpring(gap);

  const border = useMemo(
    () => buildBorder(preset, aThickness, aDash, aGap, dashCap),
    [preset, aThickness, aDash, aGap, dashCap],
  );

  // Border knobs always tween (short 120ms), so we don't need to track
  // a fromDrag flag — drag and preset clicks both feed through the same
  // path and get the same smoothing.
  const setKnob = (setter: (n: number) => void) => (v: number) => {
    setter(v);
  };

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
            onChange={(next) => {
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
            }}
            pillMinWidth="min-w-[110px]"
          />
        </div>
        <Collapse show={showThickness}>
          <div className={`flex w-full flex-col items-center justify-center p-figma-4 ${ROW_DIVIDER}`}>
            <Slider label="Thickness" value={thickness} min={1} max={20} onChange={setKnob(setThickness)} />
          </div>
        </Collapse>
        <Collapse show={showDashRow}>
          <div className={`w-full ${ROW_DIVIDER}`}>
            <RadioPillGroup
              ariaLabel={`${title} dash cap`}
              options={DASH_CAP_PRESETS}
              value={dashCap}
              onChange={(next) => {
                setDashCap(next);
              }}
            />
          </div>
          <div className={`flex w-full flex-wrap content-center items-center justify-center ${ROW_DIVIDER}`}>
            <div className="flex flex-1 min-w-[210px] flex-col items-center justify-center p-figma-4">
              <Slider label="Dash" value={dash} min={0} max={30} onChange={setKnob(setDash)} />
            </div>
            <div className="flex flex-1 min-w-[210px] flex-col items-center justify-center pl-[14px] pr-figma-4 py-figma-4">
              <Slider label="Gap" value={gap} min={0} max={30} onChange={setKnob(setGap)} />
            </div>
          </div>
        </Collapse>
      </FigureCard>
    </Section>
  );
}

/**
 * Top-level Playground container. Owns the live dialkit panel for slider
 * physics + state-change springs, then provides those values down through
 * `PlaygroundTuningProvider` so every <Slider/> picks them up via context.
 */
export function Playground() {
  const dial = useDialKit("Playground Tuning", {
    stretch: {
      maxStretchPx: [DEFAULT_TUNING.maxStretchPx, 2, 50, 1],
      deadZonePx: [DEFAULT_TUNING.deadZonePx, 0, 100, 2],
      cursorRangePx: [DEFAULT_TUNING.cursorRangePx, 50, 600, 10],
      compressY: [DEFAULT_TUNING.compressY, 0.5, 1, 0.01],
    },
    release: {
      springStiffness: [DEFAULT_TUNING.springStiffness, 50, 1000, 10],
      springDamping: [DEFAULT_TUNING.springDamping, 5, 100, 1],
      springMass: [DEFAULT_TUNING.springMass, 0.1, 5, 0.1],
    },
    track: {
      height: [DEFAULT_TUNING.trackHeight, 2, 20, 1],
      smoothing: [DEFAULT_TUNING.trackSmoothing, 0, 1, 0.05],
    },
    stepHaptic: DEFAULT_TUNING.stepHaptic,
  });

  const tuning: PlaygroundTuning = {
    maxStretchPx: dial.stretch.maxStretchPx,
    deadZonePx: dial.stretch.deadZonePx,
    cursorRangePx: dial.stretch.cursorRangePx,
    compressY: dial.stretch.compressY,
    springStiffness: dial.release.springStiffness,
    springDamping: dial.release.springDamping,
    springMass: dial.release.springMass,
    trackHeight: dial.track.height,
    trackSmoothing: dial.track.smoothing,
    stepHaptic: dial.stepHaptic,
  };

  return (
    <PlaygroundTuningProvider value={tuning}>
      <Layout articleClassName="gap-figma-9">
        <NoteBlock />
        {/* 48px between sections matches Figma `--p-12`; the column already
            uses `gap-figma-9` so we space these manually. */}
        <div className="flex w-full flex-col" style={{ gap: 48 }}>
          <RadiusSection />
          <CornerShapeSection />
          <PerCornerSection />
          <ShadowSection
            title="Drop Shadow"
            description="SVG-based drop shadows that follow the smooth corner path exactly."
            kind="drop"
          />
          <ShadowSection
            title="Inner Shadow"
            description="Inset shadows rendered inside the smooth corner path for depth and dimension."
            kind="inner"
          />
          <BorderSection
            title="Outer Border"
            description="Stroke borders that perfectly trace the smooth corner path. Supports multiple line styles."
            position="outer"
          />
          <BorderSection
            title="Inner Border"
            description="Stroke borders that perfectly trace the smooth corner path. Supports multiple line styles."
            position="inner"
          />
          <BorderSection
            title="Center Border"
            description="Stroke borders that perfectly trace the smooth corner path. Supports multiple line styles."
            position="middle"
          />
        </div>
        <Footer />
      </Layout>
    </PlaygroundTuningProvider>
  );
}
