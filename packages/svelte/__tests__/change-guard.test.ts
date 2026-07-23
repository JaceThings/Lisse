// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
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

function makeNode(): HTMLElement {
  const node = document.createElement("div");
  container.appendChild(node);
  return node;
}

function stubLayout(el: HTMLElement, width = 200, height = 100): void {
  Object.defineProperty(el, "offsetWidth", { value: width, configurable: true });
  Object.defineProperty(el, "offsetHeight", { value: height, configurable: true });
}

// Each regeneration writes data-state=ready, so spying on that setAttribute
// call gives an exact regeneration count.
function countReadyWrites(node: HTMLElement): () => number {
  const spy = vi.spyOn(node, "setAttribute");
  return () =>
    spy.mock.calls.filter((c) => c[0] === "data-state" && c[1] === "ready").length;
}

describe("smoothCorners action — change guard", () => {
  it("no-op update() with an equivalent-but-new config does zero regenerations", () => {
    const node = makeNode();
    stubLayout(node);
    const action = smoothCorners(node, {
      corners: { radius: 16, smoothing: 0.6 },
      autoEffects: false,
    });
    actions.push(action);

    h_.deliverResize(node);
    h_.flushRaf();

    const readyWrites = countReadyWrites(node);
    const clipAfterMount = node.style.clipPath;
    expect(clipAfterMount).not.toBe("");

    for (let i = 0; i < 5; i++) {
      action.update({ corners: { radius: 16, smoothing: 0.6 }, autoEffects: false });
    }
    h_.deliverResize(node, 200, 100);
    h_.flushRaf();

    expect(readyWrites()).toBe(0);
    expect(node.style.clipPath).toBe(clipAfterMount);
  });

  it("a real option change performs exactly one regeneration", () => {
    const node = makeNode();
    stubLayout(node);
    const action = smoothCorners(node, {
      corners: { radius: 16, smoothing: 0.6 },
      autoEffects: false,
    });
    actions.push(action);

    h_.deliverResize(node);
    h_.flushRaf();

    const readyWrites = countReadyWrites(node);
    const before = node.style.clipPath;

    action.update({ corners: { radius: 32, smoothing: 0.6 }, autoEffects: false });

    expect(readyWrites()).toBe(1);
    expect(node.style.clipPath).not.toBe(before);

    action.update({ corners: { radius: 32, smoothing: 0.6 }, autoEffects: false });
    expect(readyWrites()).toBe(1);
  });

  it("a real size change performs exactly one regeneration", () => {
    const node = makeNode();
    stubLayout(node, 200, 100);
    const action = smoothCorners(node, { corners: { radius: 16 }, autoEffects: false });
    actions.push(action);

    h_.deliverResize(node, 200, 100);
    h_.flushRaf();

    const readyWrites = countReadyWrites(node);

    stubLayout(node, 300, 140);
    h_.deliverResize(node, 300, 140);
    h_.flushRaf();

    expect(readyWrites()).toBe(1);
  });

  it("a real effects change performs exactly one regeneration", () => {
    const node = makeNode();
    stubLayout(node);
    const action = smoothCorners(node, { corners: { radius: 16 }, autoEffects: false });
    actions.push(action);

    h_.deliverResize(node);
    h_.flushRaf();

    const readyWrites = countReadyWrites(node);

    action.update({
      corners: { radius: 16 },
      autoEffects: false,
      effects: { innerBorder: { width: 2, color: "#000", opacity: 1 } },
    });
    expect(readyWrites()).toBe(1);

    action.update({
      corners: { radius: 16 },
      autoEffects: false,
      effects: { innerBorder: { width: 2, color: "#000", opacity: 1 } },
    });
    expect(readyWrites()).toBe(1);
  });

  it("resize ticks reuse the stored key and never re-serialize the config", () => {
    const node = makeNode();
    stubLayout(node);
    // Hold the exact config object references so we can tell OUR serialization
    // (JSON.stringify called on these) apart from happy-dom's internal
    // style-write serialization.
    const corners = { radius: 16 };
    const action = smoothCorners(node, { corners, autoEffects: false });
    actions.push(action);

    h_.deliverResize(node);
    h_.flushRaf();

    // Drive several real-size resize ticks. The serialized options/effects key
    // is computed at init/update, not on every tick, so the config objects must
    // never be re-serialized in the resize path even though each tick
    // regenerates the clip.
    const spy = vi.spyOn(JSON, "stringify");
    const configSerializations = () =>
      spy.mock.calls.filter((c) => c[0] === corners || c[0] === null).length;

    for (let i = 1; i <= 5; i++) {
      stubLayout(node, 200 + i * 10, 100);
      h_.deliverResize(node, 200 + i * 10, 100);
      h_.flushRaf();
    }
    expect(configSerializations()).toBe(0);

    // A config change, by contrast, recomputes the stored key from the new
    // config object.
    const corners2 = { radius: 32 };
    action.update({ corners: corners2, autoEffects: false });
    expect(spy.mock.calls.filter((c) => c[0] === corners2).length).toBeGreaterThan(0);
    spy.mockRestore();
  });

  it("toggling autoEffects invalidates the guard and regenerates once", () => {
    const node = makeNode();
    node.style.border = "2px solid rgb(255, 0, 0)";
    stubLayout(node);
    const action = smoothCorners(node, { corners: { radius: 16 }, autoEffects: true });
    actions.push(action);

    h_.deliverResize(node);
    h_.flushRaf();

    const readyWrites = countReadyWrites(node);

    action.update({ corners: { radius: 16 }, autoEffects: false });
    expect(readyWrites()).toBe(1);
  });
});
