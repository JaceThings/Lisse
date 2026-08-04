// Wide-gamut borders, asserted on painted pixels in a real engine.
//
// Two things only a browser can tell us: whether `getComputedStyle` really
// hands back `oklch(...)` for a border color (jsdom drops the declaration
// outright, so the unit tests have to fake the computed style), and whether
// an SVG `stroke` set to that string actually paints. A geometry check would
// pass either way, and so would a check that never left jsdom.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { page } from "@vitest/browser/context";
import { createRoot, type Root } from "react-dom/client";
import { createElement, useRef } from "react";
import { useSmoothCorners } from "@lisse/react";
import { parseBorder } from "@lisse/core";

const SIZE = 56;
const BORDER = 6;
const PAD = 20;

// oklch(0.628 0.2577 29.23) is sRGB #ff0000 to the nearest 8-bit step, so the
// expected pixel is exact rather than a tolerance around a converted value.
const RED = "oklch(0.628 0.2577 29.23)";
const RED_HALF = "oklch(0.628 0.2577 29.23 / 0.5)";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  container.style.cssText =
    `position:fixed;left:30px;top:30px;padding:${PAD}px;background:#ffffff;`;
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  root.unmount();
  container.remove();
});

function Box({ color }: { color: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useSmoothCorners(ref as React.RefObject<HTMLElement | null>, { radius: 14, smoothing: 0.6 });
  return createElement("div", {
    ref,
    style: {
      width: SIZE,
      height: SIZE,
      border: `${BORDER}px solid ${color}`,
      boxSizing: "border-box",
      background: "#ffffff",
    },
  });
}

async function sampler(base64: string, origin: DOMRect) {
  const img = new Image();
  img.src = `data:image/png;base64,${base64}`;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  const { data, width } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const ratio = img.width / origin.width;
  return (cssX: number, cssY: number) => {
    const x = Math.floor((cssX - origin.left) * ratio);
    const y = Math.floor((cssY - origin.top) * ratio);
    const i = (y * width + x) * 4;
    return { r: data[i], g: data[i + 1], b: data[i + 2] };
  };
}

describe("Browser smoke — wide-gamut border color", () => {
  it("reads a computed oklch border instead of dropping it", () => {
    const el = document.createElement("div");
    el.style.cssText = `width:${SIZE}px;height:${SIZE}px;border:${BORDER}px solid ${RED};`;
    container.appendChild(el);

    // The premise: engines keep oklch in the computed value rather than
    // serialising it down to rgb(). If this ever changes, the fix is moot
    // and this test says so directly.
    expect(getComputedStyle(el).borderTopColor).toMatch(/^(?:oklch|color)\(/);

    const border = parseBorder(el);
    expect(border).toBeDefined();
    expect(border!.width).toBe(BORDER);
    expect(border!.opacity).toBe(1);
    expect(String(border!.color)).toMatch(/^oklch\(/);

    el.remove();
  });

  it("keeps the border thickness around the corner", async () => {
    root.render(createElement(Box, { color: RED }));
    await new Promise((r) => setTimeout(r, 200));

    const box = container.querySelector("div[style]") as HTMLElement;

    const shot = await page.screenshot({
      base64: true,
      element: container,
      path: "screenshots/oklch-border.png",
    });
    const at = await sampler(
      typeof shot === "string" ? shot : shot.base64,
      container.getBoundingClientRect(),
    );

    const r = box.getBoundingClientRect();
    const isRed = (p: { r: number; g: number; b: number }) => p.r > 190 && p.g < 90 && p.b < 90;
    const run = (probe: (k: number) => { r: number; g: number; b: number }) =>
      Array.from({ length: 17 }, (_, k) => probe(k)).filter(isRed).length;

    const straight = run((k) => at(r.left + k, r.top + r.height / 2));
    const corner = run((k) => at(r.left + k, r.top + k));

    expect(straight).toBeGreaterThanOrEqual(BORDER - 1);
    expect(
      corner >= straight / 2,
      `corner band (${corner}px) should hold up against the straight edge (${straight}px)`,
    ).toBe(true);

    // The interior stays white: this is a ring, not a filled box.
    const mid = at(r.left + r.width / 2, r.top + r.height / 2);
    expect(mid.r > 230 && mid.g > 230 && mid.b > 230).toBe(true);

    // The mechanism behind the pixels: an unparsed border stays on the element
    // instead of being replaced by the SVG ring, and clip-path then eats
    // whatever falls outside the squircle.
    expect(box.style.border).toBe("0px");
  }, 30_000);

  it("applies embedded alpha once, not twice", async () => {
    root.render(createElement(Box, { color: RED_HALF }));
    await new Promise((r) => setTimeout(r, 200));

    const box = container.querySelector("div[style]") as HTMLElement;
    const shot = await page.screenshot({
      base64: true,
      element: container,
      path: "screenshots/oklch-border-alpha.png",
    });
    const at = await sampler(
      typeof shot === "string" ? shot : shot.base64,
      container.getBoundingClientRect(),
    );

    const r = box.getBoundingClientRect();
    const cy = r.top + r.height / 2;
    const px = at(r.left + BORDER / 2, cy);

    // 50% red over white is ~rgb(255,127,127). Reading the alpha out of the
    // string and also setting stroke-opacity would composite it twice and
    // land near rgb(255,191,191), which is what this bound rules out.
    expect(
      px.g > 95 && px.g < 165,
      `alpha should composite once (~127 green), got rgb(${px.r},${px.g},${px.b})`,
    ).toBe(true);
    expect(px.r > 220).toBe(true);
  }, 30_000);
});
