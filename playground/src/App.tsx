import { useState, type ReactNode } from "react";
import { SmoothCorners } from "@smooth-corners/react";
import { Button, SliderField } from "system-1";
import { useSpring } from "./use-spring";

// ─── Types ───────────────────────────────────────────────

type Framework = "React" | "Vue" | "Svelte" | "Vanilla";
type BorderStyle = "solid" | "dashed" | "dotted" | "double" | "groove" | "ridge";

// ─── Constants ───────────────────────────────────────────

const DEMO_RADIUS = 20;
const DEMO_SMOOTHING = 0.6;

// ─── Shared ──────────────────────────────────────────────

function FrameworkGrid({
  render,
}: {
  render: (fw: Framework) => ReactNode;
}) {
  return (
    <div className="sc-grid">
      <div className="sc-grid-half">
        <div className="sc-grid-quarter">{render("React")}</div>
        <div className="sc-grid-quarter">{render("Vue")}</div>
      </div>
      <div className="sc-grid-half">
        <div className="sc-grid-quarter">{render("Svelte")}</div>
        <div className="sc-grid-quarter">{render("Vanilla")}</div>
      </div>
    </div>
  );
}

function Reveal({ open, children }: { open: boolean; children: ReactNode }) {
  const progress = useSpring(open ? 1 : 0);
  return (
    <div
      className="doc-controls-reveal"
      style={{ gridTemplateRows: `${progress}fr` }}
    >
      {children}
    </div>
  );
}

function DemoFigure({ open, children }: { open: boolean; children: ReactNode }) {
  const animBottom = useSpring(open ? 16 : 20);
  return (
    <SmoothCorners
      topLeft={12}
      topRight={12}
      bottomLeft={animBottom}
      bottomRight={animBottom}
      outerBorder={{ width: 1, color: "#ffffff", opacity: 0.08, style: "solid" }}
      autoEffects={false}
      className="doc-figure"
    >
      {children}
    </SmoothCorners>
  );
}

function Toggle({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      state={active ? "pressed" : "idle"}
      style={{ flex: "1 0 0" }}
    >
      {children}
    </Button>
  );
}

// ─── Radius ──────────────────────────────────────────────

function RadiusSection() {
  const [radius, setRadius] = useState(DEMO_RADIUS);
  const [preset, setPreset] = useState(1);
  const animRadius = useSpring(radius);
  const isCustom = preset === 3;

  const presets = [
    { label: "Radius: 0", value: 0 },
    { label: `Radius: ${DEMO_RADIUS}`, value: DEMO_RADIUS },
    { label: "Radius: 50", value: 50 },
  ];

  return (
    <div className="doc-section">
      <h2>Radius</h2>
      <p className="doc-description">
        Control the corner radius. Higher values produce rounder corners.
      </p>
      <DemoFigure open={isCustom}>
        <FrameworkGrid
          render={(fw) => (
            <SmoothCorners
              radius={animRadius}
              smoothing={DEMO_SMOOTHING}
              autoEffects={false}
              className="sc-example"
            >
              <span>{fw}</span>
            </SmoothCorners>
          )}
        />
        <div className="doc-toggles">
          {presets.map((p, i) => (
            <Toggle
              key={i}
              active={preset === i}
              onClick={() => {
                setRadius(p.value);
                setPreset(i);
              }}
            >
              {p.label}
            </Toggle>
          ))}
          <Toggle active={isCustom} onClick={() => setPreset(3)}>
            Custom
          </Toggle>
        </div>
        <Reveal open={isCustom}>
          <div className="doc-controls">
            <div className="doc-control-cell">
              <SliderField
                label="Radius"
                value={radius}
                min={0}
                max={50}
                step={1}
                onValueChange={(v) => {
                  setRadius(v);
                  setPreset(3);
                }}
                formatValue={(v) => `${v}`}
              />
            </div>
          </div>
        </Reveal>
      </DemoFigure>
    </div>
  );
}

// ─── Corner Shape ────────────────────────────────────────

