import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { generatePath } from "@lisse/core";
import { GridBackground } from "./GridBackground.tsx";
import { TogglePill } from "./TogglePill.tsx";
import { useStaggerEntrance } from "./Stagger.tsx";
import { useTweenedNumber } from "../hooks/useTweenedNumber.ts";
import {
  CheckIcon,
  OverlayFilledIcon,
  OverlayOutlineIcon,
  XMarkIcon,
} from "../icons/sf/index.tsx";
import {
  playCompareEnter,
  playCompareExit,
  playSmoothingEnter,
  playSmoothingExit,
} from "../lib/sounds.ts";
import { m } from "../paraglide/messages.js";

const SQUIRCLE_SMOOTHING = 0.6;
// Path generated once at the desktop max (510 px); the wrapper sizes
// itself to the current mode and the SVG fills it via `width/height=100%`.
// Safari rasterises an SVG at its CSS box size, so resizing the wrapper
// triggers a fresh raster at the right resolution — no ancestor
// `transform: scale()` to upsample a stale bitmap. Radius preserves the
// Figma 30/141.316 ≈ 0.2123 squircle character.
const SQUIRCLE_BASE_SIZE = 510;
const SQUIRCLE_RADIUS = SQUIRCLE_BASE_SIZE * (97.711 / 460.319);
const SQUIRCLE_NORMAL_SIZE = 141.316;
// Compare mode has two regimes, matching the article column's 560 px
// breakpoint (fluid `calc(100vw - 32px)` ↔ fixed 510):
//   • < 560: fills `100cqi - 40px` so top-left/right clear the grid
//     mask's side feather; bottom overflows and is clipped by the mask.
//   • >= 560: pinned to the Figma 22:207 baseline (460 px) so the demo
//     doesn't grow into the surrounding whitespace.
const SQUIRCLE_COMPARE_INSET = 20;
const SQUIRCLE_COMPARE_DESKTOP_SIZE = 460.319;
const SQUIRCLE_COMPARE_MOBILE_SIZE = `calc(100cqi - ${SQUIRCLE_COMPARE_INSET * 2}px)`;
// Top-anchored rather than centred so the squircle stays put when the
// size changes (Figma 22:207 → y=78.84).
const SQUIRCLE_TOP = 78.842;
const SMOOTHING_ICON = 14;
const COMPARE_ICON = 16;

function describeState(smoothing: boolean, comparing: boolean): string {
  const smoothingPart = smoothing
    ? m.demo_state_smoothing_on()
    : m.demo_state_smoothing_off();
  if (!comparing) return smoothingPart;
  return `${m.demo_state_compare_active()} ${smoothingPart}${
    smoothing
      ? ` ${m.demo_state_compare_smoothing_on()}`
      : ` ${m.demo_state_compare_smoothing_off()}`
  }`;
}

// The masked grid wrapper is the slow part on cold loads: `mask-image`
// pulls /grid-mask.svg and the inner GridBackground tiles /grid.svg
// (~17 KB combined). Until both land, the masked region paints empty
// — so the cascade fade would otherwise reveal a blank rectangle and
// the content would pop in unceremoniously when the SVGs arrive. Gate
// the section's entrance on the actual asset readiness; on fast loads
// they're cached/already inflight and `loaded` flips before the
// cascade slot even arrives, so the fade still rides the schedule.
const DEMO_ASSETS = ["/grid-mask.svg", "/grid.svg"];

function useImagesLoaded(urls: readonly string[]) {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let pending = urls.length;
    let cancelled = false;
    const done = () => {
      if (cancelled) return;
      if (--pending === 0) setLoaded(true);
    };
    for (const url of urls) {
      const img = new Image();
      img.onload = done;
      img.onerror = done;
      img.src = url;
      // Already in the HTTP cache or decoded — fire synchronously so we
      // don't wait on a load event that will never come.
      if (img.complete) done();
    }
    return () => {
      cancelled = true;
    };
    // urls is a module-level constant; intentionally empty deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return loaded;
}

