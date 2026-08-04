// Outer effects on a direct (unwrapped) element, asserted on painted pixels —
// both historical failure modes (overlay clipped by its own element, overlays
// stacked on a shared parent's origin) leave the DOM looking correct, so a
// geometry check would pass while the ring was invisible.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { page } from "@vitest/browser/context";
import { createRoot, type Root } from "react-dom/client";
import { createElement, useRef } from "react";
import { useSmoothCorners } from "@lisse/react";
import type { BorderConfig } from "@lisse/core";
import { sampler } from "./sampler.js";

const SIZE = 56;
const BORDER = 4;
const GAP = 24;
const OUTER: BorderConfig = { width: BORDER, color: "#ff0000", opacity: 1 };

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  container.style.cssText =
    `position:fixed;left:30px;top:30px;padding:${GAP}px;background:#ffffff;`;
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  root.unmount();
  container.remove();
});

function Btn() {
  const ref = useRef<HTMLButtonElement>(null);
  useSmoothCorners(ref as React.RefObject<HTMLElement | null>, { radius: 14, smoothing: 0.6 }, {
    autoEffects: false,
    effects: { outerBorder: OUTER },
  });
  return createElement("button", {
    ref,
    type: "button",
    style: { width: SIZE, height: SIZE, border: "none", padding: 0, background: "#222222" },
  });
}

const isRed = (p: { r: number; g: number; b: number }) => p.r > 190 && p.g < 90 && p.b < 90;

describe("Browser smoke — outerBorder on a direct element", () => {
  it("paints a complete ring around every button in a grid, wrapper-free", async () => {
    root.render(
      createElement(
        "div",
        { style: { display: "grid", gridTemplateColumns: `repeat(3, ${SIZE}px)`, gap: `${GAP}px` } },
        [0, 1, 2, 3, 4, 5].map((i) => createElement(Btn, { key: i })),
      ),
    );
    await new Promise((r) => setTimeout(r, 200));

    const grid = container.firstElementChild as HTMLElement;
    const buttons = [...grid.querySelectorAll("button")];
    expect(buttons).toHaveLength(6);

    for (const btn of buttons) {
      expect(btn.parentElement).toBe(grid);
      expect(btn.querySelector("svg")).toBeNull();
    }

    const shot = await page.screenshot({
      base64: true,
      element: container,
      path: "screenshots/outer-border-direct.png",
    });
    const at = await sampler(
      typeof shot === "string" ? shot : shot.base64,
      container.getBoundingClientRect(),
    );

    // Middle of the outer band on each straight edge, for every button — a
    // parent-anchored overlay ignoring its offset would light up cell 0 alone.
    const d = BORDER / 2;
    for (const [i, btn] of buttons.entries()) {
      const r = btn.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const probes = {
        top: at(cx, r.top - d),
        right: at(r.right + d, cy),
        bottom: at(cx, r.bottom + d),
        left: at(r.left - d, cy),
      };
      for (const [edge, px] of Object.entries(probes)) {
        expect(
          isRed(px),
          `cell ${i} ${edge} edge should be the outer border, got rgb(${px.r},${px.g},${px.b})`,
        ).toBe(true);
      }
    }
  }, 30_000);
});