function CornerShapeSection() {
  const [withSmoothing, setWithSmoothing] = useState(true);
  const [smoothing, setSmoothing] = useState(DEMO_SMOOTHING);
  const animSmoothing = useSpring(smoothing);

  return (
    <div className="doc-section">
      <h2>Corner Shape</h2>
      <p className="doc-description">
        Smoothing controls how gradually the curve transitions into the straight
        edge. A value of <code>0</code> gives standard circular arcs, while{" "}
        <code>1</code> produces a full squircle.
      </p>
      <DemoFigure open={withSmoothing}>
        <FrameworkGrid
          render={(fw) =>
            withSmoothing ? (
              <SmoothCorners
                radius={DEMO_RADIUS}
                smoothing={animSmoothing}
                autoEffects={false}
                className="sc-example"
              >
                <span>{fw}</span>
              </SmoothCorners>
            ) : (
              <div className="sc-example" style={{ borderRadius: DEMO_RADIUS }}>
                <span>{fw}</span>
              </div>
            )
          }
        />
        <div className="doc-toggles">
          <Toggle
            active={!withSmoothing}
            onClick={() => setWithSmoothing(false)}
          >
            Without Smoothing
          </Toggle>
          <Toggle
            active={withSmoothing}
            onClick={() => setWithSmoothing(true)}
          >
            With Smoothing
          </Toggle>
        </div>
        <Reveal open={withSmoothing}>
          <div className="doc-controls">
            <div className="doc-control-cell">
              <SliderField
                label="Smoothing"
                value={Math.round(smoothing * 100)}
                min={0}
                max={100}
                step={1}
                onValueChange={(v) => {
                  setSmoothing(v / 100);
                  setWithSmoothing(true);
                }}
                formatValue={(v) => (v / 100).toFixed(2)}
              />
            </div>
          </div>
        </Reveal>
      </DemoFigure>
    </div>
  );
}

// ─── Per-Corner Radius ───────────────────────────────────

function PerCornerSection() {
  const [tl, setTl] = useState(DEMO_RADIUS);
  const [tr, setTr] = useState(DEMO_RADIUS);
  const [bl, setBl] = useState(DEMO_RADIUS);
  const [br, setBr] = useState(DEMO_RADIUS);
  const [preset, setPreset] = useState(0);

  const animTl = useSpring(tl);
  const animTr = useSpring(tr);
  const animBl = useSpring(bl);
  const animBr = useSpring(br);

  const isCustom = preset === 3;

  const presets = [
    { label: "All Equal", tl: DEMO_RADIUS, tr: DEMO_RADIUS, bl: DEMO_RADIUS, br: DEMO_RADIUS },
    { label: "Top Only", tl: DEMO_RADIUS, tr: DEMO_RADIUS, bl: 0, br: 0 },
    { label: "Single", tl: DEMO_RADIUS, tr: 0, bl: 0, br: 0 },
  ];

  function apply(i: number) {
    if (i < presets.length) {
      const p = presets[i];
      setTl(p.tl);
      setTr(p.tr);
      setBl(p.bl);
      setBr(p.br);
    }
    setPreset(i);
  }

  return (
    <div className="doc-section">
      <h2>Per-Corner Radius</h2>
      <p className="doc-description">
        Each corner can have its own radius and smoothing, independently
        controlled.
      </p>
      <DemoFigure open={isCustom}>
        <FrameworkGrid
          render={(fw) => (
            <SmoothCorners
              topLeft={animTl}
              topRight={animTr}
              bottomLeft={animBl}
              bottomRight={animBr}
              autoEffects={false}
              className="sc-example"
            >
              <span>{fw}</span>
            </SmoothCorners>
          )}
        />
        <div className="doc-toggles">
          {presets.map((p, i) => (
            <Toggle key={i} active={preset === i} onClick={() => apply(i)}>
              {p.label}
            </Toggle>
          ))}
          <Toggle active={isCustom} onClick={() => setPreset(3)}>
            Custom
          </Toggle>
        </div>
        <Reveal open={isCustom}>
          <div className="doc-controls">
            <div className="doc-control-cell">
              <SliderField label="Top Left" value={tl} min={0} max={50} step={1} onValueChange={(v) => { setTl(v); setPreset(3); }} formatValue={(v) => `${v}`} />
            </div>
            <div className="doc-control-cell">
              <SliderField label="Top Right" value={tr} min={0} max={50} step={1} onValueChange={(v) => { setTr(v); setPreset(3); }} formatValue={(v) => `${v}`} />
            </div>
            <div className="doc-control-cell">
              <SliderField label="Bottom Left" value={bl} min={0} max={50} step={1} onValueChange={(v) => { setBl(v); setPreset(3); }} formatValue={(v) => `${v}`} />
            </div>
            <div className="doc-control-cell">
              <SliderField label="Bottom Right" value={br} min={0} max={50} step={1} onValueChange={(v) => { setBr(v); setPreset(3); }} formatValue={(v) => `${v}`} />
            </div>
          </div>
        </Reveal>
      </DemoFigure>
    </div>
  );
}

// ─── Shadow (shared for drop and inner) ──────────────────

