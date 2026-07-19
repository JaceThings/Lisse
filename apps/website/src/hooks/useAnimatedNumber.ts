import { useEffect, useRef, useState } from "react";
import { animate, useMotionValue, useMotionValueEvent } from "../lib/motion.ts";

export interface SpringNumberOptions {
  duration: number;
  ease: [number, number, number, number];
  /** When true, the target was produced by a continuous input (drag) and
   *  should bypass the tween — the input is already smooth, and stacking
   *  another animation on top would lag the preview behind the user. */
  fromDrag?: boolean;
}

export interface UseTweenedNumberOptions {
  duration?: number;
  easing?: (t: number) => number;
}

const DEFAULT_TWEEN_DURATION_MS = 500;
const easeOutQuart = (t: number): number => 1 - Math.pow(1 - t, 4);

const prefersReducedMotion = (): boolean =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

/**
 * Drive a plain `number` toward `target` with a tween. The hook
 * keeps the live value on a motion value internally (no per-frame React
 * re-render storm), then mirrors the latest value into React state so
 * consumers can pass it to props that expect numeric primitives.
 */
export function useSpringNumber(
  target: number,
  { duration, ease, fromDrag = false }: SpringNumberOptions,
): number {
  const mv = useMotionValue(target);
  const [value, setValue] = useState(target);
  const fromDragRef = useRef(fromDrag);
  fromDragRef.current = fromDrag;

  useMotionValueEvent(mv, "change", setValue);

  const [e0, e1, e2, e3] = ease;
  useEffect(() => {
    if (fromDragRef.current || prefersReducedMotion()) {
      mv.set(target);
      return;
    }
    const controls = animate(mv, target, {
      type: "tween",
      duration,
      ease: [e0, e1, e2, e3],
    });
    return () => controls.stop();
  }, [target, duration, e0, e1, e2, e3, mv]);

  return value;
}

/**
 * Drive a numeric value toward a target over a fixed duration via rAF.
 * Interruptible: a mid-tween target change picks up from the current value.
 */
export function useTweenedNumber(
  target: number,
  { duration = DEFAULT_TWEEN_DURATION_MS, easing = easeOutQuart }: UseTweenedNumberOptions = {},
): number {
  const [value, setValue] = useState(target);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setValue(target);
      return;
    }

    const startValue = value;
    const delta = target - startValue;

    if (Math.abs(delta) < 1e-4) {
      if (value !== target) setValue(target);
      return;
    }

    let rafId = 0;
    const startTime = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      setValue(startValue + delta * easing(t));
      if (t < 1) rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]);

  return value;
}
