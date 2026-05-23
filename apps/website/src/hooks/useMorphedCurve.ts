// Snapshot-based morph state for the math demo page. Holds the
// "currently displayed" samples + overlay as live refs, and on each
// call to `snapshotForMorph()` captures that live state as the
// animation's starting point before the curveType state change
// triggers a fresh geometry render.
//
// The key trick is that `snapshotForMorph()` must be called from the
// curve-type click handler *before* `setCurveType(...)` queues a
// re-render. By the time React's useEffect fires the refs have already
// been overwritten with the new target — too late to snapshot the
// previous frame.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { animate } from "framer-motion";
import { type CurveSamples, lerpSamples } from "../lib/curves.ts";
import { lerp, lerpOverlay, type MorphedOverlay } from "../lib/overlay.ts";

const EASE: [number, number, number, number] = [0.32, 0.72, 0, 1];

export interface MorphedCurve {
  displaySamples: CurveSamples;
  displayOverlay: MorphedOverlay;
  /** Lerped comb scale. The comb whisker length is `κ · combScale`; if
   *  the consumer used the *target* curve's combScale during the morph,
   *  whiskers would jump instantly to the new scale while their κ
   *  values were still tweening — visible as a comb snap. */
  displayCombScale: number;
  /** Call from your click handler *before* updating the underlying
   *  state that drives `targetKey` — snapshots the visible-on-screen
   *  geometry so the next morph starts from there instead of jumping. */
  snapshotForMorph: () => void;
}

/** Tracks a single value across the morph: tweens from the last-
 *  snapshotted state toward the current `target` as `morph` rises
 *  from 0 to 1. The `snapshot` callback freezes whatever's currently
 *  displayed so the next morph picks up where this one left off. */
function useMorphedValue<T>(
  target: T,
  lerpFn: (from: T, to: T, t: number) => T,
  morph: number,
): { display: T; snapshot: () => void } {
  const [snapshotValue, setSnapshotValue] = useState<T>(() => target);
  const ref = useRef<T>(target);
  const display = useMemo(
    () => (morph >= 1 ? target : lerpFn(snapshotValue, target, morph)),
    [snapshotValue, target, lerpFn, morph],
  );
  ref.current = display;
  const snapshot = useCallback(() => setSnapshotValue(ref.current), []);
  return { display, snapshot };
}

/**
 * `targetKey` is the discriminator — typically the curveType string.
 * When it changes, the hook tweens from whatever the consumer last
 * snapshotted to the new `target` over `durationMs`.
 */
export function useMorphedCurve(
  targetKey: unknown,
  target: { samples: CurveSamples; overlay: MorphedOverlay; combScale: number },
  durationMs = 450,
): MorphedCurve {
  const [morph, setMorph] = useState(1);

  const samples = useMorphedValue(target.samples, lerpSamples, morph);
  const overlay = useMorphedValue(target.overlay, lerpOverlay, morph);
  const combScale = useMorphedValue(target.combScale, lerp, morph);

  // Avoid an animation on the first mount — the initial snapshot is
  // already equal to the target.
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