function ShadowSection({
  title,
  description,
  kind,
  opacity,
  presets: sectionPresets,
  blurMax,
  spreadMax,
}: {
  title: string;
  description: string;
  kind: "shadow" | "innerShadow";
  opacity: number;
  presets: { label: string; ox: number; oy: number; blur: number; spread: number }[];
  blurMax: number;
  spreadMax: number;
}) {
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(sectionPresets[1].oy);
  const [blur, setBlur] = useState(sectionPresets[1].blur);
  const [spread, setSpread] = useState(0);
  const [preset, setPreset] = useState(1);

  const animOffsetX = useSpring(offsetX);
  const animOffsetY = useSpring(offsetY);
  const animBlur = useSpring(blur);
  const animSpread = useSpring(spread);

  const isCustom = preset === 3;

  const allPresets = [
    { label: "None", ox: 0, oy: 0, blur: 0, spread: 0 },
    ...sectionPresets,
  ];

  function apply(i: number) {
    if (i < allPresets.length) {
      const p = allPresets[i];
      setOffsetX(p.ox);
      setOffsetY(p.oy);
      setBlur(p.blur);
      setSpread(p.spread);
    }
    setPreset(i);
  }

  const shadowConfig = {
    offsetX: animOffsetX,
    offsetY: animOffsetY,
    blur: animBlur,
    spread: animSpread,
    color: "#000000",
    opacity,
  };

  return (
    <div className="doc-section">
      <h2>{title}</h2>
      <p className="doc-description">{description}</p>
      <DemoFigure open={isCustom}>
        <FrameworkGrid
          render={(fw) => (
            <SmoothCorners
              radius={DEMO_RADIUS}
              smoothing={DEMO_SMOOTHING}
              autoEffects={false}
              {...(kind === "shadow"
                ? { shadow: shadowConfig }
                : { innerShadow: shadowConfig })}
              className="sc-example"
            >
              <span>{fw}</span>
            </SmoothCorners>
          )}
        />
        <div className="doc-toggles">
          {allPresets.map((p, i) => (
            <Toggle key={i} active={preset === i} onClick={() => apply(i)}>
              {p.label}
            </Toggle>
          ))}
          <Toggle active={isCustom} onClick={() => setPreset(3)}>
            Custom
          </Toggle>
        </div>
        <Reveal open={isCustom}>
          <div className="doc-controls">
            <div className="doc-control-cell">
              <SliderField label="X" value={offsetX} min={-20} max={20} step={1} onValueChange={(v) => { setOffsetX(v); setPreset(3); }} formatValue={(v) => `${v}`} />
            </div>
            <div className="doc-control-cell">
              <SliderField label="Y" value={offsetY} min={-20} max={20} step={1} onValueChange={(v) => { setOffsetY(v); setPreset(3); }} formatValue={(v) => `${v}`} />
            </div>
            <div className="doc-control-cell">
              <SliderField label="Blur" value={blur} min={0} max={blurMax} step={1} onValueChange={(v) => { setBlur(v); setPreset(3); }} formatValue={(v) => `${v}`} />
            </div>
            <div className="doc-control-cell">
              <SliderField label="Spread" value={spread} min={0} max={spreadMax} step={1} onValueChange={(v) => { setSpread(v); setPreset(3); }} formatValue={(v) => `${v}`} />
            </div>
          </div>
        </Reveal>
      </DemoFigure>
    </div>
  );
}

// ─── Border (shared for outer and inner) ─────────────────

const BORDER_STYLES: BorderStyle[] = ["solid", "dashed", "dotted", "double", "groove", "ridge"];

type DashCap = "butt" | "square" | "round";

