import { useRef, type RefObject } from "react";
import { animate, type MotionValue } from "framer-motion";
import {
  CLICK_THRESHOLD,
  PROP_CHANGE_DURATION,
  PROP_CHANGE_EASE,
  clamp,
  prefersReducedMotion,
  snap,
} from "./slider-utils.ts";

interface RubberBandApi {
  updateStretch: (clientX: number, rect: DOMRect) => void;
  releaseStretch: () => void;
}

interface UsePointerDragOptions {
  trackRef: RefObject<HTMLDivElement | null>;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (next: number, fromDrag?: boolean) => void;
  reported: MotionValue<number>;
  rubberBand: RubberBandApi;
  /** Stops any in-flight prop-change tween before the pointer takes over.
   *  Owned by the parent so its prop-change effect stays the sole writer
   *  of that tween's ref. */
  stopPropAnim: () => void;
}

export function usePointerDrag({
  trackRef,
  value,
  min,
  max,
  step,
  onChange,
  reported,
  rubberBand,
  stopPropAnim,
}: UsePointerDragOptions) {
  const pointerIdRef = useRef<number | null>(null);
  const draggingRef = useRef(false);
  // Separate from the parent's prop-change tween ref so the prop-change
  // effect's cleanup doesn't kill a tap-to-jump tween that was started
  // inside `onPointerDown`. The cleanup fires when the parent's `value`
  // updates in response to that same pointerdown — wiping the tween
  // would freeze the fill at its pre-tap position.
  const pointerAnimRef = useRef<ReturnType<typeof animate> | null>(null);
  // Distinguishes a track tap from the start of a drag. A pointerdown
  // begins as a click; the first pointermove past CLICK_THRESHOLD flips
  // it to a drag and starts feeding `applyPointer`. Until then, the
  // click-tween that started on pointerdown keeps playing.
  const pointerDownPosRef = useRef<{ x: number; y: number } | null>(null);
  const isClickRef = useRef(true);

  const range = max - min;

  const applyPointer = (cx: number) => {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    if (rect.width === 0) return;

    rubberBand.updateStretch(cx, rect);

    const ratio = clamp((cx - rect.left) / rect.width, 0, 1);
    const raw = ratio * range + min;
    const stepped = clamp(snap(raw, step), min, max);
    // Drive the fill bar from the continuous raw position so the visual
    // follows the pointer between steps; the readout's transform re-applies
    // `snap()`. On release, the prop-tween snaps the fill to the legal value.
    reported.set(clamp(raw, min, max));
    if (stepped !== value) onChange(stepped, true);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    if (rect.width === 0) return;
    e.preventDefault();
    stopPropAnim();
    if (pointerAnimRef.current) {
      pointerAnimRef.current.stop();
      pointerAnimRef.current = null;
    }
    track.setPointerCapture(e.pointerId);
    pointerIdRef.current = e.pointerId;
    draggingRef.current = true;
    isClickRef.current = true;
    pointerDownPosRef.current = { x: e.clientX, y: e.clientY };

    // Tween toward the tapped position. If the user drags, the move handler
    // cancels this tween and switches to direct pointer tracking; otherwise
    // it plays out as a tap-to-jump.
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

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
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
  const onLostPointerCapture = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== e.pointerId) return;
    draggingRef.current = false;
    pointerIdRef.current = null;
    rubberBand.releaseStretch();
    // After a real drag, `reported` may hold a sub-step fraction. Tween it
    // to the stepped prop value so signed sliders don't leave a sliver of
    // fill at the crossover. A click already animated toward the stepped
    // target, so no follow-up tween is needed.
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

  return {
    isDraggingRef: draggingRef,
    onPointerDown,
    onPointerMove,
    onLostPointerCapture,
  };
}
