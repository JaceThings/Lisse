import { useCallback, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Divider } from "../components/Divider.tsx";
import { Stagger } from "../components/Stagger.tsx";
import {
  DEFAULT_TUNING,
  PlaygroundTuningProvider,
} from "../components/playground/PlaygroundTuning.tsx";
import { Slider } from "../components/playground/Slider.tsx";
import { useStateSpring } from "../components/playground/springs.ts";
import { useMorphedCurve } from "../hooks/useMorphedCurve.ts";
import { buildCombFromSamples } from "../lib/comb.ts";
import {
  buildCurve,
  type Curve,
  type CurveSamples,
  type CurveType,
  type LabelledPt,
  pathFromSamples,
} from "../lib/curves.ts";
import { buildOverlay, type MorphedOverlay } from "../lib/overlay.ts";
import { serializeSvg } from "../lib/svg-export.ts";

// Fixed-size viewBox. The corner is repositioned each frame so the
// curve stays *centred* in the figure regardless of how small the
// radius or smoothing get — sliding R down doesn't strand the curve in
// the upper-right corner. The two straight edges then run to the
// outer boundary of the SVG, lengthening as the curve shrinks.
const VB_SIZE = 500;
const HALF_VB = VB_SIZE / 2;
// Visual whisker length at the arc's curvature (κ = 1/R). The comb's
// overall scale is `WHISKER_AT_ARC · R`, so arc whiskers are this many
// viewBox units long for any radius and the cubic-shoulder overshoot
// (~1.5×) still fits in the headroom around the curve.
const WHISKER_AT_ARC = 32;
// Power-law zoom: the geometry is rendered at `DISPLAY_P_AT_MAX ·
// (p / MAX_P) ^ ZOOM_EXP`. ZOOM_EXP < 1 compresses the displayed-size
// range — small radii are zoomed in (so labels don't pile up), large
// radii are drawn nearer their native size, and each radius still
// looks visibly different from the next.
const MAX_P = 2 * 200;
const DISPLAY_P_AT_MAX = 380;
// 0 = flat (all radii render at one size, R slider becomes invisible).
// 1 = linear (true scale, R = 30 disappears into the apex). 0.4 keeps
// every R value distinguishable from the next while still showing
// large radii as visibly larger than small ones.
const ZOOM_EXP = 0.4;

const RADIUS_MIN = 30;
const RADIUS_MAX = 200;
const RADIUS_DEFAULT = 160;
const SMOOTHING_DEFAULT = 0.6;
// Superellipse exponent. n = 2 is an ellipse (curvature blows up at
// the seam — G0 only with a straight edge). n > 2 gives κ = 0 at the
// crossings (G2). n = 4 is the CSS `corner-shape: squircle` default;
// numerical fits to Figma 0.6 / iOS land near n ≈ 5 — picked as the
// /math default for cross-curve visual parity with the Figma squircle.
const EXPONENT_MIN = 2.5;
const EXPONENT_MAX = 8;
const EXPONENT_DEFAULT = 5;

const COMB_DENSITY_MIN = 12;
const COMB_DENSITY_MAX = 200;
const COMB_DENSITY_DEFAULT = 100;

interface Geometry {
  curve: Curve;
  cornerX: number;
  cornerY: number;
  combScale: number;
  /** User-facing R (the unscaled value) — for readouts that should show
   *  what the slider says, not what the diagram is drawing. */
  R: number;
}

/** Natural extent of the curve along each edge before display zoom. */
function naturalExtent(type: CurveType, R: number, smoothing: number): number {
  if (type === "squircle" || type === "clothoid") return (1 + smoothing) * R;
  return R; // arc, superellipse
}

