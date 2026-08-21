import { describe, it, expect, afterEach } from "vitest";
import { createEngine } from "../src/engine.js";

/** A few frames, so re-queued work lands too. */
async function settle(frames = 3): Promise<void> {
  for (let i = 0; i < frames; i++) {
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
  }
}

/**
 * `outline`/`box-shadow` are explicit because happy-dom computes them as `""`
 * rather than `none`, which the engine reads as a visible outline.
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

/** Engines observe `document`, so a leaked one keeps styling the next test. */
const engines: ReturnType<typeof createEngine>[] = [];
function engine(): ReturnType<typeof createEngine> {
  const e = createEngine({ enabled: true });
  engines.push(e);
  return e;
}

afterEach(() => {
  for (const e of engines.splice(0)) e.setEnabled(false);
  document.body.innerHTML = "";
});

describe("engine — Lisse-owned pages", () => {
  it("smooths a normal page", async () => {
    const el = candidate();
    engine();
    await settle();
    expect(el.style.clipPath).toMatch(/^path\("/);
  });

  it("stands down when the page ships Lisse", async () => {
    const el = candidate();
    const own = candidate();
    own.setAttribute("data-slot", "smooth-corners");
    engine();
    await settle();
    expect(el.style.clipPath).toBe("");
  });

  it("restores what it already wrote when Lisse mounts late", async () => {
    const el = candidate();
    engine();
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
    const e = engine();
    await settle();

    e.setEnabled(false);
    e.setEnabled(true);
    await settle();
    expect(el.style.clipPath).toBe("");
  });
});

describe("engine — the site's filter", () => {
  it("does not replay an entrance blur it happened to sample", async () => {
    const el = candidate();
    el.style.filter = "blur(8px)";
    engine();
    await settle();

    // Entrance animation ends and a later transition resizes the box.
    el.style.filter = "";
    el.style.height = "90px";
    await settle();
    expect(el.style.filter).toBe("");
  });

  it("leaves a filter the site sets after we land alone", async () => {
    const el = candidate();
    engine();
    await settle();

    el.style.filter = "blur(4px)";
    el.style.height = "90px";
    await settle();
    expect(el.style.filter).toBe("blur(4px)");
  });

  it("composes its shadow filter over the site's, then hands it back", async () => {
    const el = candidate();
    el.style.boxShadow = "rgb(0, 0, 0) 0px 2px 4px 0px";
    engine();
    await settle();
    expect(el.style.filter).toMatch(/^drop-shadow\(/);
    // One layer, not our own readback composed over itself each re-plan.
    expect(el.style.filter).not.toMatch(/\) drop-shadow/);

    el.style.boxShadow = "none";
    await settle();
    expect(el.style.filter).toBe("");
  });
});

describe("engine — the site's box-shadow", () => {
  it("hides the site's shadow with `important`, since a site rule outranks a plain inline value", async () => {
    const el = candidate();
    el.style.boxShadow = "rgba(1, 4, 9, 0.24) 0px 1px 0px 0px inset";
    engine();
    await settle();

    expect(el.style.boxShadow).toBe("none");
    expect(el.style.getPropertyPriority("box-shadow")).toBe("important");
  });
});
