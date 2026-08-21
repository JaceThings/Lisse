/** @jsx createElement */
// @vitest-environment happy-dom
//
// Contract: the Octane wrapper feeds the same inputs into core as the other
// adapters.
import { act, createElement, createRoot, type Root } from "octane";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { generatePath } from "@lisse/core";
import { EFFECTS_MATRIX, PROP_MATRIX } from "../../core/__fixtures__/contract.ts";
import {
  installHarness,
  uninstallHarness,
  type RuntimeHarness,
} from "../../core/__tests__/harness/runtime-harness.ts";
import { SmoothCorners } from "../src/smooth-corners.js";
import { readClipPathD, stubLayout } from "./helpers.js";

let container: HTMLDivElement;
let root: Root;
let harness: RuntimeHarness;

beforeEach(() => {
  harness = installHarness();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  uninstallHarness();
});

describe("Octane adapter contract — prop matrix", () => {
  for (const c of PROP_MATRIX) {
    it(c.name, () => {
      act(() => {
        root.render(<SmoothCorners as="div" autoEffects={false} corners={c.corners} />);
      });
      const inner = container.querySelector<HTMLElement>("[data-slot='smooth-corners']");
      if (!inner) throw new Error("data-slot element not found");
      stubLayout(inner, c.width, c.height);

      act(() => {
        harness.deliverResize(inner, c.width, c.height);
        harness.flushRaf();
      });

      expect(readClipPathD(container)).toBe(generatePath(c.width, c.height, c.corners));
    });
  }
});

describe("Octane adapter contract — default autoEffects path", () => {
  it("autoEffects=true with no CSS still produces the core geometry", () => {
    const corners = { radius: 24, smoothing: 0.6, curve: "squircle" as const };
    act(() => {
      root.render(<SmoothCorners as="div" corners={corners} />);
    });
    const inner = container.querySelector<HTMLElement>("[data-slot='smooth-corners']");
    if (!inner) throw new Error("data-slot element not found");
    stubLayout(inner, 200, 100);
    act(() => {
      harness.deliverResize(inner, 200, 100);
      harness.flushRaf();
    });
    expect(readClipPathD(container)).toBe(generatePath(200, 100, corners));
  });
});

describe("Octane adapter contract — effects matrix", () => {
  for (const c of EFFECTS_MATRIX) {
    it(c.name, () => {
      act(() => {
        root.render(
          <SmoothCorners
            as="div"
            autoEffects={false}
            corners={c.corners}
            innerBorder={c.effects.innerBorder}
            outerBorder={c.effects.outerBorder}
            middleBorder={c.effects.middleBorder}
            innerShadow={c.effects.innerShadow}
            shadow={c.effects.shadow}
          />,
        );
      });
      const inner = container.querySelector<HTMLElement>("[data-slot='smooth-corners']");
      if (!inner) throw new Error("data-slot element not found");
      stubLayout(inner, c.width, c.height);

      act(() => {
        harness.deliverResize(inner, c.width, c.height);
        harness.flushRaf();
      });

      expect(readClipPathD(container)).toBe(generatePath(c.width, c.height, c.corners));
      expect(container.querySelector("svg")).not.toBeNull();
    });
  }
});
