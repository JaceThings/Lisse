import { useEffect, useId, useRef, useState } from "react";
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

// Matches the preview-square's state-change tween in Playground.tsx so a
// preset click reads as a single beat: preview, fill bar, and readout
// settle together on the same Apple-ease curve and duration.
const PROP_CHANGE_DURATION = 0.35;
const PROP_CHANGE_EASE: [number, number, number, number] = [0.32, 0.72, 0, 1];

// NumericText handles digit transitions on the readout. Duration mirrors
// the prop-change tween so digits finish morphing as the fill bar settles.
const READOUT_TRANSITION = { duration: 300 };

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
}

const CLICK_THRESHOLD = 3;

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

const snap = (n: number, step: number) =>
  step > 0 ? Math.round(n / step) * step : n;

// Widest legal display in characters, so the readout column can reserve
// a stable width. Without this, a 2→3-digit transition (e.g. 99→100) or
// a NumericText mid-morph width fluctuation reflows the row's flex layout
// and tugs the label sideways — visible on narrow grid cells, not on
// full-width single sliders.
const reservedChars = (
  min: number,
  max: number,
  step: number,
  format?: (n: number) => string,
): number => {
  const sample = (n: number): string => {
    if (format) return format(n);
    const stepStr = String(step);
    const decimals = stepStr.includes(".") ? stepStr.split(".")[1].length : 0;
    return decimals > 0 ? n.toFixed(decimals) : String(n);
  };
  return Math.max(sample(min).length, sample(max).length);
};

