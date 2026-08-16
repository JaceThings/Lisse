// Browser smoke: per-element `getComputedStyle` budget at mount and at idle.
//
// Every computed-style read is a style/layout flush point. Mounting a page of
// squircles interleaves reads with the writes each squircle makes (clip-path,
// border strip, overlay placement), so N redundant reads cost N extra recalcs
// of the whole document — the cost profiles as self time inside Lisse.
//
// happy-dom has no layout, so this budget can only be pinned in a real engine.
// The counter keys on the element identity `getComputedStyle` was handed, which
// is what the reporter's DevTools counting did.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { StrictMode, createElement } from "react";
import { SmoothCorners } from "@lisse/react";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  container.style.cssText = "position:relative;width:600px;";
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  root.unmount();
  container.remove();
});

interface Counter {
  /** Reads charged to `el` since `install`. */
  count(el: Element): number;
  /** Every counted element, most-read first. */
  ranked(): Array<{ el: Element; reads: number }>;
  reset(): void;
  restore(): void;
}

function installCounter(): Counter {
  const counts = new Map<Element, number>();
  const original = window.getComputedStyle;
  window.getComputedStyle = function patched(
    el: Element,
    pseudo?: string | null,
  ): CSSStyleDeclaration {
    counts.set(el, (counts.get(el) ?? 0) + 1);
    return original.call(window, el, pseudo);
  } as typeof window.getComputedStyle;

  return {
    count: (el) => counts.get(el) ?? 0,
    ranked: () =>
      [...counts].map(([el, reads]) => ({ el, reads })).sort((a, b) => b.reads - a.reads),
    reset: () => counts.clear(),
    restore: () => {
      window.getComputedStyle = original;
    },
  };
}

/** Resolve after `ms` of wall clock. */
function delay(ms: number): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, ms);
  return promise;
}

/** Resolve after two animation frames. */
function twoFrames(): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>();
  requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  return promise;
}

/** Two frames plus a macrotask: enough for the rAF flush and any follow-up. */
async function settle(): Promise<void> {
  await twoFrames();
  await delay(50);
}

/**
 * The reporter's shape: one bordered card (auto-extracted CSS border, so it
 * mounts an SVG overlay) wrapping a row of small effect-free dots.
 * `autoEffects: false` on the dots removes their extraction read.
 */
function Page({ dots, autoEffects = true }: { dots: number; autoEffects?: boolean }): React.ReactNode {
  const items = [];
  for (let i = 0; i < dots; i++) {
    items.push(
      createElement(SmoothCorners, {
        key: i,
        as: "div",
        "data-dot": String(i),
        corners: { radius: 6, smoothing: 0.6 },
        autoEffects,
        style: { width: "12px", height: "12px", background: "#888" },
      } as React.ComponentProps<typeof SmoothCorners>),
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
      } as React.ComponentProps<typeof SmoothCorners>,
      items,
    ),
  );
}

// One read per element is the floor: the size the clip-path is generated from
// has to come from a live read at least once. Auto-extraction supplies that
// read for the mount sync, and the rAF flush takes a second — deliberately
// live rather than reusing the ResizeObserver entry, which is a frame stale by
// the time the flush runs and would clip an animating element to a stale box.
const MOUNT_BUDGET = 2;

describe("Browser smoke — computed-style budget", () => {
  it("mounts within the per-element read budget", async () => {
    const counter = installCounter();
    try {
      root.render(createElement(Page, { dots: 4 }));
      await settle();

      const squircles = [...container.querySelectorAll<HTMLElement>("[data-slot='smooth-corners']")];
      expect(squircles).toHaveLength(5);

      const perElement = squircles.map((el) => ({
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

      const dots = [...container.querySelectorAll<HTMLElement>("[data-dot]")];
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
      counter.reset();
      await delay(500);

      const ranked = counter.ranked();
      expect(ranked.map((r) => `${r.el.tagName}=${r.reads}`).join(" ")).toBe("");
    } finally {
      counter.restore();
    }
  }, 30_000);

  it("keeps the budget under StrictMode's double render", async () => {
    const counter = installCounter();
    try {
      root.render(createElement(StrictMode, null, createElement(Page, { dots: 4 })));
      await settle();

      const squircles = [...container.querySelectorAll<HTMLElement>("[data-slot='smooth-corners']")];
      const worst = Math.max(...squircles.map((el) => counter.count(el)));
      // StrictMode mounts, unmounts, and remounts every effect, so each element
      // legitimately runs the mount path twice.
      expect(worst).toBeLessThanOrEqual(MOUNT_BUDGET * 2);
    } finally {
      counter.restore();
    }
  }, 30_000);
});
