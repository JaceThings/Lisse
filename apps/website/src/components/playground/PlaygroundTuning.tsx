import { createContext, useContext, type ReactNode } from "react";

export interface PlaygroundTuning {
  // Slider rubber-band stretch
  maxStretchPx: number;
  deadZonePx: number;
  cursorRangePx: number;
  compressY: number;
  // release spring
  springStiffness: number;
  springDamping: number;
  springMass: number;
  // track
  trackHeight: number;
  trackSmoothing: number;
  stepHaptic: boolean;
}

export const DEFAULT_TUNING: PlaygroundTuning = {
  maxStretchPx: 3,
  deadZonePx: 0,
  cursorRangePx: 200,
  compressY: 0.85,
  springStiffness: 400,
  springDamping: 40,
  springMass: 1,
  trackHeight: 8,
  trackSmoothing: 0.6,
  stepHaptic: false,
};

const TuningContext = createContext<PlaygroundTuning>(DEFAULT_TUNING);

export function PlaygroundTuningProvider({
  value,
  children,
}: {
  value: PlaygroundTuning;
  children: ReactNode;
}) {
  return <TuningContext.Provider value={value}>{children}</TuningContext.Provider>;
}

export function usePlaygroundTuning(): PlaygroundTuning {
  return useContext(TuningContext);
}
