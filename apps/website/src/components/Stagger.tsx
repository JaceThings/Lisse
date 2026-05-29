import { motion, type MotionProps } from "framer-motion";
import { useMemo, useRef, type ReactNode } from "react";

interface StaggerProps {
  /** Stagger slot — child entrance is delayed by `index × STEP` seconds. */
  index: number;
  children: ReactNode;
}

// Items rack in from out-of-focus to crisp while fading in. No Y
// translation — the cascade reads as "coming into focus" rather than
// rising into place.
const ENTRANCE_BLUR_PX = 4;

// Anchor for cascade timing. Captured once at module load so later
// navigations see targets already in the past and the skip-gate fires.
const APP_MOUNT_MS = performance.now();

// Skip only fires after first paint; without this guard a slow bundle
// parse would push `now` past targetMs for early indices and suppress
// the cascade entirely. Double-rAF lands on the frame after first paint.
let hasFirstPainted = false;
// SSR guard: requestAnimationFrame is undefined on Node and this runs at module
// import. On the server hasFirstPainted stays false (matching the client's
// first render), so the cascade plays after hydration.
if (typeof requestAnimationFrame !== "undefined") {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      hasFirstPainted = true;
    });
  });
}

// 0.35s pause then 0.08s steps × 0.7s per item — a body of 8 items
// spans ~1.3s, slow enough to read as a cascade. Softer ease than the
// site's snappier [0.32, 0.72, 0, 1] so the movement registers across
// the full span instead of finishing 70% in the first 150ms.
const INITIAL_DELAY = 0.35;
const STEP = 0.08;
const DURATION = 0.7;
const EASE: [number, number, number, number] = [0.22, 0.61, 0.36, 1];

interface UseStaggerEntranceOptions {
  /** Stagger slot — same semantics as `<Stagger index>`. */
  index: number;
  /** Hold the entrance at the initial (blurred, faded) state until this
   * flips true. Use to gate the cascade on async readiness — e.g. a
   * heavy section that needs its critical assets to be loaded before it
   * fades in, so a slow network doesn't pop content into a container
   * that has already faded itself in empty. Defaults to true. */
  ready?: boolean;
}

type EntranceMotionProps = Pick<MotionProps, "initial" | "animate" | "transition">;

/**
 * Computes the motion props for a cascade entrance. Pull out into a hook so
 * sections that need to drive their own root element (rather than a wrapper
 * `<div>`) can apply the same entrance while gating it on extra conditions
 * via the `ready` flag.
 */
export function useStaggerEntrance({
  index,
  ready = true,
}: UseStaggerEntranceOptions): EntranceMotionProps {
  // Lock readiness at mount: a late-arriving asset (ready: false → true)
  // must still play a fresh fade rather than tripping the slot-passed
  // shortcut, which exists only to make cross-route remounts instant.
  const wasReadyAtMount = useRef(ready).current;

  const { skip, delay } = useMemo(() => {
    const targetMs = APP_MOUNT_MS + (INITIAL_DELAY + index * STEP) * 1000;
    const now = performance.now();
    return {
      skip: hasFirstPainted && targetMs <= now && wasReadyAtMount,
      delay: Math.max(0, (targetMs - now) / 1000),
    };
  }, [index, wasReadyAtMount, ready]);

  const initial = skip
    ? (false as const)
    : { opacity: 0, filter: `blur(${ENTRANCE_BLUR_PX}px)` };
  const animate = ready
    ? { opacity: 1, filter: "blur(0px)" }
    : { opacity: 0, filter: `blur(${ENTRANCE_BLUR_PX}px)` };
  const transition = skip
    ? { duration: 0 }
    : { duration: DURATION, ease: EASE, delay };

  return { initial, animate, transition };
}

export function Stagger({ index, children }: StaggerProps) {
  const props = useStaggerEntrance({ index });
  return <motion.div {...props}>{children}</motion.div>;
}
