// Two things only a real engine can settle: whether `getComputedStyle` hands
// back `oklch(...)` for a border color at all, and whether an SVG stroke set
// to that string paints. jsdom drops the declaration outright, so the unit
// tests have to fake the computed style.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { page } from "@vitest/browser/context";
import { createRoot, type Root } from "react-dom/client";
import { createElement, useRef, type ReactElement } from "react";
import { useSmoothCorners } from "@lisse/react";
import { parseBorder } from "@lisse/core";
import { sampler, isPaint, type Pixel } from "./sampler.js";

const SIZE = 56;
const BORDER = 6;
const RED = "oklch(0.628 0.2577 29.23)";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  container.style.cssText = "position:fixed;left:30px;top:30px;padding:20px;background:#ffffff;";
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  root.unmount();
  container.remove();
});

function Box({ color, style = "solid" }: { color: string; style?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useSmoothCorners(ref as React.RefObject<HTMLElement | null>, { radius: 14, smoothing: 0.6 });
  return createElement("div", {
    ref,
    style: {
      width: SIZE,
      height: SIZE,
      border: `${BORDER}px ${style} ${color}`,
      boxSizing: "border-box",
      background: "#ffffff",
    },
  });
}

async function paint(el: ReactElement, path?: string) {
  root.render(el);
  await new Promise((r) => setTimeout(r, 200));
  const box = container.querySelector("div[style]") as HTMLElement;
  const shot = await page.screenshot({ base64: true, element: container, path });
  const at = await sampler(typeof shot === "string" ? shot : shot.base64, container.getBoundingClientRect());
  const rect = box.getBoundingClientRect();
  const band = (probe: (k: number) => Pixel) => Array.from({ length: 17 }, (_, k) => probe(k));
  return {
    box,
    straight: band((k) => at(rect.left + k, rect.top + rect.height / 2)),
    corner: band((k) => at(rect.left + k, rect.top + k)),
  };
}

describe("Browser smoke — wide-gamut border color", () => {
  it("reads a computed oklch border instead of dropping it", () => {
    const el = document.createElement("div");
    el.style.cssText = `width:${SIZE}px;height:${SIZE}px;border:${BORDER}px solid ${RED};`;
    container.appendChild(el);

    expect(getComputedStyle(el).borderTopColor).toMatch(/^(?:oklch|color)\(/);
    expect(parseBorder(el)).toEqual({ width: BORDER, color: RED, opacity: 1 });

    el.remove();
  });

  // color-mix() and light-dark() are absent because engines resolve those
  // during computation, so they arrive as oklab()/oklch().
  it.each([
    ["oklch", RED],
    ["oklch with alpha", "oklch(0.628 0.2577 29.23 / 0.6)"],
    ["oklab", "oklab(0.628 0.225 0.126)"],
    ["lab", "lab(52 40 59)"],
    ["lch", "lch(52 72 40)"],
    ["display-p3", "color(display-p3 1 0 0)"],
    ["srgb", "color(srgb 0.5 0 0.5)"],
    ["tailwind opacity modifier", "color-mix(in oklab, oklch(0.628 0.2577 29.23) 60%, transparent)"],
  ])("paints a full ring for %s", async (_label, color) => {
    const { box, straight, corner } = await paint(createElement(Box, { color }));

    // An unparsed border stays on the element rather than becoming the SVG
    // ring, and clip-path then eats whatever falls outside the squircle. That
    // leaves the straight edges identical, so only the corner tells them apart.
    const edge = straight.filter(isPaint).length;
    const round = corner.filter(isPaint).length;
    expect(edge).toBeGreaterThanOrEqual(BORDER - 1);
    expect(round >= edge / 2, `corner band ${round}px vs straight edge ${edge}px`).toBe(true);
    expect(box.style.border).toBe("0px");
  }, 30_000);

  it("shades a groove border instead of flattening it to black", async () => {
    const { straight } = await paint(
      createElement(Box, { color: RED, style: "groove" }),
      "screenshots/oklch-border-groove.png",
    );
    const band = straight.slice(0, BORDER);
    const lum = band.map((p) => 0.2126 * p.r + 0.7152 * p.g + 0.0722 * p.b);

    expect(Math.max(...lum) - Math.min(...lum)).toBeGreaterThan(15);
    for (const p of band) {
      expect(p.r + p.g + p.b > 40, `groove band went black: rgb(${p.r},${p.g},${p.b})`).toBe(true);
    }
  }, 30_000);

  it("applies embedded alpha once, not twice", async () => {
    const { straight } = await paint(
      createElement(Box, { color: "oklch(0.628 0.2577 29.23 / 0.5)" }),
      "screenshots/oklch-border-alpha.png",
    );

    // 50% red over white is ~rgb(255,127,127). Reading the alpha out of the
    // string and also setting stroke-opacity would land near rgb(255,191,191).
    const px = straight[BORDER / 2];
    expect(px.r).toBeGreaterThan(220);
    expect(px.g).toBeGreaterThan(95);
    expect(px.g).toBeLessThan(165);
  }, 30_000);
});
