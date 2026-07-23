// @vitest-environment happy-dom
//
// Mount extraction must issue exactly one getComputedStyle per element, with
// every computed-style read completing before the first layout-dirtying write.
// getComputedStyle is a layout-flush point; interleaving it with the
// padding/border writes forces repeated recalcs. These tests pin the batching.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { extractAndStripEffects } from "../src/extract-effects.js";

const WRITE_PROPS = [
  "border",
  "boxShadow",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
] as const;

/** Record getComputedStyle("read") and style-mutation("write") events in order. */
function instrument(el: HTMLElement): { events: string[]; restore: () => void } {
  const events: string[] = [];

  const gcs = window.getComputedStyle;
  const gcsSpy = vi
    .spyOn(window, "getComputedStyle")
    .mockImplementation((elt: Element, pseudo?: string | null) => {
      if (elt === el) events.push("read");
      return gcs.call(window, elt, pseudo);
    });

  const style = el.style;
  const proto = Object.getPrototypeOf(style);
  const restorers: Array<() => void> = [];
  for (const prop of WRITE_PROPS) {
    const desc = Object.getOwnPropertyDescriptor(proto, prop)!;
    Object.defineProperty(style, prop, {
      configurable: true,
      get() {
        return desc.get!.call(style);
      },
      set(v: string) {
        events.push(`write:${prop}`);
        desc.set!.call(style, v);
      },
    });
    restorers.push(() => delete (style as unknown as Record<string, unknown>)[prop]);
  }

  return {
    events,
    restore: () => {
      gcsSpy.mockRestore();
      for (const r of restorers) r();
    },
  };
}

describe("extractAndStripEffects — batched reads", () => {
  let el: HTMLElement;

  beforeEach(() => {
    el = document.createElement("div");
    document.body.appendChild(el);
  });

  afterEach(() => {
    el.remove();
  });

  it("calls getComputedStyle exactly once, before any write, when stripping a border + shadow", () => {
    el.style.border = "2px solid rgb(255, 0, 0)";
    el.style.boxShadow = "rgb(0, 0, 0) 2px 4px 8px 0px";
    el.style.boxSizing = "content-box";
    el.style.padding = "5px";

    const { events, restore } = instrument(el);
    try {
      extractAndStripEffects(el);
    } finally {
      restore();
    }

    const reads = events.filter((e) => e === "read");
    const firstWrite = events.findIndex((e) => e.startsWith("write:"));

    expect(reads).toHaveLength(1);
    expect(firstWrite).toBeGreaterThanOrEqual(0);
    expect(events.indexOf("read")).toBeLessThan(firstWrite);
    expect(events.slice(0, firstWrite).every((e) => e === "read")).toBe(true);
  });

  it("calls getComputedStyle exactly once even when nothing is stripped", () => {
    const { events, restore } = instrument(el);
    try {
      extractAndStripEffects(el);
    } finally {
      restore();
    }
    expect(events.filter((e) => e === "read")).toHaveLength(1);
  });
});
