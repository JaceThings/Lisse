import { useEffect, useState } from "react";

/**
 * Drive a numeric value toward a target over a fixed duration via rAF.
 * Used to morph the demo square's Lisse `smoothing` between the Apple
 * squircle (0.6) and CSS quarter-circle (0) — Lisse re-runs
 * `generateClipPath` on every options change, so a tweened smoothing
 * yields a per-frame clip-path interpolation.
 *
 * Interruptible: clicking mid-tween picks up from the current animated
 * value (cleanup cancels the in-flight rAF; the next effect captures
 * the latest in-render value as `startValue`). Respects
 * `prefers-reduced-motion: reduce` by snapping to target.
 */

export interface UseTweenedNumberOptions {
  duration?: number;
  easing?: (t: number) => number;
}

const DEFAULT_DURATION = 500;
const easeOutQuart = (t: number): number => 1 - Math.pow(1 - t, 4);

const prefersReducedMotion = (): boolean =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

export function useTweenedNumber(
  target: number,
  { duration = DEFAULT_DURATION, easing = easeOutQuart }: UseTweenedNumberOptions = {},
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
    // Tweens are keyed on target (and duration), not per-frame value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]);

  return value;
}
