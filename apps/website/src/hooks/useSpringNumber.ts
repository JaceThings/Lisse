import { useEffect, useRef, useState } from "react";
import { animate, useMotionValue, useMotionValueEvent } from "framer-motion";

export interface SpringNumberOptions {
  duration: number;
  ease: [number, number, number, number];
  /** When true, the target was produced by a continuous input (drag) and
   *  should bypass the tween — the input is already smooth, and stacking
   *  another animation on top would lag the preview behind the user. */
  fromDrag?: boolean;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

/**
 * Drive a plain `number` toward `target` with a Motion tween. The hook
 * keeps the live value on a motion value internally (no per-frame React
 * re-render storm), then mirrors the latest value into React state so
 * consumers can pass it to props that expect numeric primitives — e.g.
 * Lisse's `SmoothCorners` accepts plain numbers, not motion values.
 *
 * Discrete changes (preset clicks) tween smoothly with a non-bouncy
 * easing curve; drag-driven changes snap so the input remains the source
 * of truth during interaction.
 */
export function useSpringNumber(
  target: number,
  { duration, ease, fromDrag = false }: SpringNumberOptions,
): number {
  const mv = useMotionValue(target);
  const [value, setValue] = useState(target);
  const fromDragRef = useRef(fromDrag);
  fromDragRef.current = fromDrag;

  useMotionValueEvent(mv, "change", (latest) => setValue(latest));

  // Destructure ease into primitives so a fresh `[a,b,c,d]` literal on the
  // caller side doesn't retrigger this effect every render and restart the
  // tween mid-flight.
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