interface DemoProps {
  /** Cascade slot for the demo's entrance fade. */
  staggerIndex: number;
}

export function Demo({ staggerIndex }: DemoProps) {
  const assetsLoaded = useImagesLoaded(DEMO_ASSETS);
  const entrance = useStaggerEntrance({ index: staggerIndex, ready: assetsLoaded });

  const [smoothing, setSmoothing] = useState(true);
  const [comparing, setComparing] = useState(true);
  const toggleSmoothing = () => {
    if (smoothing) playSmoothingExit();
    else playSmoothingEnter();
    setSmoothing((s) => !s);
  };
  const toggleCompare = () => {
    if (comparing) playCompareExit();
    else playCompareEnter();
    setComparing((c) => !c);
  };

  // Tween smoothing rather than letting Lisse snap, so the corners
  // visibly morph between the Apple squircle and the CSS quarter-circle.
  const smoothingActive = useTweenedNumber(
    smoothing ? SQUIRCLE_SMOOTHING : 0,
    { duration: 500 },
  );

  // Inline <svg><path> rather than divs with `clip-path: path()`. Safari
  // rasterises CSS clip-path once at layout size and re-uses that bitmap
  // on resize — stair-steps as the wrapper grows. SVG paths re-tessellate
  // at composite time, so curves stay crisp at every size.
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
    <motion.section
      {...entrance}
      className="relative isolate w-full"
      style={{ height: "var(--grid-height)" }}
      aria-labelledby="demo-heading"
    >
      <h2 id="demo-heading" className="sr-only">
        {m.demo_heading()}
      </h2>

      {/* Masked layer holding both grid and squircle. Extends 10px past
          the column on x to match Figma `Mask` (530×299 @ x=-10); the
          /grid-mask.svg feathers both contents out at the edges. */}
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

        {/* Centering wrapper. Mode-dependent size — see SQUIRCLE_*
            constants. The SVG fills it at 100%×100% so Safari rasters
            at the current layout size (no transform-scale upsampling). */}
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
          {/* Compare-mode back: red square at smoothing 0. As smoothing
              rises, the front pulls in past the back's corners and red
              shows at the four gaps. */}
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
        className="absolute left-1/2 flex -translate-x-1/2 items-center gap-4"
        // Empirical 0.25 CSS px nudge to land the pills on an integer
        // device-pixel Y (2× Retina) so Safari's SVG drop-shadow raster
        // lands clean — otherwise the column's natural flow puts them
        // on a fractional device-pixel that toggles WebKit's shadow bias.
        style={{ top: "30.25px" }}
        data-focus-section="pills"
      >
        <TogglePill
          pressed={smoothing}
          onToggle={toggleSmoothing}
          ariaLabel={smoothing ? m.demo_smoothing_disable() : m.demo_smoothing_enable()}
          toneClass={smoothing ? "text-accent-green" : "text-accent-red"}
          iconSize={SMOOTHING_ICON}
          pressedIcon={<CheckIcon width={SMOOTHING_ICON} height={SMOOTHING_ICON} />}
          unpressedIcon={<XMarkIcon width={SMOOTHING_ICON} height={SMOOTHING_ICON} />}
          label={smoothing ? m.demo_smoothing_label_on() : m.demo_smoothing_label_off()}
        />

        <TogglePill
          pressed={comparing}
          onToggle={toggleCompare}
          ariaLabel={comparing ? m.demo_compare_exit() : m.demo_compare_enter()}
          toneClass="text-text-input"
          iconSize={COMPARE_ICON}
          pressedIcon={<OverlayFilledIcon width={COMPARE_ICON} height={COMPARE_ICON} />}
          unpressedIcon={<OverlayOutlineIcon width={COMPARE_ICON} height={COMPARE_ICON} />}
          label={m.demo_compare_label()}
        />
      </div>
    </motion.section>
  );
}
