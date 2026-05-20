import { motion } from "framer-motion";
import { useMemo, type ReactNode } from "react";

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
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    hasFirstPainted = true;
  });
});

// 0.35s pause then 0.08s steps × 0.7s per item — a body of 8 items
// spans ~1.3s, slow enough to read as a cascade. Softer ease than the
// site's snappier [0.32, 0.72, 0, 1] so the movement registers across
// the full span instead of finishing 70% in the first 150ms.
const INITIAL_DELAY = 0.35;
const STEP = 0.08;
const DURATION = 0.7;
const EASE: [number, number, number, number] = [0.22, 0.61, 0.36, 1];

export function Stagger({ index, children }: StaggerProps) {
  // Computed once at mount; mid-cascade re-renders mustn't re-read the
  // clock or framer-motion would snap in-flight items to final state.
  const { skip, delay } = useMemo(() => {
    const targetMs = APP_MOUNT_MS + (INITIAL_DELAY + index * STEP) * 1000;
    const now = performance.now();
    return {
      skip: hasFirstPainted && targetMs <= now,
      delay: Math.max(0, (targetMs - now) / 1000),
    };
  }, [index]);

  return (
    <motion.div
      initial={
        skip
          ? false
          : { opacity: 0, filter: `blur(${ENTRANCE_BLUR_PX}px)` }
      }
      animate={{ opacity: 1, filter: "blur(0px)" }}
      transition={
        skip ? { duration: 0 } : { duration: DURATION, ease: EASE, delay }
      }
    >
      {children}
    </motion.div>
  );
}
