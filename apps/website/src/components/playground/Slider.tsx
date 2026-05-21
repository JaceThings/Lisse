import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useTransform,
} from "framer-motion";
import NumericText from "@numeric-text/react";
import { SmoothCorners } from "@lisse/react";
import { usePlaygroundTuning } from "./PlaygroundTuning.tsx";
import {
  PROP_CHANGE_DURATION,
  PROP_CHANGE_EASE,
  READOUT_TRANSITION,
  clamp,
  prefersReducedMotion,
  reservedChars,
  snap,
} from "./slider-utils.ts";
import { useEditableValue } from "./useEditableValue.ts";
import { usePointerDrag } from "./usePointerDrag.ts";
import { useRubberBand } from "./useRubberBand.ts";

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  /** `fromDrag` is true only for continuous pointer-drag updates. Tap-to-jump,
   *  keyboard, double-click revert, and typed input all report `false` so the
   *  consumer animates the value change. */
  onChange: (next: number, fromDrag?: boolean) => void;
  /** Optional display formatter — e.g. `(v) => v.toFixed(2)` for smoothing. */
  format?: (value: number) => string;
  /** Optional seed formatter for the editable input. Used when `format`
   *  produces a decorated string the input shouldn't seed with (e.g. an
   *  "iOS – 0.60" annotation). Falls back to `format`. */
  formatSeed?: (value: number) => string;
  /** Extra values fed through `format` when computing the readout's
   *  reserved column width, so special-case formatted strings (wider than
   *  the endpoints) still fit without reflow. */
  formatSamples?: readonly number[];
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
  formatSeed,
  formatSamples,
}: SliderProps) {
  const id = useId();
  const tuning = usePlaygroundTuning();
  const trackHeight = tuning.trackHeight;
  const trackRef = useRef<HTMLDivElement | null>(null);
  const propAnimRef = useRef<ReturnType<typeof animate> | null>(null);
  // Captured once on mount — double-click on the label reverts to this.
  // Subsequent prop updates (presets, drags) don't touch the ref.
  const initialValueRef = useRef<number>(value);

  const range = max - min;
  const safeRange = range === 0 ? 1 : range;
  // Memoised: `reservedChars` calls `format()` to measure the widest legal
  // display — recompute only when its inputs change, not on every drag tick.
  const readoutMinWidth = useMemo(
    () => `${reservedChars(min, max, step, format, formatSamples)}ch`,
    [min, max, step, format, formatSamples],
  );

  const rubberBand = useRubberBand({ tuning });

  // Stays in [min, max]: the value shown in the readout and reflected to
  // the hidden range input. Decoupled from the visible stretch so the
  // readout never displays an illegal value during rubber-band.
  const reported = useMotionValue(value);

  // Signed ranges (min < 0 < max) anchor the fill chunk at zero and grow
  // outward. Unsigned ranges stay left-anchored. Both fall out of the same
  // `leftEdge`/`rightEdge` math.
  const isSigned = min < 0 && max > 0;
  const toPercent = (v: number) => ((v - min) / safeRange) * 100;
  // Treat the ±step/2 band around zero as exactly zero in fill geometry so
  // a sub-step `reported` value (e.g. 0.4 with step=1) doesn't paint a
  // sliver while the readout already shows "0".
  const fillLeft = useTransform(reported, (v) => {
    const clamped = clamp(v, min, max);
    if (isSigned && Math.abs(clamped) < step / 2) {
      return `${toPercent(0)}%`;
    }
    const leftEdge = isSigned ? Math.min(0, clamped) : min;
    return `${toPercent(leftEdge)}%`;
  });
  const fillWidth = useTransform(reported, (v) => {
    const clamped = clamp(v, min, max);
    if (isSigned && Math.abs(clamped) < step / 2) return "0%";
    const leftEdge = isSigned ? Math.min(0, clamped) : min;
    const rightEdge = isSigned ? Math.max(0, clamped) : clamped;
    return `${((rightEdge - leftEdge) / safeRange) * 100}%`;
  });

  const displayed = useTransform(reported, (v) => {
    const stepped = clamp(snap(v, step), min, max);
    return format ? format(stepped) : String(stepped);
  });

  // Mirror the motion value into React state — NumericText takes a plain
  // string prop, so it needs a re-render on every tween frame to morph its
  // digits in step with the fill bar.
  const [displayedText, setDisplayedText] = useState(() => displayed.get());
  useMotionValueEvent(displayed, "change", setDisplayedText);

  const drag = usePointerDrag({
    trackRef,
    value,
    min,
    max,
    step,
    onChange,
    reported,
    rubberBand,
    stopPropAnim: () => {
      if (propAnimRef.current) {
        propAnimRef.current.stop();
        propAnimRef.current = null;
      }
    },
  });

  // Tween `reported` toward the controlled prop on non-drag changes
  // (preset, keyboard). During a pointer drag the drag is the source of
  // truth — skip the tween so the input stays snappy.
  useEffect(() => {
    if (drag.isDraggingRef.current) return;
    if (propAnimRef.current) propAnimRef.current.stop();
    if (prefersReducedMotion()) {
      reported.set(value);
      return;
    }
    propAnimRef.current = animate(reported, value, {
      type: "tween",
      duration: PROP_CHANGE_DURATION,
      ease: PROP_CHANGE_EASE,
    });
    return () => {
      propAnimRef.current?.stop();
      propAnimRef.current = null;
    };
  }, [value, reported, drag.isDraggingRef]);

  const handleKeyboardInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (drag.isDraggingRef.current) return;
    const next = Number(e.currentTarget.value);
    if (next !== value) onChange(next, false);
  };

  // Shift + Arrow on the hidden native range jumps 10×step. Plain arrows
  // fall through to the browser's default ±step behaviour.
  const handleRangeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!e.shiftKey) return;
    const dir = e.key === "ArrowRight" || e.key === "ArrowUp" ? 1
              : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -1
              : 0;
    if (dir === 0) return;
    e.preventDefault();
    const next = clamp(snap(value + dir * step * 10, step), min, max);
    if (next !== value) onChange(next, false);
  };

  const handleLabelDoubleClick = () => {
    if (initialValueRef.current !== value) onChange(initialValueRef.current, false);
  };

  const editable = useEditableValue({ value, min, max, step, format, formatSeed, onChange });

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex w-full items-center justify-between px-[2px] text-[14px] leading-[1.2] font-medium tracking-[-0.25px]">
        <label
          htmlFor={id}
          onDoubleClick={handleLabelDoubleClick}
          className="flex-1 min-w-0 select-none text-text-input"
        >
          {label}
        </label>
        {editable.editing ? (
          <input
            ref={editable.inputRef}
            type="text"
            inputMode="decimal"
            value={editable.draft}
            onChange={(e) => editable.setDraft(e.currentTarget.value)}
            onKeyDown={editable.handleInputKeyDown}
            onBlur={editable.commitEdit}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className="playground-slider-input shrink-0 text-right text-text-input"
            style={{ minWidth: readoutMinWidth }}
          />
        ) : (
          <span
            onClick={editable.beginEdit}
            className="playground-slider-value inline-flex shrink-0 select-none justify-end whitespace-nowrap text-[rgba(126,117,108,0.5)]"
            style={{ minWidth: readoutMinWidth }}
          >
            <NumericText value={displayedText} transition={READOUT_TRANSITION} />
          </span>
        )}
      </div>
      {/* Hit-area band. Asymmetric padding so the band's painted top
          sits at the label's bottom edge (no overlap onto the label's
          double-click target) while still extending the bottom hit
          area into the row's padding below. `-mt-2` exactly cancels
          the `gap-2` above; `pt-2` reclaims that 8px as a top
          hit extension into the gap. Total target: 8 + 8 + 16 = 32px. */}
      <div
        className="w-full touch-none select-none pt-2 pb-4 -mt-2 -mb-4"
        onPointerDown={drag.onPointerDown}
        onPointerMove={drag.onPointerMove}
        onLostPointerCapture={drag.onLostPointerCapture}
      >
        <div
          ref={trackRef}
          className="relative w-full"
          style={{ height: trackHeight }}
        >
          <motion.div
            className="absolute top-0 left-0 h-full"
            style={{
              width: rubberBand.width,
              x: rubberBand.x,
              scaleY: rubberBand.scaleY,
            }}
          >
            <SmoothCorners
              asChild
              autoEffects={false}
              corners={{ radius: trackHeight / 2, smoothing: tuning.trackSmoothing }}
            >
              <div
                className="relative h-full w-full overflow-hidden bg-[rgba(126,117,108,0.12)]"
                aria-hidden
              >
                <motion.div
                  className="absolute top-0 h-full bg-[#7e756c]"
                  style={{ left: fillLeft, width: fillWidth }}
                />
              </div>
            </SmoothCorners>
          </motion.div>
          {/* Hidden native range stays as the keyboard + screen-reader path.
              Pointer events are disabled so it never steals drags from the
              elastic handler. It remains focusable via Tab and still
              receives arrow-key input. */}
          <input
            id={id}
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={handleKeyboardInput}
            onKeyDown={handleRangeKeyDown}
            data-focus-ring
            className="playground-slider absolute inset-0 h-full w-full pointer-events-none appearance-none bg-transparent"
          />
        </div>
      </div>
    </div>
  );
}
