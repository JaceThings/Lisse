import { motion } from "framer-motion";
import { useMemo, type ReactNode } from "react";

interface StaggerProps {
  /** Stagger slot — child entrance is delayed by `index × STEP` seconds. */
  index: number;
  children: ReactNode;
}

// Entrance blur. Items rack in from 4px out-of-focus to crisp while
// fading opacity simultaneously. No Y translation — the cascade reads
// as items "coming into focus" rather than rising into place, which
// matches the rest of the site's preference for spatial calm.
const ENTRANCE_BLUR_PX = 4;

// App-mount timestamp captured once at module load. Every Stagger
// schedules against this anchor, so on first paint the cascade plays
// (targets are in the future); on later navigations those targets are
// in the past and the skip-gate below makes the items render at their
// final state with no entrance.
const APP_MOUNT_MS =
  typeof performance !== "undefined" ? performance.now() : 0;

// Tracks whether the app has produced its first paint. The skip-when-past
// gate uses this so that on first app load every Stagger animates, even
// if bundle parse and React mount pushed `performance.now()` past some
// early targetMs values. Without this guard a slow first paint would
// suppress the body cascade entirely. Double-rAF is the standard "next
// frame after the first painted frame" trick.
let hasFirstPainted = false;
if (typeof requestAnimationFrame !== "undefined") {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      hasFirstPainted = true;
    });
  });
}

// Tuned for visibility: a 0.35s pause after page paint before anything
// moves makes the cascade feel intentional. 0.08s steps + 0.7s per item
// means a body of 8 items spans ~1.3s — slow enough to read as a cascade.
// The ease is a softer in-out than the rest of the site's snappier
// [0.32, 0.72, 0, 1] curve, so the movement registers across the whole
// duration instead of finishing 70% in the first 150ms.
const INITIAL_DELAY = 0.35;
const STEP = 0.08;
const DURATION = 0.7;
const EASE: [number, number, number, number] = [0.22, 0.61, 0.36, 1];

export function Stagger({ index, children }: StaggerProps) {
  // Compute skip + delay exactly once, at mount. If a parent re-renders
  // mid-cascade (e.g., a sibling state change), we don't want a fresh
  // `performance.now()` reading to flip skip true on items that were
  // already animating — framer-motion would interpret the new transition
  // and snap them to their final state.
  const { skip, delay } = useMemo(() => {
    const targetMs = APP_MOUNT_MS + (INITIAL_DELAY + index * STEP) * 1000;
    const now = typeof performance !== "undefined" ? performance.now() : 0;
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
