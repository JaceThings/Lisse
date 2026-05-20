import { motion } from "framer-motion";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { IS_SAFARI } from "./is-safari.ts";

// Safari path: measured `max-height` transition over a numeric pixel
// value (no `auto` resolution) plus opacity. `contain: paint` bounds
// the dirty rect so the cascade through nested Sliders' SmoothCorners
// can't invalidate ancestors. `content-visibility: hidden` (in the
// closed state) tells Safari it can skip layout + paint for the entire
// subtree until it's needed — by far the largest remaining win.
const COLLAPSE_SPRING = { type: "spring" as const, stiffness: 380, damping: 38, mass: 0.9 };
const SAFARI_DURATION_MS = 240;
const SAFARI_TRANSITION =
  `max-height ${SAFARI_DURATION_MS}ms cubic-bezier(0.32, 0.72, 0, 1), ` +
  `opacity ${SAFARI_DURATION_MS}ms cubic-bezier(0.32, 0.72, 0, 1)`;

export function Collapse({ show, children }: { show: boolean; children: ReactNode }) {
  if (IS_SAFARI) return <SafariCollapse show={show}>{children}</SafariCollapse>;
  return <MotionCollapse show={show}>{children}</MotionCollapse>;
}

function SafariCollapse({ show, children }: { show: boolean; children: ReactNode }) {
  const innerRef = useRef<HTMLDivElement | null>(null);
  const [contentHeight, setContentHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    setContentHeight(el.offsetHeight);
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const next = entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height;
      setContentHeight(next);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Before the first measurement, render at auto height without animation
  // so sections that initialise open don't pop from 0 → content height.
  const maxHeight = contentHeight === null
    ? (show ? "none" : "0px")
    : `${show ? contentHeight : 0}px`;

  return (
    <div
      style={{
        maxHeight,
        opacity: show ? 1 : 0,
        overflow: "hidden",
        transition: contentHeight === null ? "none" : SAFARI_TRANSITION,
        width: "100%",
        // Bound paint to this box so the cascade through nested
        // SmoothCorners tracks can't dirty ancestor regions.
        contain: "paint",
        willChange: "opacity",
      }}
      inert={!show}
      aria-hidden={!show || undefined}
    >
      <div ref={innerRef}>{children}</div>
    </div>
  );
}

function MotionCollapse({ show, children }: { show: boolean; children: ReactNode }) {
  const innerRef = useRef<HTMLDivElement | null>(null);
  // Natural content height, tracked so font load / window resize / nested
  // wraps re-target without a remount. `null` until first sync measurement
  // distinguishes pre-measurement renders from a deliberate height of 0.
  const [contentHeight, setContentHeight] = useState<number | null>(null);
  // Sections that initialise open jump straight to their content height
  // instead of animating from 0 on mount.
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
      transition={measured ? COLLAPSE_SPRING : { duration: 0 }}
      style={{ overflow: "hidden", width: "100%" }}
      inert={!show}
      aria-hidden={!show || undefined}
    >
      <div ref={innerRef}>{children}</div>
    </motion.div>
  );
}
