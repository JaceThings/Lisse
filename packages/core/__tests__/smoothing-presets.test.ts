import { describe, it, expect } from "vitest";
import {
  APPLE_SMOOTHING,
  FIGMA_SMOOTHING,
  DEFAULT_SMOOTHING,
  generatePath,
} from "../src/index.js";

describe("smoothing presets", () => {
  it("DEFAULT_SMOOTHING is Apple-oriented", () => {
    expect(APPLE_SMOOTHING).toBe(0.65);
    expect(FIGMA_SMOOTHING).toBe(0.6);
    expect(DEFAULT_SMOOTHING).toBe(APPLE_SMOOTHING);
  });

  it("omitted smoothing matches APPLE_SMOOTHING", () => {
    const omitted = generatePath(200, 200, { radius: 24 });
    const apple = generatePath(200, 200, { radius: 24, smoothing: APPLE_SMOOTHING });
    const figma = generatePath(200, 200, { radius: 24, smoothing: FIGMA_SMOOTHING });
    expect(omitted).toBe(apple);
    expect(omitted).not.toBe(figma);
  });
});
