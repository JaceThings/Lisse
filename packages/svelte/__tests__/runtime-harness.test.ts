// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
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

describe("Svelte adapter — runtime harness", () => {
  it("batches multiple resize entries into one rAF flush", () => {
    const node = makeNode();
    stubLayout(node);
    const action = smoothCorners(node, { corners: { radius: 16 }, autoEffects: false });
    actions.push(action);

    h_.deliverResize(node, 200, 100);
    h_.deliverResize(node, 250, 120);
    h_.deliverResize(node, 300, 140);

    expect(h_.pendingRafCount()).toBeLessThanOrEqual(1);
    h_.flushRaf();
    expect(h_.pendingRafCount()).toBe(0);
    expect(node.style.clipPath).not.toBe("");
  });

  it("updates the clip-path style when update() is called with a new radius", () => {
    const node = makeNode();
    stubLayout(node);
    const action = smoothCorners(node, { corners: { radius: 8 }, autoEffects: false });
    actions.push(action);

    h_.deliverResize(node);
    h_.flushRaf();
    const dBefore = node.style.clipPath;

    action.update({ corners: { radius: 32 }, autoEffects: false });
    const dAfter = node.style.clipPath;

    expect(dBefore).not.toBe("");
    expect(dAfter).not.toBe("");
    expect(dAfter).not.toBe(dBefore);
  });

  it("handles effects prop changes without crashing", () => {
    const node = makeNode();
    stubLayout(node);
    const action = smoothCorners(node, { corners: { radius: 12 }, autoEffects: false });
    actions.push(action);

    h_.deliverResize(node);
    h_.flushRaf();
    expect(node.style.clipPath).not.toBe("");

    expect(() =>
      action.update({
        corners: { radius: 12 },
        autoEffects: false,
        effects: { innerBorder: { width: 2, color: "#000", opacity: 1 } },
      }),
    ).not.toThrow();
    expect(node.getAttribute("data-slot")).toBe("smooth-corners");
  });

  it("releases the observer when destroy() is called", () => {
    const node = makeNode();
    stubLayout(node);
    const action = smoothCorners(node, { corners: { radius: 12 }, autoEffects: false });
    h_.deliverResize(node);
    h_.flushRaf();
    expect(h_.isObserved(node)).toBe(true);

    action.destroy();
    expect(h_.isObserved(node)).toBe(false);
  });

  it("does not double-subscribe when update() is called repeatedly", () => {
    const node = makeNode();
    stubLayout(node);
    const action = smoothCorners(node, { corners: { radius: 12 }, autoEffects: false });
    actions.push(action);

    const observersAfterMount = h_.observerCount();
    expect(observersAfterMount).toBeGreaterThanOrEqual(1);

    action.update({ corners: { radius: 16 }, autoEffects: false });
    action.update({ corners: { radius: 20 }, autoEffects: false });
    action.update({ corners: { radius: 24 }, autoEffects: false });

    expect(h_.observerCount()).toBe(observersAfterMount);
    expect(h_.isObserved(node)).toBe(true);
  });
});
