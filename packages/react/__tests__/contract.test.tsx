// @vitest-environment happy-dom
//
// Adapter contract: the React wrapper feeds the same props, defaults,
// dimensions, and effects into core as the other adapters. Drift in
// this file (and not in vue / svelte) means the React wrapper is doing
// something different — that's a contract bug to investigate.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { generatePath } from "@lisse/core";
import {
  PROP_MATRIX,
  EFFECTS_MATRIX,
} from "../../core/__fixtures__/contract.ts";
import {
  installHarness,
  uninstallHarness,
  type RuntimeHarness,
} from "../../core/__tests__/harness/runtime-harness.ts";
import { SmoothCorners } from "../src/smooth-corners.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let h_: RuntimeHarness;

beforeEach(() => {
  h_ = installHarness();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  uninstallHarness();
});

function stubLayout(el: HTMLElement, width: number, height: number): void {
  Object.defineProperty(el, "offsetWidth", { value: width, configurable: true });
  Object.defineProperty(el, "offsetHeight", { value: height, configurable: true });
}

/**
 * Read the inline `clip-path` style on the rendered element. The hook
 * sets it as `path("...")`; unwrap the path string for direct compare
 * against core's `generatePath` output.
 */
function readClipPathD(): string {
  const el = container.querySelector<HTMLElement>("[data-slot='smooth-corners']");
  if (!el) throw new Error("data-slot element not found");
  const cp = el.style.clipPath;
  const m = cp.match(/^path\("(.*)"\)$/s);
  return m ? m[1] : "";
}

describe("React adapter contract — prop matrix", () => {
  for (const c of PROP_MATRIX) {
    it(c.name, () => {
      act(() => {
        root.render(<SmoothCorners as="div" autoEffects={false} corners={c.corners} />);
      });
      const inner = container.querySelector<HTMLElement>("[data-slot='smooth-corners']");
      if (!inner) throw new Error("data-slot element not found");
      stubLayout(inner, c.width, c.height);

      act(() => {
        h_.deliverResize(inner, c.width, c.height);
        h_.flushRaf();
      });

      const adapterPath = readClipPathD();
      const corePath = generatePath(c.width, c.height, c.corners);
      expect(adapterPath).toBe(corePath);
    });
  }
});

describe("React adapter contract — default autoEffects path", () => {
  // Most contract cases pin `autoEffects: false` so geometry is tested
  // in isolation from the CSS extraction path. This single case
  // exercises the default (true) so any adapter-specific bug in the
  // extract-strip-restore flow shows up here.
  it("autoEffects=true with no CSS still produces the core geometry", () => {
    act(() => {
      root.render(
        <SmoothCorners as="div" corners={{ radius: 24, smoothing: 0.6, curve: "squircle" }} />,
      );
    });
    const inner = container.querySelector<HTMLElement>("[data-slot='smooth-corners']");
    if (!inner) throw new Error("data-slot element not found");
    stubLayout(inner, 200, 100);
    act(() => {
      h_.deliverResize(inner, 200, 100);
      h_.flushRaf();
    });
    const adapterPath = readClipPathD();
    const corePath = generatePath(200, 100, { radius: 24, smoothing: 0.6, curve: "squircle" });
    expect(adapterPath).toBe(corePath);
  });
});

describe("React adapter contract — effects matrix", () => {
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
        h_.deliverResize(inner, c.width, c.height);
        h_.flushRaf();
      });

      // Geometry contract holds even with effects in play.
      const adapterPath = readClipPathD();
      const corePath = generatePath(c.width, c.height, c.corners);
      expect(adapterPath).toBe(corePath);

      // Effects overlay was attached: at least one SVG element is in the
      // overlay anchor. (We don't compare overlay HTML byte-for-byte
      // because adapters mount it differently — the geometry check is
      // the contract surface.)
      const overlaySvg = container.querySelector("svg");
      expect(overlaySvg).not.toBeNull();
    });
  }
});
