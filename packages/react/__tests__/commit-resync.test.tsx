// @vitest-environment happy-dom
//
// Renders that change an element's size must re-clip at commit time, not
// wait for the resize observer — the observer delivers a frame late, which
// paints a stale clip mid-animation (flat corners on WebKit under load).
// The harness's ResizeObserver is never fired here, so any clip update can
// only have come from the commit path.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { generatePath } from "@lisse/core";
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

function readClipPathD(): string {
  const el = container.querySelector<HTMLElement>("[data-slot='smooth-corners']");
  if (!el) throw new Error("data-slot element not found");
  const m = el.style.clipPath.match(/^path\("(.*)"\)$/s);
  return m ? m[1] : "";
}

describe("commit-time re-clip (no resize observer involved)", () => {
  it("tracks a size change across re-renders without a resize delivery", () => {
    const corners = { radius: 16, smoothing: 0.6 };

    act(() => {
      root.render(<SmoothCorners as="div" autoEffects={false} corners={corners} />);
    });
    const el = container.querySelector<HTMLElement>("[data-slot='smooth-corners']")!;

    stubLayout(el, 200, 80);
    act(() => {
      root.render(<SmoothCorners as="div" autoEffects={false} corners={corners} data-tick="1" />);
    });
    expect(readClipPathD()).toBe(generatePath(200, 80, corners));

    // The animation case: the element resized, only a re-render happens.
    stubLayout(el, 300, 80);
    act(() => {
      root.render(<SmoothCorners as="div" autoEffects={false} corners={corners} data-tick="2" />);
    });
    expect(readClipPathD()).toBe(generatePath(300, 80, corners));
  });
});
