import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cssEase } from "../lib/motion.ts";

interface StaggerProps {
  /** Stagger slot — child entrance is delayed by `index × STEP` seconds. */
  index: number;
  children: ReactNode;
}

const ENTRANCE_BLUR_PX = 4;
const APP_MOUNT_MS = performance.now();

let hasFirstPainted = false;
if (typeof requestAnimationFrame !== "undefined") {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      hasFirstPainted = true;
    });
  });
}

const INITIAL_DELAY = 0.35;
const STEP = 0.08;
const DURATION = 0.7;
const EASE: [number, number, number, number] = [0.22, 0.61, 0.36, 1];

interface UseStaggerEntranceOptions {
  index: number;
  ready?: boolean;
}

export interface StaggerEntranceStyle {
  style: CSSProperties;
}

export function useStaggerEntrance({
  index,
  ready = true,
}: UseStaggerEntranceOptions): StaggerEntranceStyle {
  const wasReadyAtMount = useRef(ready).current;

  const { skip, delay } = useMemo(() => {
    const targetMs = APP_MOUNT_MS + (INITIAL_DELAY + index * STEP) * 1000;
    const now = performance.now();
    return {
      skip: hasFirstPainted && targetMs <= now && wasReadyAtMount,
      delay: Math.max(0, (targetMs - now) / 1000),
    };
  }, [index, wasReadyAtMount, ready]);

  const [visible, setVisible] = useState(skip && ready);

  useEffect(() => {
    if (skip) {
      setVisible(ready);
      return;
    }
    if (!ready) {
      setVisible(false);
      return;
    }
    const timeout = window.setTimeout(() => setVisible(true), delay * 1000);
    return () => window.clearTimeout(timeout);
  }, [skip, ready, delay]);

  return {
    style: skip
      ? {}
      : {
          opacity: visible ? 1 : 0,
          filter: visible ? "blur(0px)" : `blur(${ENTRANCE_BLUR_PX}px)`,
          transition: `opacity ${DURATION}s ${cssEase(EASE)}, filter ${DURATION}s ${cssEase(EASE)}`,
        },
  };
}

export function Stagger({ index, children }: StaggerProps) {
  const { style } = useStaggerEntrance({ index });
  return <div style={style}>{children}</div>;
}