function BorderSection({
  title,
  description,
  kind,
}: {
  title: string;
  description: string;
  kind: "outer" | "inner" | "middle";
}) {
  const [style, setStyle] = useState<BorderStyle | "none">("solid");
  const [activeStyle, setActiveStyle] = useState<BorderStyle>("solid");
  const [thickness, setThickness] = useState(4.5);
  const [savedThickness, setSavedThickness] = useState(4.5);
  const [dashCap, setDashCap] = useState<DashCap>("round");
  const [dash, setDash] = useState(6);
  const [gap, setGap] = useState(6);
  const animThickness = useSpring(style === "none" ? 0 : thickness);
  const animDash = useSpring(dash);
  const animGap = useSpring(gap);

  const hasStyle = style !== "none";
  const hasDash = style === "dashed" || style === "dotted";
  const activeHasDash = activeStyle === "dashed" || activeStyle === "dotted";

  const borderConfig =
    animThickness > 0 || hasStyle
      ? {
          width: animThickness,
          color: "#7dcc7b",
          opacity: 1,
          style: activeStyle,
          ...(activeHasDash ? { dash: animDash, gap: animGap, lineCap: dashCap } : {}),
        }
      : undefined;

  return (
    <div className="doc-section">
      <h2>{title}</h2>
      <p className="doc-description">{description}</p>
      <DemoFigure open={hasStyle}>
        <FrameworkGrid
          render={(fw) => (
            <SmoothCorners
              radius={DEMO_RADIUS}
              smoothing={DEMO_SMOOTHING}
              autoEffects={false}
              {...(borderConfig
                ? kind === "outer"
                  ? { outerBorder: borderConfig }
                  : kind === "middle"
                  ? { middleBorder: borderConfig }
                  : { innerBorder: borderConfig }
                : {})}
              className="sc-example"
            >
              <span>{fw}</span>
            </SmoothCorners>
          )}
        />
        <div className="doc-toggles">
          <Toggle active={style === "none"} onClick={() => {
            setSavedThickness(thickness);
            setStyle("none");
          }}>
            None
          </Toggle>
          {BORDER_STYLES.map((s) => (
            <Toggle key={s} active={style === s} onClick={() => {
              if (s === "dotted") setDash(0);
              else if (s === "dashed" && style === "dotted") setDash(6);
              if (style === "none") setThickness(savedThickness);
              setActiveStyle(s);
              setStyle(s);
            }}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </Toggle>
          ))}
        </div>
        <Reveal open={hasStyle}>
          <div className="doc-controls">
            <div className="doc-control-cell" style={{ minWidth: 420 }}>
              <SliderField
                label="Thickness"
                value={thickness}
                min={0}
                max={12}
                step={0.5}
                onValueChange={setThickness}
                formatValue={(v) => `${v}`}
              />
            </div>
          </div>
        </Reveal>
        <Reveal open={hasDash}>
          <div>
            <div className="doc-toggles">
              <Toggle active={dashCap === "butt"} onClick={() => setDashCap("butt")}>
                No Dash Cap
              </Toggle>
              <Toggle active={dashCap === "square"} onClick={() => setDashCap("square")}>
                Square Dash Cap
              </Toggle>
              <Toggle active={dashCap === "round"} onClick={() => setDashCap("round")}>
                Round Dash Cap
              </Toggle>
            </div>
            <div className="doc-controls">
              <div className="doc-control-cell">
                <SliderField label="Dash" value={dash} min={0} max={50} step={1} onValueChange={setDash} formatValue={(v) => `${v}`} />
              </div>
              <div className="doc-control-cell">
                <SliderField label="Gap" value={gap} min={0} max={50} step={1} onValueChange={setGap} formatValue={(v) => `${v}`} />
              </div>
            </div>
          </div>
        </Reveal>
      </DemoFigure>
    </div>
  );
}

// ─── App ─────────────────────────────────────────────────

const lastUpdated = new Date().toLocaleDateString("en-US", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

export function App() {
  return (
    <div className="doc-page">
      <div className="doc-card">
        <div className="doc-card-spacer" />
        <div className="doc-content">
          <div className="doc-title">
            <h1>Smooth Corners</h1>
            <p>Last updated: {lastUpdated}</p>
          </div>

          <RadiusSection />
          <CornerShapeSection />
          <PerCornerSection />
          <ShadowSection
            kind="shadow"
            title="Drop Shadow"
            description="SVG drop shadows that perfectly follow the squircle shape."
            opacity={0.4}
            presets={[
              { label: "Subtle", ox: 0, oy: 4, blur: 8, spread: 0 },
              { label: "Medium", ox: 0, oy: 4, blur: 16, spread: 0 },
            ]}
            blurMax={40}
            spreadMax={20}
          />
          <ShadowSection
            kind="innerShadow"
            title="Inner Shadow"
            description="Inset shadows that precisely clip to the smooth corner path for realistic depth."
            opacity={0.5}
            presets={[
              { label: "Subtle", ox: 0, oy: 2, blur: 4, spread: 0 },
              { label: "Medium", ox: 0, oy: 2, blur: 8, spread: 0 },
            ]}
            blurMax={24}
            spreadMax={12}
          />
          <BorderSection
            kind="outer"
            title="Outer Border"
            description="Rendered as an SVG stroke outside the clip-path, so it follows the smooth curve without being clipped. Six CSS border styles are supported."
          />
          <BorderSection
            kind="middle"
            title="Middle Border"
            description="Centered on the shape edge — half inside, half outside. The natural SVG stroke position."
          />
          <BorderSection
            kind="inner"
            title="Inner Border"
            description="Drawn inside the shape using an inset SVG path, giving the appearance of an inset frame. Useful for layered card styles or pressed-in UI."
          />
        </div>
        <div className="doc-card-spacer" />
      </div>
    </div>
  );
}
