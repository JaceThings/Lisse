import { animate, useMotionValue, useTransform } from "framer-motion";
import { prefersReducedMotion } from "./slider-utils.ts";
import type { PlaygroundTuning } from "./PlaygroundTuning.tsx";

interface UseRubberBandOptions {
  tuning: PlaygroundTuning;
}

export function useRubberBand({ tuning }: UseRubberBandOptions) {
  // Signed: negative when the pointer pulls past the left edge, positive
  // when it pulls past the right. The track grows by Math.abs(stretch) and
  // shifts left by `stretch` when negative, so the stretched edge always
  // tracks the cursor while the opposite edge stays pinned.
  const stretchPx = useMotionValue(0);

  // Width grows by |stretch|; X shifts left by stretch when negative so the
  // right edge stays pinned during left-overflow. Width change keeps the
  // corner radius and SmoothCorners path uniform (no scaleX distortion).
  const width = useTransform(
    stretchPx,
    (px) => `calc(100% + ${Math.abs(px)}px)`,
  );
  const x = useTransform(stretchPx, (px) => (px < 0 ? px : 0));
  // Mirrors the stretch with a thinning Y — at maxStretchPx in either
  // direction, height squashes to `compressY`. Subtle pull-thin feedback,
  // tracks the same motion value as width so they move in sync.
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
