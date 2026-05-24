// Visual snapshots — one default-config example per curve type.
//
// Catches Safari-specific SVG-rendering quirks (the repo has known
// documented issues) and any cross-browser path-parsing divergence.
//
// Screenshots are written to `tests/browser-smoke/screenshots/`. The
// browser-smoke workflow then uploads that directory to Argos for
// review-surface diffing. Read-only in Argos for the first 4 weeks
// (visual changes appear as non-blocking PR comments), then promoted
// to blocking.
//
// Within this test we use `toMatchScreenshot` (Vitest browser mode's
// built-in pixel-diff matcher) so a regression also fails the run
// locally and in CI before Argos sees it.
import { describe, it, beforeEach, afterEach, expect } from "vitest";
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

      // Vitest browser-mode pixel-diff snapshot. `maxDiffPixelRatio:
      // 0.02` tolerates antialiasing noise but catches real visual
      // regressions. Baselines live in `__screenshots__/` next to this
      // file; Argos receives the same images via the workflow upload.
      const filename = `${curve}-${server.browser}.png`;
      await expect(page.locator(container)).toMatchScreenshot(filename, {
        maxDiffPixelRatio: 0.02,
      });
    }, 30_000);
  }
});
