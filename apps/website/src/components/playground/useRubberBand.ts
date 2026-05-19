import { animate, useMotionValue, useTransform } from "framer-motion";
import { prefersReducedMotion } from "./slider-utils.ts";
import type { PlaygroundTuning } from "./PlaygroundTuning.tsx";

interface UseRubberBandOptions {
  tuning: PlaygroundTuning;
}

export function useRubberBand({ tuning }: UseRubberBandOptions) {
  // Signed: negative when the pointer pulls past the left edge, positive
  // past the right. Width grows by |stretch|; X shifts left by stretch when
  // negative so the opposite edge stays pinned. Width change (not scaleX)
  // keeps the corner radius and SmoothCorners path uniform.
  const stretchPx = useMotionValue(0);

  const width = useTransform(
    stretchPx,
    (px) => `calc(100% + ${Math.abs(px)}px)`,
  );
  const x = useTransform(stretchPx, (px) => (px < 0 ? px : 0));
  // At maxStretchPx in either direction, height squashes to `compressY` —
  // a subtle pull-thin that tracks the same motion value as width.
  const maxStretch = tuning.maxStretchPx;
  const scaleY = useTransform(
    stretchPx,
    [-maxStretch, 0, maxStretch],
    [tuning.compressY, 1, tuning.compressY],
  );

  const computeStretch = (clientX: number, rect: DOMRect, sign: 1 | -1) => {
    const distancePast = sign < 0 ? rect.left - clientX : clientX - rect.right;
    const overflow = Math.max(0, distancePast - tuning.deadZonePx);
    return (
      sign *
      tuning.maxStretchPx *
      Math.sqrt(Math.min(overflow / tuning.cursorRangePx, 1))
    );
  };

  const updateStretch = (clientX: number, rect: DOMRect) => {
    if (clientX < rect.left) {
      stretchPx.jump(computeStretch(clientX, rect, -1));
    } else if (clientX > rect.right) {
      stretchPx.jump(computeStretch(clientX, rect, 1));
    } else if (stretchPx.get() !== 0) {
      stretchPx.jump(0);
    }
  };

  const releaseStretch = () => {
    if (stretchPx.get() === 0) return;
    if (prefersReducedMotion()) {
      stretchPx.set(0);
      return;
    }
    animate(stretchPx, 0, {
      type: "spring",
      stiffness: tuning.springStiffness,
      damping: tuning.springDamping,
      mass: tuning.springMass,
    });
  };

  return {
    width,
    x,
    scaleY,
    updateStretch,
    releaseStretch,
  };
}
