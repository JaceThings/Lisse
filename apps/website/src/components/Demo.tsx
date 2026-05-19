import { useMemo, useState } from "react";
import { generatePath } from "@lisse/core";
import { GridBackground } from "./GridBackground.tsx";
import { TogglePill } from "./TogglePill.tsx";
import { useTweenedNumber } from "../hooks/useTweenedNumber.ts";
import {
  CheckIcon,
  OverlayFilledIcon,
  OverlayOutlineIcon,
  XMarkIcon,
} from "../icons/sf/index.tsx";

// Two orthogonal toggles:
//   smoothing — front square's corner curve: Apple squircle (0.6) ↔
//               CSS quarter-circle (0).
//   comparing — grow the square to a viewport-responsive size and
//               reveal a red CSS-rounded back overlay underneath. The
//               four red corner gaps show how the squircle pulls in
//               past a plain rounded rect. With smoothing off the
//               layers collapse — no red visible — by design.

const SQUIRCLE_SMOOTHING = 0.6;
// Baked SVG dimensions. The path is generated once at the desktop max
// (510 px); the wrapper sizes itself to the current mode and the SVG
// fills it via `width="100%" height="100%"`. Safari rasterises an SVG
// at its CSS box size, so resizing the wrapper triggers a fresh raster
// at the right resolution — no ancestor `transform: scale()` to up-
// sample a stale bitmap. Radius preserves the Figma 30/141.316 ≈
// 0.2123 squircle character.
const SQUIRCLE_BASE_SIZE = 510;
const SQUIRCLE_RADIUS = SQUIRCLE_BASE_SIZE * (97.711 / 460.319);
// Normal mode — fixed Figma 8:1373 dimensions.
const SQUIRCLE_NORMAL_SIZE = 141.316;
// Compare mode has two regimes, matching the article column's 560 px
// breakpoint (where it flips from `calc(100vw - 32px)` to a fixed 510):
//   • mobile/tablet (< 560 viewport, fluid column) — square fills the
//     column width minus a horizontal inset, so top-left and top-right
//     corners clear the grid mask's side feather. Bottom overflows
//     the grid and is clipped by the mask; only the top corners need
//     to be visible for the comparison to read.
//   • desktop (>= 560 viewport, fixed column) — square pinned to the
//     original Figma 22:207 baseline (460 px) so the demo doesn't
//     grow into the surrounding whitespace.
// `100cqi` resolves to the `@container/column` article's width.
const SQUIRCLE_COMPARE_INSET = 20;
const SQUIRCLE_COMPARE_DESKTOP_SIZE = 460.319;
const SQUIRCLE_COMPARE_MOBILE_SIZE = `calc(100cqi - ${SQUIRCLE_COMPARE_INSET * 2}px)`;
// Top-edge offset from grid top (Figma 22:207 → y=78.84). Top-anchored
// rather than centred so the squircle stays put when the size changes.
const SQUIRCLE_TOP = 78.842;
const SMOOTHING_ICON = 14;
const COMPARE_ICON = 16;

function describeState(smoothing: boolean, comparing: boolean): string {
  const smoothingPart = smoothing
    ? "Smoothing is on; the demo square uses Lisse's squircle corners."
    : "Smoothing is off; the demo square uses standard CSS quarter-circle corners.";
  if (!comparing) return smoothingPart;
  return `Comparison view active. ${smoothingPart}${
    smoothing
      ? " The four red wedges show how far the squircle pulls in from the CSS-rounded back."
      : " The front collapses onto the back, so no red corners are visible."
  }`;
}

