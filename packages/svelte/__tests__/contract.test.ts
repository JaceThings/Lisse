// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
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
import { smoothCorners, type SmoothCornersAction } from "../src/smooth-corners.js";

let container: HTMLDivElement;
let h_: RuntimeHarness;
const actions: SmoothCornersAction[] = [];

beforeEach(() => {
  h_ = installHarness();
  container = document.createElement("div");
  container.style.position = "relative";
  document.body.appendChild(container);
});

afterEach(() => {
  while (actions.length > 0) actions.pop()?.destroy();
  container.remove();
  uninstallHarness();
});

function stubLayout(el: HTMLElement, width: number, height: number): void {
  Object.defineProperty(el, "offsetWidth", { value: width, configurable: true });
  Object.defineProperty(el, "offsetHeight", { value: height, configurable: true });
}

function readClipPathD(node: HTMLElement): string {
  const cp = node.style.clipPath;
  const m = cp.match(/^path\("(.*)"\)$/s);
  return m ? m[1] : "";
}

describe("Svelte adapter contract — prop matrix", () => {
  for (const c of PROP_MATRIX) {
    it(c.name, () => {
      const node = document.createElement("div");
      container.appendChild(node);
      stubLayout(node, c.width, c.height);

      const action = smoothCorners(node, { corners: c.corners, autoEffects: false });
      actions.push(action);
      h_.deliverResize(node, c.width, c.height);
      h_.flushRaf();

      const adapterPath = readClipPathD(node);
      const corePath = generatePath(c.width, c.height, c.corners);
      expect(adapterPath).toBe(corePath);
    });
  }
});

describe("Svelte adapter contract — default autoEffects path", () => {
  it("autoEffects=true with no CSS still produces the core geometry", () => {
    const node = document.createElement("div");
    container.appendChild(node);
    stubLayout(node, 200, 100);
    const action = smoothCorners(node, { corners: { radius: 24, smoothing: 0.6, curve: "squircle" } });
    actions.push(action);
    h_.deliverResize(node, 200, 100);
    h_.flushRaf();
    const adapterPath = readClipPathD(node);
    const corePath = generatePath(200, 100, { radius: 24, smoothing: 0.6, curve: "squircle" });
    expect(adapterPath).toBe(corePath);
  });
});

describe("Svelte adapter contract — effects matrix", () => {
  for (const c of EFFECTS_MATRIX) {
    it(c.name, () => {
      const node = document.createElement("div");
      container.appendChild(node);
      stubLayout(node, c.width, c.height);

      const action = smoothCorners(node, {
        corners: c.corners,
        autoEffects: false,
        effects: c.effects,
      });
      actions.push(action);
      h_.deliverResize(node, c.width, c.height);
      h_.flushRaf();

      const adapterPath = readClipPathD(node);
      const corePath = generatePath(c.width, c.height, c.corners);
      expect(adapterPath).toBe(corePath);

      const overlaySvg = container.querySelector("svg");
      expect(overlaySvg).not.toBeNull();
    });
  }
});