function buildGeometry(
  type: CurveType,
  R: number,
  smoothing: number,
  exponent: number,
): Geometry {
  const p = naturalExtent(type, R, smoothing);
  const displayedP = DISPLAY_P_AT_MAX * (p / MAX_P) ** ZOOM_EXP;
  const scale = p > 0 ? Math.max(1, displayedP / p) : 1;
  const scaledR = R * scale;
  const scaledP = p * scale;
  const cornerX = HALF_VB + scaledP / 2;
  const cornerY = HALF_VB - scaledP / 2;
  const curve = buildCurve({
    type,
    R: scaledR,
    smoothing,
    exponent,
    cornerX,
    cornerY,
  });
  return { curve, cornerX, cornerY, combScale: WHISKER_AT_ARC * scaledR, R };
}

function LabelledPoint({ point, label, offset, tone, opacity = 1 }: LabelledPt & { opacity?: number }) {
  if (opacity <= 0.01) return null;
  const [x, y] = point;
  const fill =
    tone === "primary" ? "var(--color-text-primary)" : "var(--color-text-input)";
  return (
    <g opacity={opacity}>
      <circle cx={x} cy={y} r={3.5} fill={fill} />
      <text
        x={x + offset[0]}
        y={y + offset[1]}
        fill={fill}
        fontSize={11}
        fontFamily="var(--font-mono)"
        textAnchor="middle"
        dominantBaseline="middle"
      >
        {label}
      </text>
    </g>
  );
}

interface DiagramProps {
  /** Samples to render the main curve + comb from. During a curve-type
   *  morph this is the lerped result; otherwise equal to
   *  `geometry.curve.samples`. */
  displaySamples: CurveSamples;
  /** Lerped comb scale across a curve-type morph — see useMorphedCurve. */
  combScale: number;
  /** Pre-computed overlay (labels, polygons, spokes, etc.) with all
   *  positions lerped per-element. */
  overlay: MorphedOverlay;
  /** Number of whiskers in the curvature comb. */
  combDensity: number;
  svgRef: React.Ref<SVGSVGElement>;
}

