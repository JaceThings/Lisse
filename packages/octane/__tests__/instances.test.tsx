/** @jsx createElement */
// @vitest-environment happy-dom
import { act, createElement, createRoot, type Root } from "octane";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { generatePath } from "@lisse/core";
import {
  installHarness,
  uninstallHarness,
  type RuntimeHarness,
} from "../../core/__tests__/harness/runtime-harness.ts";
import { SmoothCorners } from "../src/smooth-corners.js";
import { stubLayout } from "./helpers.js";

interface Instance {
  key: string;
  corners: { radius: number };
  width: number;
  height: number;
}

const PLAIN_A: Instance = { key: "plain-a", corners: { radius: 4 }, width: 200, height: 100 };
const PLAIN_B: Instance = { key: "plain-b", corners: { radius: 28 }, width: 320, height: 140 };
const CHILD_A: Instance = { key: "child-a", corners: { radius: 12 }, width: 260, height: 180 };
const CHILD_B: Instance = { key: "child-b", corners: { radius: 40 }, width: 400, height: 220 };
const ALL = [PLAIN_A, PLAIN_B, CHILD_A, CHILD_B];

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

function nodeFor(instance: Instance): HTMLElement {
  const el = container.querySelector<HTMLElement>(`[data-k='${instance.key}']`);
  if (!el) throw new Error(`no element rendered for ${instance.key}`);
  return el;
}

function clipPathOf(instance: Instance): string {
  const match = nodeFor(instance).style.clipPath.match(/^path\("(.*)"\)$/s);
  return match ? match[1] : "";
}

function measureAll(instances: Instance[]): void {
  for (const instance of instances) stubLayout(nodeFor(instance), instance.width, instance.height);
  act(() => {
    for (const instance of instances) {
      harness.deliverResize(nodeFor(instance), instance.width, instance.height);
    }
    harness.flushRaf();
  });
}

function renderAll(): void {
  act(() =>
    root.render(
      <div>
        <SmoothCorners
          as="div"
          data-k={PLAIN_A.key}
          autoEffects={false}
          corners={PLAIN_A.corners}
        />
        <SmoothCorners
          as="div"
          data-k={PLAIN_B.key}
          autoEffects={false}
          corners={PLAIN_B.corners}
        />
        <SmoothCorners asChild autoEffects={false} corners={CHILD_A.corners}>
          <button data-k={CHILD_A.key} type="button" />
        </SmoothCorners>
        <SmoothCorners asChild autoEffects={false} corners={CHILD_B.corners}>
          <a data-k={CHILD_B.key} href="/x" />
        </SmoothCorners>
      </div>,
    ),
  );
}

describe("per-instance hook-slot isolation", () => {
  it("clips four concurrent instances to their own geometry", () => {
    renderAll();
    measureAll(ALL);

    for (const instance of ALL) {
      expect(clipPathOf(instance)).toBe(
        generatePath(instance.width, instance.height, instance.corners),
      );
      expect(nodeFor(instance).getAttribute("data-state")).toBe("ready");
    }

    // Instances sharing one path would satisfy the loop above whichever state each read.
    expect(new Set(ALL.map(clipPathOf)).size).toBe(ALL.length);
  });

  it("re-clips only the instance whose corners changed", () => {
    renderAll();
    measureAll(ALL);
    const untouched = ALL.filter((instance) => instance !== PLAIN_B).map(clipPathOf);

    act(() =>
      root.render(
        <div>
          <SmoothCorners
            as="div"
            data-k={PLAIN_A.key}
            autoEffects={false}
            corners={PLAIN_A.corners}
          />
          <SmoothCorners as="div" data-k={PLAIN_B.key} autoEffects={false} corners={{ radius: 2 }} />
          <SmoothCorners asChild autoEffects={false} corners={CHILD_A.corners}>
            <button data-k={CHILD_A.key} type="button" />
          </SmoothCorners>
          <SmoothCorners asChild autoEffects={false} corners={CHILD_B.corners}>
            <a data-k={CHILD_B.key} href="/x" />
          </SmoothCorners>
        </div>,
      ),
    );

    expect(clipPathOf(PLAIN_B)).toBe(generatePath(PLAIN_B.width, PLAIN_B.height, { radius: 2 }));
    expect(ALL.filter((instance) => instance !== PLAIN_B).map(clipPathOf)).toEqual(untouched);
  });
});
