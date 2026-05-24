// Snapshot-based morph state for the math demo page. `snapshotForMorph`
// freezes the currently displayed geometry as the animation's start;
// callers must invoke it from the click handler *before* `setCurveType`
// queues a re-render — once React fires the next effect the refs have
// already been overwritten with the new target.

import { useCallback, useEffect, useRef, useState } from "react";
import { animate } from "framer-motion";
import { type CurveSamples, lerpSamples } from "../lib/curves.ts";
import { lerp, lerpOverlay, type MorphedOverlay } from "../lib/overlay.ts";
import { useMorphedValue } from "./useMorphedValue.ts";

const EASE: [number, number, number, number] = [0.32, 0.72, 0, 1];

export interface MorphedCurve {
  displaySamples: CurveSamples;
  displayOverlay: MorphedOverlay;
  /** Lerped comb scale. Whisker length is `κ · combScale`, so without
   *  this the κ values would tween while the scale snapped — visible
   *  as a comb jump. */
  displayCombScale: number;
  /** Call from the curve-type click handler before the state update
   *  that drives `targetKey` — see file header. */
  snapshotForMorph: () => void;
}

/** `targetKey` (typically the curveType) is the morph discriminator —
 *  on change, the hook tweens from the last snapshot to `target` over
 *  `durationMs`. */
export function useMorphedCurve(
  targetKey: unknown,
  target: { samples: CurveSamples; overlay: MorphedOverlay; combScale: number },
  durationMs = 450,
): MorphedCurve {
  const [morph, setMorph] = useState(1);

  const samples = useMorphedValue(target.samples, lerpSamples, morph);
  const overlay = useMorphedValue(target.overlay, lerpOverlay, morph);
  const combScale = useMorphedValue(target.combScale, lerp, morph);

  // Skip the first mount — snapshot already equals target.
  const lastKeyRef = useRef<unknown>(targetKey);

  useEffect(() => {
    if (lastKeyRef.current === targetKey) return;
    lastKeyRef.current = targetKey;
    const controls = animate(0, 1, {
      type: "tween",
      duration: durationMs / 1000,
      ease: EASE,
      onUpdate: (v) => setMorph(v),
      onComplete: () => setMorph(1),
    });
    return () => controls.stop();
  }, [targetKey, durationMs]);

  const snapshotForMorph = useCallback(() => {
    samples.snapshot();
    overlay.snapshot();
    combScale.snapshot();
    setMorph(0);
  }, [samples, overlay, combScale]);

  return {
    displaySamples: samples.display,
    displayOverlay: overlay.display,
    displayCombScale: combScale.display,
    snapshotForMorph,
  };
}

