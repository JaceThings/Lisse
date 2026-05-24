// Focus-ring a11y smoke.
//
// `clip-path` can clip child focus rings — a real a11y regression on
// a library whose entire job is clip-path. This test focuses a button
// inside a SmoothCorners element and captures the result as a visual
// snapshot. The screenshot is the proof: if the outline gets clipped
// in a future build, the snapshot diff catches it.
//
// Also asserts the button is focusable (DOM-level proof that Lisse's
// wrapper doesn't break tab order or interrupt focus chain).
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { page } from "@vitest/browser/context";
import { createRoot, type Root } from "react-dom/client";
import { createElement } from "react";
import { SmoothCorners } from "@lisse/react";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  container.style.cssText =
    "position:fixed;left:20px;top:20px;width:300px;height:80px;padding:20px;background:#3b82f6;";
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  root.unmount();
  container.remove();
});

describe("Browser smoke — focus ring through clip-path", () => {
  it("focused button inside SmoothCorners is focusable and renders an outline", async () => {
    root.render(
      createElement(
        SmoothCorners,
        {
          as: "div",
          corners: { radius: 16, smoothing: 0.6 },
          autoEffects: false,
          style: { padding: "12px" },
        } as React.ComponentProps<typeof SmoothCorners>,
        createElement(
          "button",
          {
            type: "button",
            "data-testid": "inner-button",
            style: {
              padding: "8px 16px",
              outline: "3px solid red",
              outlineOffset: "2px",
            },
          },
          "focus me",
        ),
      ),
    );

    await new Promise((r) => setTimeout(r, 100));

    const button = container.querySelector<HTMLButtonElement>("[data-testid='inner-button']");
    expect(button).not.toBeNull();
    button!.focus();
    expect(document.activeElement).toBe(button);

    // Visual proof: screenshot the container and let Argos diff it
    // against the baseline. Vitest browser-mode v3.x doesn't ship a
    // local pixel-diff matcher; the review surface lives in Argos.
    const result = await page.screenshot({ path: "screenshots/focus-ring.png" });
    if (!result) throw new Error("focus-ring screenshot returned empty");
  }, 30_000);
});
