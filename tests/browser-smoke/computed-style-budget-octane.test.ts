// Browser smoke: Octane's per-element `getComputedStyle` budget at mount and at
// idle. `./computed-style-counter.ts` carries the instrument and the reasoning
// behind the budget.
//
// Octane's adapter has React's shape rather than Vue's or Svelte's — a mount
// layout effect plus a sync that reruns on every commit — so it carries React's
// risk of measuring for itself on a commit that already had a size to reuse.
// The numbers here are the React file's numbers; a divergence is a wrapper bug.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { act, createElement, createRoot, type Root } from "octane";
import { SmoothCorners } from "@lisse/octane";
import { MOUNT_BUDGET, delay, installCounter, settle } from "./computed-style-counter.js";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  container.style.cssText = "position:relative;width:600px;";
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

/**
 * The React file's shape: one bordered card (auto-extracted CSS border, so it
 * mounts an SVG overlay) wrapping a row of small effect-free dots.
 * `autoEffects: false` on the dots removes their extraction read.
 */
function Page(props: { dots: number; autoEffects?: boolean }): unknown {
  const { dots, autoEffects = true } = props;
  const items = [];
  for (let i = 0; i < dots; i++) {
    items.push(
      createElement(SmoothCorners, {
        key: String(i),
        as: "div",
        "data-dot": String(i),
        corners: { radius: 6, smoothing: 0.6 },
        autoEffects,
        style: { width: "12px", height: "12px", background: "#888" },
      }),
    );
  }
  return createElement(
    "div",
    { style: { position: "relative", padding: "8px" } },
    createElement(
      SmoothCorners,
      {
        as: "div",
        "data-card": "1",
        corners: { radius: 16, smoothing: 0.6 },
        style: {
          display: "flex",
          gap: "6px",
          width: "100%",
          padding: "12px",
          border: "1px solid rgb(0, 0, 0)",
          background: "#fff",
        },
      },
      items,
    ),
  );
}

/**
 * Every squircle on the page, asserted to have actually clipped. Without this
 * a sync that bailed early would take no reads at all and sail through the
 * budget — the metric would be measuring an absence.
 */
function clippedSquircles(expectedCount: number): HTMLElement[] {
  const squircles = [...container.querySelectorAll<HTMLElement>("[data-slot='smooth-corners']")];
  expect(squircles).toHaveLength(expectedCount);
  expect(
    squircles.filter((el) => el.dataset.state !== "ready" || !el.style.clipPath.startsWith("path(")),
  ).toEqual([]);
  return squircles;
}

describe("Browser smoke — computed-style budget (octane)", () => {
  it("mounts within the per-element read budget", async () => {
    const counter = installCounter();
    try {
      root.render(createElement(Page, { dots: 4 }));
      await settle();

      const perElement = clippedSquircles(5).map((el) => ({
        label: el.dataset.card ? "card" : `dot-${el.dataset.dot}`,
        reads: counter.count(el),
      }));

      // Asserted as a list of offenders so the failure diff carries the counts.
      expect(perElement.filter((r) => r.reads > MOUNT_BUDGET || r.reads < 1)).toEqual([]);
    } finally {
      counter.restore();
    }
  }, 30_000);

  it("stays within budget with auto-extraction off", async () => {
    const counter = installCounter();
    try {
      root.render(createElement(Page, { dots: 4, autoEffects: false }));
      await settle();

      const dots = clippedSquircles(5).filter((el) => el.dataset.dot !== undefined);
      expect(dots).toHaveLength(4);
      // Still 2, but a different pair: with no extraction to thread a size out
      // of, the every-commit sync measures for itself so the clip-path lands
      // before the first paint, and the flush takes its own live read.
      expect(dots.map((el) => counter.count(el))).toEqual([2, 2, 2, 2]);
    } finally {
      counter.restore();
    }
  }, 30_000);

  it("issues no reads while idle after settling", async () => {
    const counter = installCounter();
    try {
      root.render(createElement(Page, { dots: 4 }));
      await settle();
      clippedSquircles(5);
      counter.reset();
      await delay(500);

      const ranked = counter.ranked();
      expect(ranked.map((r) => `${r.el.tagName}=${r.reads}`).join(" ")).toBe("");
    } finally {
      counter.restore();
    }
  }, 30_000);
});
