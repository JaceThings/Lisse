/** @jsx createElement */
// @vitest-environment happy-dom
//
// A size change must re-clip at commit time, without waiting for the resize
// observer's next frame.
import { act, createElement, createRoot, type Root } from "octane";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { generatePath } from "@lisse/core";
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

describe("commit-time re-clip (no resize observer involved)", () => {
  it("tracks a size change across re-renders without a resize delivery", () => {
    const corners = { radius: 16, smoothing: 0.6 };

    act(() => {
      root.render(<SmoothCorners as="div" autoEffects={false} corners={corners} />);
    });
    const el = container.querySelector<HTMLElement>("[data-slot='smooth-corners']")!;

    stubLayout(el, 200, 80);
    act(() => {
      root.render(
        <SmoothCorners as="div" autoEffects={false} corners={corners} data-tick="1" />,
      );
    });
    expect(readClipPathD(container)).toBe(generatePath(200, 80, corners));

    stubLayout(el, 300, 80);
    act(() => {
      root.render(
        <SmoothCorners as="div" autoEffects={false} corners={corners} data-tick="2" />,
      );
    });
    expect(readClipPathD(container)).toBe(generatePath(300, 80, corners));
  });
});
