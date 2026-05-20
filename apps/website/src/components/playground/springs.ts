import { useSpringNumber } from "../../hooks/useSpringNumber.ts";

// Preview state-change tween for preset-click animations on the
// preview square — independent of slider rubber-band behaviour.
const STATE_CHANGE_DURATION = 0.35;
export const STATE_CHANGE_EASE: [number, number, number, number] = [0.32, 0.72, 0, 1];

export function useStateSpring(target: number, fromDrag: boolean) {
  return useSpringNumber(target, {
    duration: STATE_CHANGE_DURATION,
    ease: STATE_CHANGE_EASE,
    fromDrag,
  });
}

// Border knobs (thickness / dash / gap) tween even while the user is
// dragging — the slider reports integer steps, so without this short
// tween the rendered border would visibly snap from 5px → 6px → 7px on
// each step. 120ms is fast enough to feel live but smooths the jumps.
const BORDER_KNOB_DURATION = 0.12;
export function useBorderKnobSpring(target: number) {
  return useSpringNumber(target, {
    duration: BORDER_KNOB_DURATION,
    ease: STATE_CHANGE_EASE,
    fromDrag: false,
  });
}