export function Demo() {
  const [smoothing, setSmoothing] = useState(true);
  const [comparing, setComparing] = useState(false);

  const toggleSmoothing = () => setSmoothing((s) => !s);
  const toggleCompare = () => setComparing((c) => !c);

  // Tween smoothing rather than letting Lisse snap, so the corners
  // visibly morph between the Apple squircle and the CSS quarter-circle.
  const smoothingActive = useTweenedNumber(
    smoothing ? SQUIRCLE_SMOOTHING : 0,
    { duration: 500 },
  );

  // Inline <svg><path> rather than divs with `clip-path: path()`. Safari
  // rasterises CSS clip-path once at layout size and re-uses that bitmap
  // when the element resizes — stair-steps at the corners as the wrapper
  // grows. SVG paths re-tessellate at composite time, so the curves stay
  // crisp at every size.
  const frontPath = useMemo(
    () => generatePath(SQUIRCLE_BASE_SIZE, SQUIRCLE_BASE_SIZE, {
      radius: SQUIRCLE_RADIUS,
      smoothing: smoothingActive,
    }),
    [smoothingActive],
  );
  const backPath = useMemo(
    () => generatePath(SQUIRCLE_BASE_SIZE, SQUIRCLE_BASE_SIZE, {
      radius: SQUIRCLE_RADIUS,
      smoothing: 0,
    }),
    [],
  );

  return (
    <section
      className="relative isolate w-full"
      style={{ height: "var(--grid-height)" }}
      aria-labelledby="demo-heading"
    >
      <h2 id="demo-heading" className="sr-only">
        Squircle demo
      </h2>

      {/* Masked layer holding both the grid pattern and the squircle.
          Extends 10px past the column on x to match Figma `Mask`
          (530×299 @ x=-10), and feathers all content (grid + squircle)
          out at the edges via /grid-mask.svg. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 -inset-x-2.5 overflow-hidden"
        style={{
          WebkitMaskImage: "url(/grid-mask.svg)",
          maskImage: "url(/grid-mask.svg)",
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          WebkitMaskPosition: "center",
          maskPosition: "center",
          WebkitMaskSize: "100% 100%",
          maskSize: "100% 100%",
        }}
      >
        <GridBackground />

        {/* Centering wrapper. Size is mode-dependent: normal mode is a
            fixed 141 px square; compare mode picks one of two values
            via media query — mobile fills `100cqi - 40px`, desktop
            pins to the original Figma 22:207 baseline (460 px). The
            SVG inside fills the wrapper at 100%×100%, so the squircle
            resizes with its container and Safari rasterises at the
            current layout size (no transform-scale upsampling). On
            mobile the bottom overflows the grid and is clipped by
            the mask; only the top corners stay visible. */}
        <div
          className="absolute left-1/2 max-[559px]:[--squircle-size:var(--squircle-size-mobile)] min-[560px]:[--squircle-size:var(--squircle-size-desktop)]"
          style={{
            top: SQUIRCLE_TOP,
            width: comparing ? "var(--squircle-size)" : `${SQUIRCLE_NORMAL_SIZE}px`,
            height: comparing ? "var(--squircle-size)" : `${SQUIRCLE_NORMAL_SIZE}px`,
            ["--squircle-size-mobile" as string]: SQUIRCLE_COMPARE_MOBILE_SIZE,
            ["--squircle-size-desktop" as string]: `${SQUIRCLE_COMPARE_DESKTOP_SIZE}px`,
            transform: "translateX(-50%)",
            transition: "width 350ms var(--ease-out-quint), height 350ms var(--ease-out-quint)",
          }}
        >
          {/* Compare-mode back: red square at smoothing 0 (CSS quarter-
              circle). As smoothing rises, the front pulls in past the
              back's corners and red shows at the four gaps. */}
          <svg
            aria-hidden
            viewBox={`0 0 ${SQUIRCLE_BASE_SIZE} ${SQUIRCLE_BASE_SIZE}`}
            shapeRendering="geometricPrecision"
            className="absolute inset-0 h-full w-full transition-opacity duration-300 ease-out-quint"
            style={{ opacity: comparing ? 1 : 0 }}
          >
            <path d={backPath} fill="var(--color-accent-red)" />
          </svg>

          <svg
            aria-hidden
            viewBox={`0 0 ${SQUIRCLE_BASE_SIZE} ${SQUIRCLE_BASE_SIZE}`}
            shapeRendering="geometricPrecision"
            className="absolute inset-0 h-full w-full"
          >
            <path
              d={frontPath}
              className="transition-[fill] duration-300 ease-out-quint"
              fill={comparing ? "var(--color-compare-front)" : "var(--color-demo-fill)"}
            />
          </svg>
        </div>
      </div>

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {describeState(smoothing, comparing)}
      </p>

      <div
        className="absolute left-1/2 flex -translate-x-1/2 items-center gap-figma-4"
        // Empirical 0.25 CSS px nudge to land the toggle pills'
        // wrappers on integer device-pixel Y (2× Retina) so Safari's
        // SVG drop-shadow rasterisation lands clean. Anything else on
        // this column's flow would naturally place the pills at a
        // fractional device-pixel that toggles the WebKit shadow bias.
        style={{ top: "30.25px" }}
        data-focus-section="pills"
      >
        <TogglePill
          pressed={smoothing}
          onToggle={toggleSmoothing}
          ariaLabel={smoothing ? "Disable smoothing" : "Enable smoothing"}
          toneClass={smoothing ? "text-accent-green" : "text-accent-red"}
          iconSize={SMOOTHING_ICON}
          pressedIcon={<CheckIcon width={SMOOTHING_ICON} height={SMOOTHING_ICON} />}
          unpressedIcon={<XMarkIcon width={SMOOTHING_ICON} height={SMOOTHING_ICON} />}
          label={smoothing ? "Smoothing" : "No Smoothing"}
        />

        <TogglePill
          pressed={comparing}
          onToggle={toggleCompare}
          ariaLabel={comparing ? "Exit comparison view" : "Enter comparison view"}
          toneClass="text-text-input"
          iconSize={COMPARE_ICON}
          pressedIcon={<OverlayFilledIcon width={COMPARE_ICON} height={COMPARE_ICON} />}
          unpressedIcon={<OverlayOutlineIcon width={COMPARE_ICON} height={COMPARE_ICON} />}
          label="Comparison"
        />
      </div>
    </section>
  );
}
