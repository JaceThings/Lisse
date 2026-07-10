// Visual snapshots — one default-config example per curve type.
//
// Catches Safari-specific SVG-rendering quirks (the repo has known
// documented issues) and any cross-browser path-parsing divergence.
//
// The local test just asserts capture succeeded; Argos handles the actual diff.
import { describe, it, beforeEach, afterEach } from "vitest";
import { page, server } from "@vitest/browser/context";
import { createRoot, type Root } from "react-dom/client";
import { createElement } from "react";
import { SmoothCorners } from "@lisse/react";
import type { CurveType } from "@lisse/core";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  container.style.cssText =
    "position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:200px;height:200px;background:#3b82f6;";
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  root.unmount();
  container.remove();
});

const CURVES: CurveType[] = ["arc", "squircle", "superellipse", "clothoid"];

describe("Browser smoke — visual snapshots per curve type", () => {
  for (const curve of CURVES) {
    it(`renders ${curve} corner consistently`, async () => {
      root.render(
        createElement(
          SmoothCorners,
          {
            as: "div",
            corners: { radius: 40, smoothing: 0.6, curve },
            autoEffects: false,
            style: { width: "100%", height: "100%", background: "#3b82f6" },
          } as React.ComponentProps<typeof SmoothCorners>,
        ),
      );
      // Wait for first paint + observer flush.
      await new Promise((r) => setTimeout(r, 100));

      // Scope the screenshot to `container` so Argos diffs the corner,
      // not the whole viewport (page chrome, scrollbars, layout drift).
      const filepath = `screenshots/${curve}-${server.browser}.png`;
      const result = await page.screenshot({ path: filepath, element: container });
      if (!result) throw new Error(`screenshot returned empty for ${filepath}`);
    }, 30_000);
  }
});
