import { motion } from "framer-motion";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

// Spring height/opacity collapse for slider rows that aren't relevant to
// the active preset. Slider values live in the parent section so they
// survive the collapse. Children stay mounted across toggles — collapsing
// only animates the wrapper's height and opacity — so the Lisse track
// measurement and `<NumericText>` custom-element connect both run once
// at initial mount instead of every preset click. Physics mirror the
// state-change spring so the transition reads as the same beat as the
// preview animation.
const COLLAPSE_SPRING = { type: "spring" as const, stiffness: 380, damping: 38, mass: 0.9 };

export function Collapse({ show, children }: { show: boolean; children: ReactNode }) {
  const innerRef = useRef<HTMLDivElement | null>(null);
  // Natural content height, tracked via ResizeObserver so font load /
  // window resize / nested wraps re-target the open state without a
  // remount. `null` until the first sync measurement — that distinguishes
  // pre-measurement renders from a deliberate `show && height === 0`.
  const [contentHeight, setContentHeight] = useState<number | null>(null);
  // Measured at least once → safe to animate. Before this, sections that
  // initialise open jump straight to their content height instead of
  // animating from 0 on mount.
  const [measured, setMeasured] = useState(false);

  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    setContentHeight(el.offsetHeight);
    setMeasured(true);
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const next = entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height;
      setContentHeight(next);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const targetHeight = show ? (contentHeight ?? "auto") : 0;
  const targetOpacity = show ? 1 : 0;
  const targetY = show ? 0 : -4;

  return (
    <motion.div
      initial={false}
      animate={{ height: targetHeight, opacity: targetOpacity, y: targetY }}
      // Suppress the spring on the first paint so initially-open sections
      // don't animate from height 0 → content height on mount.
      transition={measured ? COLLAPSE_SPRING : { duration: 0 }}
      style={{ overflow: "hidden", width: "100%" }}
      // `inert` keeps the off-screen sliders out of the tab order and the
      // a11y tree while they remain mounted.
      inert={!show}
      aria-hidden={!show || undefined}
    >
      <div ref={innerRef}>{children}</div>
    </motion.div>
  );
}
