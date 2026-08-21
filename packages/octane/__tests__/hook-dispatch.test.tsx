/** @jsx createElement */
// @vitest-environment happy-dom
// Octane's compiler appends the hook slot as the LAST argument, so it can arrive
// where the effects options would otherwise sit.
import { act, createElement, createRoot, useRef, type Root } from "octane";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { generatePath } from "@lisse/core";
import {
  installHarness,
  uninstallHarness,
  type RuntimeHarness,
} from "../../core/__tests__/harness/runtime-harness.ts";
import { useSmoothCorners } from "../src/use-smooth-corners.js";
import { readClipPathD, stubLayout } from "./helpers.js";

type RefObject<T> = { current: T };

const SLOT_ONLY = Symbol("@lisse/octane:test:slot-only");
const SLOT_WITH_EFFECTS = Symbol("@lisse/octane:test:slot-with-effects");

const CORNERS = { radius: 16, smoothing: 0.6 };

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

function SlotOnly() {
  const ref = useRef<HTMLDivElement | null>(null, Symbol.for("@lisse/octane:test:ref-slot-only"));
  useSmoothCorners(ref as RefObject<HTMLElement | null>, CORNERS, SLOT_ONLY);
  return <div ref={ref} />;
}

function SlotWithEffects() {
  const ref = useRef<HTMLDivElement | null>(null, Symbol.for("@lisse/octane:test:ref-with-effects"));
  useSmoothCorners(
    ref as RefObject<HTMLElement | null>,
    CORNERS,
    { autoEffects: false },
    SLOT_WITH_EFFECTS,
  );
  return <div ref={ref} />;
}

function landClipPath(width: number, height: number): HTMLElement {
  const el = container.querySelector<HTMLElement>("[data-slot='smooth-corners']")!;
  stubLayout(el, width, height);
  act(() => harness.deliverResize(el, width, height));
  harness.flushRaf();
  return el;
}

describe("hook slot dispatch", () => {
  it("clips when the slot arrives in place of the effects options", () => {
    act(() => root.render(<SlotOnly />));
    const el = landClipPath(200, 100);

    expect(readClipPathD(container)).toBe(generatePath(200, 100, CORNERS));
    expect(el.getAttribute("data-state")).toBe("ready");
  });

  it("clips when the slot follows the effects options", () => {
    act(() => root.render(<SlotWithEffects />));
    const el = landClipPath(240, 120);

    expect(readClipPathD(container)).toBe(generatePath(240, 120, CORNERS));
    expect(el.getAttribute("data-state")).toBe("ready");
  });
});
