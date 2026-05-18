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
//   comparing — zoom (~3.26×) + a red CSS-rounded back overlay. The
//               four red corner gaps reveal how the squircle pulls in
//               past a plain rounded rect. With smoothing off in compare
//               mode the layers collapse — no red visible — by design.

const SQUIRCLE_SMOOTHING = 0.6;
// Inverted-scale baseline. Figma 8:1373 → 141.316² (radius 30) in normal
// mode; Figma 22:207 → 460.319² (radius ~97.7) in compare mode. We render
// the SVG at COMPARE size as the layout baseline and `scale(0.307)` DOWN
// for normal mode rather than scaling UP for compare. Safari rasterises
// an SVG's content at its layout size and bilinear-upsamples the cache
// when an ancestor transform enlarges it — visible as stair-stepping
// under the 3.26× zoom. Downsampling is always crisp, so the inverted
// baseline produces clean curves at both states. Radius scales
// proportionally to preserve the 30 / 141.316 ≈ 0.2123 visual ratio.
const SQUIRCLE_BASE_SIZE = 460.319;
const SQUIRCLE_NORMAL_SCALE = 141.316 / SQUIRCLE_BASE_SIZE;
const SQUIRCLE_RADIUS = 97.711;
// Top-edge offset from grid top (Figma 22:207 → y=78.84). Top-anchored
// rather than centred so the squircle stays put when scaling up; the
// bottom overflows past the grid and is clipped by the wrapper.
const SQUIRCLE_TOP = 78.842;
const SMOOTHING_ICON = 14;
const COMPARE_ICON = 16;

function describeState(smoothing: boolean, comparing: boolean): string {
  const smoothingPart = smoothing
    ? "Smoothing is on; the demo square uses Lisse's squircle corners."
    : "Smoothing is off; the demo square uses standard CSS quarter-circle corners.";
  if (!comparing) return smoothingPart;
  return `Comparison view active, zoomed in. ${smoothingPart}${
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
  // when an ancestor `transform: scale()` enlarges it — stair-steps at
  // the corners under the compare-mode zoom. SVG paths re-tessellate at
  // composite time, so curves stay crisp at every scale.
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

        {/* Centering + scaling wrapper laid out at COMPARE size, scaling
            DOWN to ~141×141 for normal mode (see SQUIRCLE_BASE_SIZE).
            `transform-origin: 50% 0` anchors the top edge at SQUIRCLE_TOP
            so the box grows downward into the grid (Figma 22:207). */}
        <div
          className="absolute left-1/2"
          style={{
            top: SQUIRCLE_TOP,
            width: SQUIRCLE_BASE_SIZE,
            height: SQUIRCLE_BASE_SIZE,
            transform: `translateX(-50%) scale(${comparing ? 1 : SQUIRCLE_NORMAL_SCALE})`,
            transformOrigin: "50% 0",
            transition: "transform 500ms var(--ease-out-quint)",
            willChange: "transform",
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
