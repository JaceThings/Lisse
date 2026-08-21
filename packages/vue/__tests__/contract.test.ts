// @vitest-environment happy-dom
//
// Contract: the Vue wrapper feeds the same inputs into core as the
// other adapters. Drift here (and not in react/svelte/octane) is a wrapper bug.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createApp, h, type App } from "vue";
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

let container: HTMLDivElement;
let h_: RuntimeHarness;
const apps: App[] = [];

beforeEach(() => {
  h_ = installHarness();
  container = document.createElement("div");
  document.body.appendChild(container);
});

afterEach(() => {
  while (apps.length > 0) apps.pop()?.unmount();
  container.remove();
  uninstallHarness();
});

function mount(render: () => unknown): void {
  const app = createApp({ render });
  app.mount(container);
  apps.push(app);
}

function stubLayout(el: HTMLElement, width: number, height: number): void {
  Object.defineProperty(el, "offsetWidth", { value: width, configurable: true });
  Object.defineProperty(el, "offsetHeight", { value: height, configurable: true });
}

function readClipPathD(): string {
  const el = container.querySelector<HTMLElement>("[data-slot='smooth-corners']");
  if (!el) throw new Error("data-slot element not found");
  const cp = el.style.clipPath;
  const m = cp.match(/^path\("(.*)"\)$/s);
  return m ? m[1] : "";
}

describe("Vue adapter contract — prop matrix", () => {
  for (const c of PROP_MATRIX) {
    it(c.name, () => {
      mount(() => h(SmoothCorners, { as: "div", autoEffects: false, corners: c.corners }));
      const inner = container.querySelector<HTMLElement>("[data-slot='smooth-corners']");
      if (!inner) throw new Error("data-slot element not found");
      stubLayout(inner, c.width, c.height);
      h_.deliverResize(inner, c.width, c.height);
      h_.flushRaf();

      const adapterPath = readClipPathD();
      const corePath = generatePath(c.width, c.height, c.corners);
      expect(adapterPath).toBe(corePath);
    });
  }
});

describe("Vue adapter contract — default autoEffects path", () => {
  it("autoEffects=true with no CSS still produces the core geometry", () => {
    mount(() => h(SmoothCorners, { as: "div", corners: { radius: 24, smoothing: 0.6, curve: "squircle" } }));
    const inner = container.querySelector<HTMLElement>("[data-slot='smooth-corners']");
    if (!inner) throw new Error("data-slot element not found");
    stubLayout(inner, 200, 100);
    h_.deliverResize(inner, 200, 100);
    h_.flushRaf();
    const adapterPath = readClipPathD();
    const corePath = generatePath(200, 100, { radius: 24, smoothing: 0.6, curve: "squircle" });
    expect(adapterPath).toBe(corePath);
  });
});

describe("Vue adapter contract — effects matrix", () => {
  for (const c of EFFECTS_MATRIX) {
    it(c.name, () => {
      mount(() =>
        h(SmoothCorners, {
          as: "div",
          autoEffects: false,
          corners: c.corners,
          innerBorder: c.effects.innerBorder,
          outerBorder: c.effects.outerBorder,
          middleBorder: c.effects.middleBorder,
          innerShadow: c.effects.innerShadow,
          shadow: c.effects.shadow,
        }),
      );
      const inner = container.querySelector<HTMLElement>("[data-slot='smooth-corners']");
      if (!inner) throw new Error("data-slot element not found");
      stubLayout(inner, c.width, c.height);
      h_.deliverResize(inner, c.width, c.height);
      h_.flushRaf();

      const adapterPath = readClipPathD();
      const corePath = generatePath(c.width, c.height, c.corners);
      expect(adapterPath).toBe(corePath);

      const overlaySvg = container.querySelector("svg");
      expect(overlaySvg).not.toBeNull();
    });
  }
});
