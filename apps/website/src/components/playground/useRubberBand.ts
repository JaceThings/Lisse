import { animate, useMotionValue, useTransform } from "../../lib/motion.ts";
import { prefersReducedMotion } from "./slider-utils.ts";
import { DEFAULT_TUNING as tuning } from "./PlaygroundTuning.tsx";

export function useRubberBand() {
  const stretchPx = useMotionValue(0);

  const width = useTransform(
    stretchPx,
    (px) => `calc(100% + ${Math.abs(px)}px)`,
  );
  const x = useTransform(stretchPx, (px) => (px < 0 ? px : 0));
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