function Diagram({
  displaySamples,
  combScale,
  overlay,
  combDensity,
  svgRef,
}: DiagramProps) {
  const { whiskers, envelope } = useMemo(
    () => buildCombFromSamples(displaySamples, combScale, combDensity),
    [displaySamples, combScale, combDensity],
  );
  const curvePath = useMemo(() => pathFromSamples(displaySamples), [displaySamples]);

  const primary = "var(--color-text-primary)";
  const muted = "var(--color-text-input)";
  const accentRed = "var(--color-accent-red)";
  const accentGreen = "var(--color-accent-green)";

  const { cornerX, cornerY, P0, P7 } = overlay;

  return (
    <svg
      ref={svgRef}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${VB_SIZE} ${VB_SIZE}`}
      shapeRendering="geometricPrecision"
      overflow="visible"
      className="block h-auto w-full"
      role="img"
      aria-label="Corner curve construction with curvature comb. Two straight edges meet at a corner, replaced by the selected smoothing curve. A green comb shows the curvature at each point along the curve."
    >
      {/* Straight edges — `x1`/`y2` extend past the viewBox so the
          stroke fills the wrapper's padding too, producing the
          "infinite line" effect at the figure edges. */}
      <line
        x1={-VB_SIZE}
        y1={cornerY}
        x2={P0[0]}
        y2={P0[1]}
        stroke={primary}
        strokeWidth={1.25}
        strokeLinecap="butt"
      />
      <line
        x1={cornerX}
        y1={P7[1]}
        x2={cornerX}
        y2={VB_SIZE * 2}
        stroke={primary}
        strokeWidth={1.25}
        strokeLinecap="butt"
      />

      {/* Original sharp corner (dashed) — shows what the smoothing
          pulled in from. */}
      <path
        d={`M ${P0[0]} ${P0[1]} L ${cornerX} ${cornerY} L ${cornerX} ${P7[1]}`}
        fill="none"
        stroke={muted}
        strokeWidth={0.75}
        strokeDasharray="3 3"
        opacity={0.5}
      />

      {overlay.referenceArc ? (
        <path
          d={`M ${overlay.referenceArc.start[0]} ${overlay.referenceArc.start[1]} A ${overlay.referenceArc.R} ${overlay.referenceArc.R} 0 0 1 ${overlay.referenceArc.end[0]} ${overlay.referenceArc.end[1]}`}
          fill="none"
          stroke={muted}
          strokeWidth={0.75}
          strokeDasharray="2 4"
          opacity={overlay.referenceArc.opacity * 0.7}
        />
      ) : null}

      {/* Curvature comb (whiskers + envelope polyline). */}
      <g opacity={0.55}>
        {whiskers.map((w, i) => (
          <line
            key={i}
            x1={w.x1}
            y1={w.y1}
            x2={w.x2}
            y2={w.y2}
            stroke={accentGreen}
            strokeWidth={0.6}
          />
        ))}
      </g>
      <path
        d={envelope}
        fill="none"
        stroke={accentGreen}
        strokeWidth={0.9}
        opacity={0.8}
      />

      {overlay.controlPolygons.map((poly, i) => (
        <path
          key={i}
          d={poly.points
            .map((pt, j) => (j === 0 ? `M ${pt[0]} ${pt[1]}` : `L ${pt[0]} ${pt[1]}`))
            .join(" ")}
          fill="none"
          stroke={accentRed}
          strokeWidth={0.75}
          strokeDasharray="4 3"
          opacity={poly.opacity * 0.7}
        />
      ))}

      {overlay.arcSpokes.map((spoke, i) => (
        <line
          key={i}
          x1={spoke.a[0]}
          y1={spoke.a[1]}
          x2={spoke.b[0]}
          y2={spoke.b[1]}
          stroke={muted}
          strokeWidth={0.5}
          strokeDasharray="2 2"
          opacity={spoke.opacity * 0.6}
        />
      ))}

      {overlay.arcCenter ? (
        <circle
          cx={overlay.arcCenter.point[0]}
          cy={overlay.arcCenter.point[1]}
          r={2}
          fill={muted}
          opacity={overlay.arcCenter.opacity}
        />
      ) : null}

      <path
        d={curvePath}
        fill="none"
        stroke={primary}
        strokeWidth={1.75}
        strokeLinecap="round"
      />

      {overlay.points.map((pt, i) => (
        <LabelledPoint key={`${pt.label}-${i}`} {...pt} opacity={pt.opacity} />
      ))}

      {overlay.arcRadiusReadout ? (
        <text
          x={overlay.arcRadiusReadout.point[0]}
          y={overlay.arcRadiusReadout.point[1]}
          fill={muted}
          fontSize={10}
          fontFamily="var(--font-mono)"
          textAnchor="middle"
          opacity={overlay.arcRadiusReadout.opacity}
        >
          center · R = {overlay.arcRadiusReadout.R.toFixed(1)}
        </text>
      ) : null}
    </svg>
  );
}

interface ReadoutProps {
  curve: Curve;
}

function Readout({ curve }: ReadoutProps) {
  if (!curve.info.length) return null;
  return (
    <dl
      className="grid w-full grid-cols-3 gap-x-4 gap-y-1 text-[12px] text-text-input"
      style={{ fontFamily: "var(--font-mono)" }}
    >
      {curve.info.map((item) => (
        <div key={item.label} className="flex justify-between">
          <dt className="text-[rgba(126,117,108,0.7)]">{item.label}</dt>
          <dd className="tabular-nums">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

const BODY =
  "text-[14px] leading-[1.4] max-[560px]:leading-[1.6] font-medium tracking-[-0.25px] text-text-primary text-justify hyphens-auto";

const formatSmoothing = (v: number) => v.toFixed(2);
const formatRadius = (v: number) => `${Math.round(v)} px`;
const formatExponent = (v: number) => v.toFixed(2);

const CURVE_LABELS: Record<CurveType, { label: string; gn: "G1" | "G2"; sub: string }> = {
  arc: { label: "Arc", gn: "G1", sub: "CSS border-radius" },
  squircle: { label: "Squircle", gn: "G1", sub: "Lisse default · Figma" },
  superellipse: { label: "Superellipse", gn: "G2", sub: "CSS corner-shape" },
  clothoid: { label: "Clothoid", gn: "G2", sub: "Euler-spiral blend" },
};

const CURVE_ORDER: CurveType[] = ["arc", "squircle", "superellipse", "clothoid"];

interface CurvePickerProps {
  value: CurveType;
  onChange: (v: CurveType) => void;
}

function CurvePicker({ value, onChange }: CurvePickerProps) {
  return (
    <div role="radiogroup" aria-label="Curve type" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {CURVE_ORDER.map((type) => {
        const meta = CURVE_LABELS[type];
        const active = value === type;
        return (
          <button
            key={type}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(type)}
            data-focus-ring
            className={
              "flex flex-col items-start gap-0.5 rounded-md border px-3 py-2 text-left transition-colors " +
              (active
                ? "border-[rgba(115,87,74,0.3)] bg-[rgba(115,87,74,0.08)] text-text-primary"
                : "border-transparent bg-[rgba(126,117,108,0.04)] text-text-input hover:bg-[rgba(126,117,108,0.08)]")
            }
          >
            <span className="flex w-full items-baseline justify-between">
              <span className="text-[13px] font-medium tracking-[-0.25px]">{meta.label}</span>
              <span
                className="text-[10px] font-medium tracking-[-0.1px] text-[rgba(126,117,108,0.7)]"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {meta.gn}
              </span>
            </span>
            <span className="text-[11px] tracking-[-0.15px] text-[rgba(126,117,108,0.7)]">
              {meta.sub}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function MathPage() {
  const [curveType, setCurveType] = useState<CurveType>("squircle");
  const [radius, setRadius] = useState(RADIUS_DEFAULT);
  const [smoothing, setSmoothing] = useState(SMOOTHING_DEFAULT);
  const [exponent, setExponent] = useState(EXPONENT_DEFAULT);
  const [combDensity, setCombDensity] = useState(COMB_DENSITY_DEFAULT);
  const [fromDrag, setFromDrag] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const svgRef = useRef<SVGSVGElement>(null);

  const animatedR = useStateSpring(radius, fromDrag);
  const animatedS = useStateSpring(smoothing, fromDrag);
  const animatedE = useStateSpring(exponent, fromDrag);

  const geometry = useMemo(
    () => buildGeometry(curveType, animatedR, animatedS, animatedE),
    [curveType, animatedR, animatedS, animatedE],
  );

  // Curve-type morph: snapshots the visible-on-screen geometry on
  // each click and tweens from there to the new target, so rapid
  // clicks read as one continuous motion through every shape rather
  // than restarting from the previous "prev" curve.
  const targetOverlay = useMemo(
    () => buildOverlay(geometry.curve, geometry.cornerX, geometry.cornerY, geometry.R),
    [geometry],
  );
  const target = useMemo(
    () => ({
      samples: geometry.curve.samples,
      overlay: targetOverlay,
      combScale: geometry.combScale,
    }),
    [geometry.curve.samples, targetOverlay, geometry.combScale],
  );
  const {
    displaySamples,
    displayOverlay: overlay,
    displayCombScale,
    snapshotForMorph,
  } = useMorphedCurve(curveType, target);

  const onCurveType = useCallback(
    (v: CurveType) => {
      setFromDrag(false);
      // Snapshot the visible-on-screen geometry *before* the curveType
      // state change queues a re-render — see useMorphedCurve for why.
      snapshotForMorph();
      setCurveType(v);
    },
    [snapshotForMorph],
  );
  const onSmoothing = useCallback((v: number, drag = false) => {
    setFromDrag(drag);
    setSmoothing(v);
  }, []);
  const onRadius = useCallback((v: number, drag = false) => {
    setFromDrag(drag);
    setRadius(v);
  }, []);
  const onExponent = useCallback((v: number, drag = false) => {
    setFromDrag(drag);
    setExponent(v);
  }, []);
  const onCombDensity = useCallback((v: number, drag = false) => {
    setFromDrag(drag);
    setCombDensity(v);
  }, []);

  const handleCopy = useCallback(async () => {
    if (!svgRef.current) return;
    const text = serializeSvg(svgRef.current);
    try {
      await navigator.clipboard.writeText(text);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
    window.setTimeout(() => setCopyState("idle"), 1600);
  }, []);

  const handleDownload = useCallback(() => {
    if (!svgRef.current) return;
    const text = serializeSvg(svgRef.current);
    const blob = new Blob([text], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lisse-${curveType}-r${Math.round(radius)}.svg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [curveType, radius]);

  const showSmoothing = curveType === "squircle" || curveType === "clothoid";
  const showExponent = curveType === "superellipse";
  // Unified "shape parameter" slider: one DOM-stable Slider for both
  // smoothing and exponent, mapped through a normalised [0, 1] value so
  // switching from squircle → superellipse glides the thumb from
  // (smoothing 0.6 = 60% along) to (exponent 5 = 45% along) rather than
  // mounting / unmounting two separate sliders.
  const shapeValue = showExponent
    ? (exponent - EXPONENT_MIN) / (EXPONENT_MAX - EXPONENT_MIN)
    : smoothing;
  const shapeLabel = showExponent ? "Exponent (n)" : "Smoothing";
  const shapeFormat = useCallback(
    (t: number) =>
      showExponent
        ? formatExponent(EXPONENT_MIN + t * (EXPONENT_MAX - EXPONENT_MIN))
        : formatSmoothing(t),
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
    <PlaygroundTuningProvider value={DEFAULT_TUNING}>
      <section className="flex w-full flex-col gap-6">
        <Stagger index={6}>
          <p className={BODY}>
            Four candidate corner constructions, drawn from the same maths.
            The green comb is the curvature at each point along the curve —
            whisker length is proportional to κ. <strong>G1</strong> means
            tangents match at the seam but curvature can step (the comb has
            a discontinuity). <strong>G2</strong> means curvature is
            continuous, so the comb flows through the joins. Pick a curve
            and slide R/smoothing to see how each behaves.
          </p>
        </Stagger>

        <Stagger index={7}>
          <CurvePicker value={curveType} onChange={onCurveType} />
        </Stagger>

        <Stagger index={8}>
          <div
            className="relative"
            style={{
              width: "min(760px, calc(100vw - 32px))",
              marginLeft: "50%",
              transform: "translateX(-50%)",
            }}
          >
            <div className="relative w-full overflow-hidden rounded-lg bg-[rgba(126,117,108,0.04)] p-3">
              <Diagram
                displaySamples={displaySamples}
                combScale={displayCombScale}
                overlay={overlay}
                combDensity={combDensity}
                svgRef={svgRef}
              />
              <div className="absolute right-3 top-3 flex items-center gap-1.5">
                <span
                  className="rounded-md bg-[rgba(115,87,74,0.08)] px-2 py-1 text-[11px] font-medium tracking-[-0.1px] text-text-input"
                  style={{ fontFamily: "var(--font-mono)" }}
                  aria-label={`Continuity: ${geometry.curve.g2 ? "G2" : "G1"}`}
                >
                  {geometry.curve.g2 ? "G2" : "G1"}
                </span>
                <button
                  type="button"
                  onClick={handleCopy}
                  data-focus-ring
                  className="rounded-md bg-[rgba(115,87,74,0.08)] px-2.5 py-1 text-[11px] font-medium tracking-[-0.15px] text-text-input transition-colors hover:bg-[rgba(115,87,74,0.14)]"
                  aria-label="Copy SVG to clipboard"
                >
                  {copyState === "copied"
                    ? "Copied"
                    : copyState === "failed"
                    ? "Copy failed"
                    : "Copy SVG"}
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  data-focus-ring
                  className="rounded-md bg-[rgba(115,87,74,0.08)] px-2.5 py-1 text-[11px] font-medium tracking-[-0.15px] text-text-input transition-colors hover:bg-[rgba(115,87,74,0.14)]"
                  aria-label="Download SVG"
                >
                  Download
                </button>
              </div>
            </div>
          </div>
        </Stagger>

        <Stagger index={9}>
          <div className="flex w-full flex-col px-1">
            {/* Shape slider blurs in/out at the top when toggling
                between arc and the other three curves. The AnimatePresence
                + height-tweening motion.div handles its own slot;
                flex column flow pushes the sliders below it down
                naturally as the height tweens — no `layout` motion
                needed (which would force per-frame measurement
                during the 60fps morph animation and tank perf). */}
            <AnimatePresence initial={false}>
              {showSmoothing || showExponent ? (
                <motion.div
                  key="shape-slider"
                  initial={{ opacity: 0, filter: "blur(4px)", height: 0 }}
                  animate={{
                    opacity: 1,
                    filter: "blur(0px)",
                    height: "auto",
                    marginBottom: 20,
                  }}
                  exit={{ opacity: 0, filter: "blur(4px)", height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.32, ease: [0.22, 0.61, 0.36, 1] }}
                  style={{ overflow: "hidden" }}
                >
                  <Slider
                    label={shapeLabel}
                    value={shapeValue}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={onShapeChange}
                    format={shapeFormat}
                  />
                </motion.div>
              ) : null}
            </AnimatePresence>
            <div className="flex flex-col gap-5">
              <Slider
                label="Corner radius"
                value={radius}
                min={RADIUS_MIN}
                max={RADIUS_MAX}
                step={1}
                onChange={onRadius}
                format={formatRadius}
              />
              <Slider
                label="Comb density"
                value={combDensity}
                min={COMB_DENSITY_MIN}
                max={COMB_DENSITY_MAX}
                step={1}
                onChange={onCombDensity}
                format={(v) => `${Math.round(v)} whiskers`}
              />
            </div>
          </div>
        </Stagger>

        <Stagger index={10}>
          <Readout curve={geometry.curve} />
        </Stagger>

        <Stagger index={11}>
          <Divider />
        </Stagger>

        <Stagger index={12}>
          <p className={BODY}>
            <strong>Arc</strong> is what CSS <code>border-radius</code> draws:
            a quarter circle bolted onto the straight edges. Tangents match
            but curvature jumps from 0 on the edge to 1/R inside the arc in
            a single step — that's the seam designers complain about.
          </p>
        </Stagger>

        <Stagger index={13}>
          <p className={BODY}>
            <strong>Squircle</strong> is Lisse's current shape and what
            Figma ships. Two cubic Bézier shoulders ease into a smaller
            central circular arc. Curvature ramps gradually instead of
            jumping, but there's still a small step at P3 / P4 where each
            shoulder meets the arc — visible on the comb as the
            "Batman hat." This is G1, not G2.
          </p>
        </Stagger>

        <Stagger index={14}>
          <p className={BODY}>
            <strong>Superellipse</strong>{" "}
            <code>|x/R|^n + |y/R|^n = 1</code> is what CSS{" "}
            <code>corner-shape: squircle</code> resolves to (with n = 4).
            For any n &gt; 2 the curvature is exactly 0 where the curve
            meets each edge — so it's G2 with no shoulder construction
            needed. Different curvature distribution from the
            Apple/Figma shape, though: it reads as a distinct family
            rather than a smoother version of the same curve.
          </p>
        </Stagger>

        <Stagger index={15}>
          <p className={BODY}>
            <strong>Clothoid</strong> blends each straight edge into a
            central circular arc with an Euler-spiral segment whose
            curvature ramps linearly along arc length — 0 at the edge,
            1/R at the arc. G2 everywhere by construction (κ matches at
            every seam), with a recognisably different character from
            the Apple/Figma squircle: rounder at the apex, longer in
            the corner extent. Classic highway-transition geometry.
          </p>
        </Stagger>

        <Stagger index={16}>
          <p className={`${BODY} text-text-secondary`}>
            Math derivations and source citations live in{" "}
            <code className="text-[13px]" style={{ fontFamily: "var(--font-mono)" }}>
              docs/curves.md
            </code>
            .
          </p>
        </Stagger>
      </section>
    </PlaygroundTuningProvider>
  );
}
