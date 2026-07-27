import { describe, it, expect, afterEach } from "vitest";
import { createEngine } from "../src/engine.js";

/** Wait for the engine's rAF-driven flush (a few frames covers re-queues). */
async function settle(frames = 3): Promise<void> {
  for (let i = 0; i < frames; i++) {
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
  }
}

/**
 * A plain candidate: big enough, rounded, and actually paints something.
 * `outline`/`box-shadow` are set explicitly because happy-dom computes them as
 * `""` rather than `none`, which the engine reads as a visible outline.
 */
function candidate(): HTMLElement {
  const el = document.createElement("div");
  el.style.width = "120px";
  el.style.height = "60px";
  el.style.backgroundColor = "rgb(0, 0, 0)";
  el.style.borderRadius = "20px";
  el.style.outlineStyle = "none";
  el.style.boxShadow = "none";
  document.body.appendChild(el);
  return el;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("engine — Lisse-owned pages", () => {
  it("smooths a normal page", async () => {
    const el = candidate();
    createEngine({ enabled: true });
    await settle();
    expect(el.style.clipPath).toMatch(/^path\("/);
  });

  it("stands down when the page ships Lisse", async () => {
    const el = candidate();
    const own = candidate();
    own.setAttribute("data-slot", "smooth-corners");
    createEngine({ enabled: true });
    await settle();
    expect(el.style.clipPath).toBe("");
  });

  it("restores what it already wrote when Lisse mounts late", async () => {
    const el = candidate();
    createEngine({ enabled: true });
    await settle();
    expect(el.style.clipPath).toMatch(/^path\("/);

    // Framework mounts and marks its own element — a later flush must undo ours.
    candidate().setAttribute("data-slot", "smooth-corners");
    await settle();
    expect(el.style.clipPath).toBe("");
  });

  it("stays stood down across a disable/enable toggle", async () => {
    const el = candidate();
    candidate().setAttribute("data-slot", "smooth-corners");
    const engine = createEngine({ enabled: true });
    await settle();

    engine.setEnabled(false);
    engine.setEnabled(true);
    await settle();
    expect(el.style.clipPath).toBe("");
  });
});
