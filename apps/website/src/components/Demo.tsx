import { useEffect, useMemo, useState } from "react";
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
import { generatePath } from "@lisse/core";

const SQUIRCLE_SMOOTHING = 0.6;
const SQUIRCLE_BASE_SIZE = 510;
const SQUIRCLE_RADIUS = SQUIRCLE_BASE_SIZE * (97.711 / 460.319);
const SQUIRCLE_NORMAL_SIZE = 141.316;
const SQUIRCLE_COMPARE_INSET = 20;
const SQUIRCLE_COMPARE_DESKTOP_SIZE = 460.319;
const SQUIRCLE_COMPARE_MOBILE_SIZE = `calc(100cqi - ${SQUIRCLE_COMPARE_INSET * 2}px)`;
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
      if (img.complete) done();
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return loaded;
}

interface DemoProps {
  staggerIndex: number;
}

export function Demo({ staggerIndex }: DemoProps) {
  const assetsLoaded = useImagesLoaded(DEMO_ASSETS);
  const { style: entranceStyle } = useStaggerEntrance({ index: staggerIndex, ready: assetsLoaded });

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

  const smoothingActive = useTweenedNumber(
    smoothing ? SQUIRCLE_SMOOTHING : 0,
    { duration: 500 },
  );

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
      style={{ height: "var(--grid-height)", ...entranceStyle }}
      aria-labelledby="demo-heading"
      data-highlight-exclude
    >
      <h2 id="demo-heading" className="sr-only">
        {m.demo_heading()}
      </h2>

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
    </section>
  );
}
