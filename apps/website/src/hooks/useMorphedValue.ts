import { useCallback, useMemo, useRef, useState } from "react";

/** One morphing value. `display` tweens from the last snapshot toward
 *  `target` as `morph` rises 0 → 1; `snapshot()` freezes the current
 *  display so the next morph starts from there. */
export function useMorphedValue<T>(
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
