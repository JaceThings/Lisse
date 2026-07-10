import { highlightSelection } from "@highlighters/core";

/** The options bag `highlightSelection` accepts, minus `undefined`. Derived
 *  from the function signature so we don't depend on a named type export. */
export type SelectionHighlightOptions = NonNullable<
  Parameters<typeof highlightSelection>[0]
>;

/** The shipped marker: brown ink (--primary-rgb) on the cream page. Nib and
 *  edge geometry tuned via the dev-only <SelectionHighlightTuner>. */
export const DEFAULT_OPTIONS: SelectionHighlightOptions = {
  color: "rgb(115, 87, 74)",
  opacity: 0.45,
  tip: {
    angle: 7,
    overshoot: 7.5,
    angleJitter: 10,
  },
};

// A minimal external store so the dev-only tuner can drive <SelectionHighlight>
// without prop-drilling through the root. In production nothing ever calls
// setHighlightOptions, so the store stays pinned to DEFAULT_OPTIONS.
let current: SelectionHighlightOptions = DEFAULT_OPTIONS;
const listeners = new Set<() => void>();

export function getHighlightOptions(): SelectionHighlightOptions {
  return current;
}

export function setHighlightOptions(next: SelectionHighlightOptions): void {
  current = next;
  for (const l of listeners) l();
}

export function subscribeHighlightOptions(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
