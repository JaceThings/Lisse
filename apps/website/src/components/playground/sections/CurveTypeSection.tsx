import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { animate } from "framer-motion";
import { generatePath } from "@lisse/core";
import type { CurveType } from "@lisse/react";
import { Collapse } from "../Collapse.tsx";
import { FigureCard } from "../FigureCard.tsx";
import { RadioPillGroup } from "../RadioPillGroup.tsx";
import { Section } from "../Section.tsx";
import { Slider } from "../Slider.tsx";
import { useStateSpring } from "../springs.ts";
import { ROW_DIVIDER } from "../styles.ts";
import { useMorphedValue } from "../../../hooks/useMorphedValue.ts";
import {
  lerpSampledPaths,
  pathFromSamples,
  samplePath,
  type SampledPath,
} from "../../../lib/sample-path.ts";
import { m } from "../../../paraglide/messages.js";

const EXPONENT_MIN = 2.5;
const EXPONENT_MAX = 8;
const EXPONENT_DEFAULT = 5;

const PREVIEW_SIZE = 100;
const CANVAS_HEIGHT = 255;
const SAMPLE_COUNT = 200;
const MORPH_DURATION_S = 0.45;
const MORPH_EASE = [0.32, 0.72, 0, 1] as const;

const FILL = "#7e766d";

