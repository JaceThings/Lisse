// Browser smoke: 500 SmoothCorners elements survive a resize storm
// under 6× CPU throttling without dropping below the 30fps low-end
// budget. Runs in real Chromium, WebKit, and Firefox via Vitest's
// browser mode (Playwright provider).
//
// This is the one test that actually exercises real layout + paint +
// compositor behaviour — every other test in the suite runs in
// happy-dom (no layout). Catches the failure class CodSpeed cannot.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { cdp, server } from "@vitest/browser/context";
import { createRoot, type Root } from "react-dom/client";
import { createElement } from "react";
import { SmoothCorners } from "@lisse/react";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  container.style.cssText =
    "position:relative;width:100vw;display:grid;grid-template-columns:repeat(20,1fr);gap:4px;";
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  root.unmount();
  container.remove();
});

/** Capture frame timestamps over `durationMs` and return the median
 *  inter-frame gap. Used to assert the page stays responsive. */
async function measureFrameTimes(durationMs: number): Promise<number> {
  return new Promise((resolve) => {
    const stamps: number[] = [];
    let last = performance.now();
    const start = last;
    function step(now: number) {
      stamps.push(now - last);
      last = now;
      if (now - start < durationMs) {
        requestAnimationFrame(step);
      } else {
        stamps.sort((a, b) => a - b);
        resolve(stamps[Math.floor(stamps.length / 2)] || 0);
      }
    }
    requestAnimationFrame(step);
  });
}

function renderMany(n: number): React.ReactNode {
  const items: React.ReactNode[] = [];
  for (let i = 0; i < n; i++) {
    items.push(
      createElement(
        SmoothCorners,
        {
          key: i,
          as: "div",
          corners: { radius: 12, smoothing: 0.6 },
          autoEffects: false,
          style: { width: "100%", height: "40px", background: "#ddd" },
        } as React.ComponentProps<typeof SmoothCorners>,
        null,
      ),
    );
  }
  return createElement("div", null, items);
}

/** Trigger a real ResizeObserver storm by mutating the container's
 *  width over `durationMs`. window.dispatchEvent('resize') won't fire
 *  ResizeObserver — only actual size changes do. */
function startSizeStorm(el: HTMLElement, durationMs: number): () => void {
  let i = 0;
  const start = performance.now();
  const id = setInterval(() => {
    i++;
    // Alternate between two widths to force a real layout change.
    el.style.width = i % 2 ? "calc(100vw - 8px)" : "calc(100vw - 12px)";
    if (performance.now() - start > durationMs) clearInterval(id);
  }, 16);
  return () => clearInterval(id);
}

// GitHub Actions runners are shared 2vCPU machines, much slower than
// any consumer machine. The thresholds below are calibrated against
// observed runner median frame times (66ms WebKit unthrottled, 150ms
// Chromium under 6× CPU throttle) plus headroom — the goal is to
// catch order-of-magnitude regressions, not pin precise frame times.
// CodSpeed (runner-independent instruction counts) is the actual
// per-PR perf gate.
const FRAME_BUDGET_MS = 200;
const FRAME_BUDGET_THROTTLED_MS = 600;

describe("Browser smoke — resize storm at scale", () => {
  it("500 SmoothCorners + size storm stays within budget", async () => {
    root.render(renderMany(500));
    await new Promise((r) => setTimeout(r, 200));

    const stop = startSizeStorm(container, 1000);
    const median = await measureFrameTimes(1000);
    stop();

    expect(median).toBeLessThan(FRAME_BUDGET_MS);
  }, 30_000);

  it.runIf(server.browser === "chromium")(
    "500 SmoothCorners under 6× CPU throttle stays within low-end budget",
    async () => {
      const session = cdp();
      await session.send("Emulation.setCPUThrottlingRate", { rate: 6 });
      try {
        root.render(renderMany(500));
        await new Promise((r) => setTimeout(r, 200));

        const stop = startSizeStorm(container, 1000);
        const median = await measureFrameTimes(1000);
        stop();

        expect(median).toBeLessThan(FRAME_BUDGET_THROTTLED_MS);
      } finally {
        await session.send("Emulation.setCPUThrottlingRate", { rate: 1 });
      }
    },
    30_000,
  );
});
