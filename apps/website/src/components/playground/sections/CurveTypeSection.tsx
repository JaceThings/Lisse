import { useCallback, useMemo, useRef, useState } from "react";
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

const CURVE_PRESETS = [
  { value: "arc", label: "Arc" },
  { value: "squircle", label: "Squircle" },
  { value: "superellipse", label: "Superellipse" },
  { value: "clothoid", label: "Clothoid" },
] as const satisfies ReadonlyArray<{ value: CurveType; label: string }>;

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

  const onCurveChange = useCallback((next: CurveType) => {
    setCurve((prev) => {
      if (next === prev) return prev;
      // Snapshot before the curve update — the live displayed samples
      // still belong to the old curve at this exact moment, so this
      // captures the right starting point.
      snapshot();
      setMorphT(0);
      animationRef.current?.stop();
      animationRef.current = animate(0, 1, {
        type: "tween",
        duration: MORPH_DURATION_S,
        ease: MORPH_EASE,
        onUpdate: (v) => setMorphT(v),
        onComplete: () => setMorphT(1),
      });
      setFromDrag(false);
      return next;
    });
  }, [snapshot]);

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

  const d = useMemo(() => pathFromSamples(displaySamples), [displaySamples]);

  // One DOM-stable Slider for the shape parameter — value, label, and
  // format swap based on curve so the thumb glides between e.g.
  // squircle smoothing 0.6 (60 %) and superellipse n = 5 (45 %).
  const showShape = curve !== "arc";
  const showExponent = curve === "superellipse";
  const shapeValue = showExponent
    ? (exponent - EXPONENT_MIN) / (EXPONENT_MAX - EXPONENT_MIN)
    : smoothing;
  const shapeLabel = showExponent ? "Exponent (n)" : "Smoothing";
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
      title="Curve Type"
      description="Pick the corner construction. Squircle is the Lisse default (Figma's curve). Arc is CSS border-radius. Superellipse is the CSS corner-shape family (n = 5 — closest to Figma 0.6). Clothoid is the G2 Euler-spiral blend."
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
            ariaLabel="Curve type"
            options={CURVE_PRESETS}
            value={curve}
            onChange={onCurveChange}
            pillBasis="max-[560px]:basis-[calc(50%-6px)]"
          />
        </div>
        <div className={`flex w-full flex-col items-center justify-center p-4 ${ROW_DIVIDER}`}>
          <Slider
            label="Radius"
            value={radius}
            min={0}
            max={50}
            onChange={onRadius}
          />
        </div>
        <Collapse show={showShape}>
          <div className={`flex w-full flex-col items-center justify-center p-4 ${ROW_DIVIDER}`}>
            <Slider
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