const prefersReducedMotion = (): boolean =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
}: SliderProps) {
  const id = useId();
  const tuning = usePlaygroundTuning();
  const trackHeight = tuning.trackHeight;
  const trackRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const draggingRef = useRef(false);
  const propAnimRef = useRef<ReturnType<typeof animate> | null>(null);
  // Separate from `propAnimRef` so the prop-change effect's cleanup
  // doesn't kill a tap-to-jump tween that was started inside
  // `handlePointerDown`. The cleanup fires when the parent's `value`
  // updates in response to that same pointerdown — wiping the tween
  // would freeze the fill at its pre-tap position.
  const pointerAnimRef = useRef<ReturnType<typeof animate> | null>(null);
  // Distinguishes a track tap from the start of a drag. A pointerdown
  // begins as a click; the first pointermove past CLICK_THRESHOLD flips
  // it to a drag and starts feeding `applyPointer`. Until then, the
  // click-tween that started on pointerdown keeps playing.
  const pointerDownPosRef = useRef<{ x: number; y: number } | null>(null);
  const isClickRef = useRef(true);
  // Captured once on mount — double-click on the label reverts to this.
  // Subsequent prop updates (preset clicks, drags) don't touch the ref.
  const initialValueRef = useRef<number>(value);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const range = max - min;
  const safeRange = range === 0 ? 1 : range;
  const readoutMinWidth = `${reservedChars(min, max, step, format)}ch`;

  // Signed: negative when the pointer pulls past the left edge, positive
  // when it pulls past the right. The track grows by Math.abs(stretch) and
  // shifts left by `stretch` when negative, so the stretched edge always
  // tracks the cursor while the opposite edge stays pinned.
  const rubberStretchPx = useMotionValue(0);

  // Width grows by |stretch|; X shifts left by stretch when negative so the
  // right edge stays pinned during left-overflow. Width change keeps the
  // corner radius and SmoothCorners path uniform (no scaleX distortion).
  const rubberBandWidth = useTransform(
    rubberStretchPx,
    (px) => `calc(100% + ${Math.abs(px)}px)`,
  );
  const rubberBandX = useTransform(
    rubberStretchPx,
    (px) => (px < 0 ? px : 0),
  );
  // Mirrors the stretch with a thinning Y — at maxStretchPx in either
  // direction, height squashes to `compressY`. Subtle pull-thin feedback,
  // tracks the same motion value as width so they move in sync.
  const maxStretch = tuning.maxStretchPx;
  const rubberBandScaleY = useTransform(
    rubberStretchPx,
    [-maxStretch, 0, maxStretch],
    [tuning.compressY, 1, tuning.compressY],
  );

  // Stays in [min, max]: the value shown in the readout and reflected to
  // the hidden range input. Decoupled from the visible stretch so the
  // readout never displays an illegal value during rubber-band.
  const reported = useMotionValue(value);

  // Signed ranges (min < 0 < max) anchor the fill chunk at the zero
  // position and grow outward — leftward for negative values, rightward
  // for positive. Unsigned ranges keep the legacy left-anchored fill.
  // Both cases collapse into the same `leftEdge`/`rightEdge` math, so we
  // derive `fillLeft` + `fillWidth` for the absolute-positioned div.
  const isSigned = min < 0 && max > 0;
  const toPercent = (v: number) => ((v - min) / safeRange) * 100;
  // Signed sliders snap to zero within ±step/2. Treat that band as
  // exactly zero in the fill geometry so a sub-step `reported` value
  // (e.g. 0.4 with step=1) doesn't paint a sliver while the readout
  // already shows "0".
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

  // Mirror the motion value into React state so NumericText (which takes
  // a plain string prop, not a motion value) re-renders on every frame
  // of the tween and morphs its digits in step with the fill bar.
  const [displayedText, setDisplayedText] = useState(() => displayed.get());
  useMotionValueEvent(displayed, "change", setDisplayedText);

  // Tween `reported` toward the controlled prop when it changes from a
  // non-drag source (preset click, keyboard). The fill bar and readout
  // both subscribe to `reported`, so they animate together. During a
  // pointer drag, the drag itself is the source of truth — skip the
  // tween so the input stays snappy.
  useEffect(() => {
    if (draggingRef.current) return;
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
  }, [value, reported]);

  const computeRubberStretch = (clientX: number, sign: 1 | -1) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const distancePast = sign < 0 ? rect.left - clientX : clientX - rect.right;
    const overflow = Math.max(0, distancePast - tuning.deadZonePx);
    return (
      sign *
      tuning.maxStretchPx *
      Math.sqrt(Math.min(overflow / tuning.cursorRangePx, 1))
    );
  };

  const applyPointer = (cx: number) => {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    if (rect.width === 0) return;

    if (cx < rect.left) {
      rubberStretchPx.jump(computeRubberStretch(cx, -1));
    } else if (cx > rect.right) {
      rubberStretchPx.jump(computeRubberStretch(cx, 1));
    } else if (rubberStretchPx.get() !== 0) {
      rubberStretchPx.jump(0);
    }

    const ratio = clamp((cx - rect.left) / rect.width, 0, 1);
    const raw = ratio * range + min;
    const stepped = clamp(snap(raw, step), min, max);
    // Drive the fill bar from the continuous raw position so the visual
    // follows the pointer smoothly between steps. The readout's transform
    // re-applies `snap()` so the displayed number still respects step.
    // On release, the prop-tween snaps the fill bar to the legal value.
    reported.set(clamp(raw, min, max));
    if (stepped !== value) onChange(stepped, true);
  };

  const releaseStretch = () => {
    if (rubberStretchPx.get() === 0) return;
    if (prefersReducedMotion()) {
      rubberStretchPx.set(0);
      return;
    }
    animate(rubberStretchPx, 0, {
      type: "spring",
      stiffness: tuning.springStiffness,
      damping: tuning.springDamping,
      mass: tuning.springMass,
    });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    if (rect.width === 0) return;
    e.preventDefault();
    if (propAnimRef.current) {
      propAnimRef.current.stop();
      propAnimRef.current = null;
    }
    if (pointerAnimRef.current) {
      pointerAnimRef.current.stop();
      pointerAnimRef.current = null;
    }
    track.setPointerCapture(e.pointerId);
    pointerIdRef.current = e.pointerId;
    draggingRef.current = true;
    isClickRef.current = true;
    pointerDownPosRef.current = { x: e.clientX, y: e.clientY };

    // Start a tween toward the tapped position. If the user goes on to
    // drag, the move handler cancels this tween and switches to direct
    // pointer tracking. Otherwise the tween plays out as a tap-to-jump.
    const ratio = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    const raw = ratio * range + min;
    const targetValue = clamp(snap(raw, step), min, max);
    if (prefersReducedMotion()) {
      reported.set(targetValue);
    } else {
      pointerAnimRef.current = animate(reported, targetValue, {
        type: "tween",
        duration: PROP_CHANGE_DURATION,
        ease: PROP_CHANGE_EASE,
      });
    }
    if (targetValue !== value) onChange(targetValue, false);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    if (pointerIdRef.current !== e.pointerId) return;
    if (isClickRef.current) {
      const downPos = pointerDownPosRef.current;
      if (!downPos) return;
      if (Math.abs(e.clientX - downPos.x) < CLICK_THRESHOLD) return;
      // Threshold crossed — promote to a drag. Kill the click-tween so
      // `applyPointer` becomes the sole writer of `reported`.
      if (pointerAnimRef.current) {
        pointerAnimRef.current.stop();
        pointerAnimRef.current = null;
      }
      isClickRef.current = false;
    }
    applyPointer(e.clientX);
  };

  // Mirrors Build UI's `onLostPointerCapture`: the snap fires whenever the
  // browser hands pointer capture back, which covers pointerup, pointer
  // leaving the element entirely, and forced-release on the OS. Doing it
  // on pointerup alone misses the finger-flies-off-the-track case.
  const handleLostPointerCapture = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== e.pointerId) return;
    draggingRef.current = false;
    pointerIdRef.current = null;
    releaseStretch();
    // After a real drag, `reported` is the continuous raw position —
    // possibly a sub-step fraction. Tween it to the legal stepped prop
    // value so signed sliders don't leave a sliver of fill at the
    // crossover. A click already animated toward the stepped target and
    // the parent's `value` matches, so no follow-up tween is needed.
    if (!isClickRef.current) {
      if (pointerAnimRef.current) {
        pointerAnimRef.current.stop();
        pointerAnimRef.current = null;
      }
      if (prefersReducedMotion()) {
        reported.set(value);
      } else {
        pointerAnimRef.current = animate(reported, value, {
          type: "tween",
          duration: PROP_CHANGE_DURATION,
          ease: PROP_CHANGE_EASE,
        });
      }
    }
    isClickRef.current = true;
    pointerDownPosRef.current = null;
  };

  const handleKeyboardInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (draggingRef.current) return;
    const next = Number(e.currentTarget.value);
    if (next !== value) onChange(next, false);
  };

  const beginEdit = () => {
    const seed = format ? format(value) : String(value);
    setDraft(seed);
    setEditing(true);
  };

  // Focus + select once the input mounts so the user can immediately
  // overtype the current value without an extra click.
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commitEdit = () => {
    // `parseFloat` is intentionally lenient — it grabs any leading numeric
    // portion, so formatted seeds like "0.60" or "37" both round-trip even
    // if the format prop ever decorates the value with non-digit suffixes.
    const parsed = parseFloat(draft);
    if (!Number.isNaN(parsed)) {
      const stepped = clamp(snap(parsed, step), min, max);
      if (stepped !== value) onChange(stepped, false);
    }
    setEditing(false);
  };

  const cancelEdit = () => {
    setEditing(false);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitEdit();
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      cancelEdit();
      return;
    }
    const dir = e.key === "ArrowUp" || e.key === "ArrowRight" ? 1
              : e.key === "ArrowDown" || e.key === "ArrowLeft" ? -1
              : 0;
    if (dir === 0) return;
    e.preventDefault();
    const base = parseFloat(draft);
    const current = Number.isNaN(base) ? value : base;
    const delta = step * (e.shiftKey ? 10 : 1);
    const next = clamp(snap(current + dir * delta, step), min, max);
    setDraft(format ? format(next) : String(next));
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

  return (
    <div className="flex w-full flex-col gap-figma-2">
      <div className="flex w-full items-center justify-between px-[2px] text-[14px] leading-[1.2] font-medium tracking-[-0.25px]">
        <label
          htmlFor={id}
          onDoubleClick={handleLabelDoubleClick}
          className="flex-1 min-w-0 select-none text-text-input"
        >
          {label}
        </label>
        {editing ? (
          <input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            value={draft}
            onChange={(e) => setDraft(e.currentTarget.value)}
            onKeyDown={handleInputKeyDown}
            onBlur={commitEdit}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className="playground-slider-input shrink-0 text-right text-text-input"
            style={{ minWidth: readoutMinWidth }}
          />
        ) : (
          <span
            onClick={beginEdit}
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
          the `gap-figma-2` above; `pt-2` reclaims that 8px as a top
          hit extension into the gap. Total target: 8 + 8 + 16 = 32px. */}
      <div
        className="w-full touch-none select-none pt-2 pb-4 -mt-2 -mb-4"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onLostPointerCapture={handleLostPointerCapture}
      >
      <div
        ref={trackRef}
        className="relative w-full"
        style={{ height: trackHeight }}
      >
        <motion.div
          className="absolute top-0 left-0 h-full"
          style={{
            width: rubberBandWidth,
            x: rubberBandX,
            scaleY: rubberBandScaleY,
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