export function CurveTypeSection() {
  const CURVE_PRESETS = [
    { value: "arc", label: m.section_curvetype_preset_arc() },
    { value: "squircle", label: m.section_curvetype_preset_squircle() },
    { value: "superellipse", label: m.section_curvetype_preset_superellipse() },
    { value: "clothoid", label: m.section_curvetype_preset_clothoid() },
  ] as const satisfies ReadonlyArray<{ value: CurveType; label: string }>;

  const [curve, setCurve] = useState<CurveType>("squircle");
  const [radius, setRadius] = useState(20);
  const [smoothing, setSmoothing] = useState(0.6);
  const [exponent, setExponent] = useState(EXPONENT_DEFAULT);
  const [fromDrag, setFromDrag] = useState(false);

  const animatedRadius = useStateSpring(radius, fromDrag);
  const animatedSmoothing = useStateSpring(smoothing, fromDrag);
  const animatedExponent = useStateSpring(exponent, fromDrag);

  // Re-sample every render so spring-driven prop changes flow through.
  // The morph hook's `snapshot()` captures the live displayed samples
  // when called from the click handler before setCurve fires.
  const latestSamples = useMemo<SampledPath>(
    () =>
      samplePath(
        generatePath(PREVIEW_SIZE, PREVIEW_SIZE, {
          radius: animatedRadius,
          smoothing: animatedSmoothing,
          curve,
          exponent: animatedExponent,
        }),
        SAMPLE_COUNT,
      ),
    [animatedRadius, animatedSmoothing, curve, animatedExponent],
  );

  const [morphT, setMorphT] = useState(1);
  const { display: displaySamples, snapshot } = useMorphedValue(
    latestSamples,
    lerpSampledPaths,
    morphT,
  );
  const animationRef = useRef<ReturnType<typeof animate> | null>(null);

  // Track current curve in a ref so the click handler can read it
  // without taking the state as a callback dep (keeps onCurveChange
  // stable across renders).
  const curveRef = useRef(curve);
  curveRef.current = curve;

  const onCurveChange = useCallback((next: CurveType) => {
    if (next === curveRef.current) return;
    // Snapshot the live displayed samples — they still belong to the
    // old curve at this point — before the curve update flushes. Side
    // effects live OUTSIDE the setState updater so StrictMode dev
    // double-renders don't double-trigger the animation.
    snapshot();
    setMorphT(0);
    setFromDrag(false);
    animationRef.current?.stop();
    animationRef.current = animate(0, 1, {
      type: "tween",
      duration: MORPH_DURATION_S,
      ease: MORPH_EASE,
      onUpdate: (v) => setMorphT(v),
      onComplete: () => setMorphT(1),
    });
    setCurve(next);
  }, [snapshot]);

  // Stop any in-flight morph on unmount so the animation doesn't try
  // to setState on a dead component.
  useEffect(() => () => animationRef.current?.stop(), []);

  const onRadius = useCallback((v: number, drag = false) => {
    setFromDrag(drag);
    setRadius(v);
  }, []);
  const onSmoothing = useCallback((v: number, drag = false) => {
    setFromDrag(drag);
    setSmoothing(v);
  }, []);
  const onExponent = useCallback((v: number, drag = false) => {
    setFromDrag(drag);
    setExponent(v);
  }, []);

  // The morph preview samples the path with the browser's getPointAtLength
  // (samplePath), which is client-only — on the server it returns [] and the
  // path renders empty, then flashes in on hydration. So render the raw
  // generatePath() curve (pure @lisse/core math, SSR-safe, visually identical)
  // on the server and the first client render — hydration matches and the curve
  // shows immediately — then switch to the sampled/morph path after mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const rawPath = useMemo(
    () =>
      generatePath(PREVIEW_SIZE, PREVIEW_SIZE, {
        radius: animatedRadius,
        smoothing: animatedSmoothing,
        curve,
        exponent: animatedExponent,
      }),
    [animatedRadius, animatedSmoothing, curve, animatedExponent],
  );
  const sampledPath = useMemo(
    () => pathFromSamples(displaySamples),
    [displaySamples],
  );
  const d = mounted ? sampledPath : rawPath;

  // One DOM-stable Slider whose value, label, and format swap with
  // curve so the thumb glides between squircle smoothing 0.6 (60 %)
  // and superellipse n = 5 (45 %). Latch the rendered curve — when
  // curve becomes "arc", Collapse keeps the slider's children alive
  // during the exit; without the latch, "Exponent (n)" would flip to
  // "Smoothing" mid-exit (showExponent goes false the instant curve
  // becomes "arc").
  const showShape = curve !== "arc";
  const shapeCurveRef = useRef<CurveType>(curve);
  const shapeCurve = showShape ? curve : shapeCurveRef.current;
  // Sync post-commit so StrictMode/concurrent renders that get discarded
  // don't leave the ref ahead of the committed tree. `shapeCurve` reads
  // the ref only on the `!showShape` path, so the post-commit timing
  // doesn't change any visible output — the last `showShape === true`
  // commit's effect has always already run by the time we read it.
  useEffect(() => {
    if (showShape) shapeCurveRef.current = curve;
  }, [showShape, curve]);

  // Bump on entry from hidden so the Slider remounts — preserves the
  // squircle ↔ superellipse morph (both non-arc, key stable) but stops
  // stale "Exponent (n)" from animating into a fresh "Smoothing" when
  // the row reopens for a different curve.
  const [entryKey, setEntryKey] = useState(0);
  const wasShownRef = useRef(showShape);
  useEffect(() => {
    if (showShape && !wasShownRef.current) setEntryKey((k) => k + 1);
    wasShownRef.current = showShape;
  }, [showShape]);
  const showExponent = shapeCurve === "superellipse";
  const shapeValue = showExponent
    ? (exponent - EXPONENT_MIN) / (EXPONENT_MAX - EXPONENT_MIN)
    : smoothing;
  const shapeLabel = showExponent
    ? m.section_curvetype_exponent_label()
    : m.section_curvetype_smoothing_label();
  const shapeFormat = useCallback(
    (t: number) =>
      showExponent
        ? (EXPONENT_MIN + t * (EXPONENT_MAX - EXPONENT_MIN)).toFixed(2)
        : t.toFixed(2),
    [showExponent],
  );
  const onShapeChange = useCallback(
    (next: number, drag = false) => {
      if (showExponent) {
        onExponent(EXPONENT_MIN + next * (EXPONENT_MAX - EXPONENT_MIN), drag);
      } else {
        onSmoothing(next, drag);
      }
    },
    [showExponent, onExponent, onSmoothing],
  );

  return (
    <Section
      title={m.section_curvetype_title()}
      description={m.section_curvetype_desc()}
    >
      <FigureCard>
        <div
          className="flex w-full items-center justify-center"
          style={{ height: CANVAS_HEIGHT }}
        >
          <svg
            width={PREVIEW_SIZE}
            height={PREVIEW_SIZE}
            viewBox={`0 0 ${PREVIEW_SIZE} ${PREVIEW_SIZE}`}
            shapeRendering="geometricPrecision"
            aria-hidden
          >
            <path d={d} fill={FILL} />
          </svg>
        </div>
        <div className={`w-full ${ROW_DIVIDER}`}>
          <RadioPillGroup
            ariaLabel={m.section_curvetype_preset_aria()}
            options={CURVE_PRESETS}
            value={curve}
            onChange={onCurveChange}
            pillBasis="max-[560px]:basis-[calc(50%-6px)]"
          />
        </div>
        <div className={`flex w-full flex-col items-center justify-center p-4 ${ROW_DIVIDER}`}>
          <Slider
            label={m.section_curvetype_radius_label()}
            value={radius}
            min={0}
            max={50}
            onChange={onRadius}
          />
        </div>
        <Collapse show={showShape}>
          <div className={`flex w-full flex-col items-center justify-center p-4 ${ROW_DIVIDER}`}>
            <Slider
              key={entryKey}
              label={shapeLabel}
              value={shapeValue}
              min={0}
              max={1}
              step={0.01}
              onChange={onShapeChange}
              format={shapeFormat}
            />
          </div>
        </Collapse>
      </FigureCard>
    </Section>
  );
}
