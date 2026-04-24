// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { smoothCorners } from "../src/smooth-corners.js";

let container: HTMLDivElement;

beforeEach(() => {
  if (!("ResizeObserver" in globalThis)) {
    (globalThis as { ResizeObserver: unknown }).ResizeObserver = class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    };
  }
  container = document.createElement("div");
  container.style.position = "relative";
  document.body.appendChild(container);
});

afterEach(() => {
  container.remove();
});

describe("smoothCorners action - lifecycle", () => {
  it("attaches data-slot on init and removes it on destroy", () => {
    const node = document.createElement("div");
    container.appendChild(node);
    const action = smoothCorners(node, { corners: { radius: 8 } });

    expect(node.getAttribute("data-slot")).toBe("smooth-corners");
    expect(node.getAttribute("data-state")).toBe("pending");

    action.destroy();

    expect(node.getAttribute("data-slot")).toBeNull();
    expect(node.getAttribute("data-state")).toBeNull();
  });

  it("restores prior inline clip-path on destroy", () => {
    const node = document.createElement("div");
    node.style.clipPath = "circle(10px)";
    container.appendChild(node);

    const action = smoothCorners(node, { corners: { radius: 8 } });
    action.destroy();

    expect(node.style.clipPath).toBe("circle(10px)");
  });

  it("update() accepts a SmoothCornersConfig and does not throw", () => {
    const node = document.createElement("div");
    container.appendChild(node);
    const action = smoothCorners(node, { corners: { radius: 8 } });
    expect(() => action.update({ corners: { radius: 16, smoothing: 0.6 } })).not.toThrow();
    action.destroy();
  });
});

describe("smoothCorners action - anchor capture", () => {
  it("does not throw when destroyed after being detached", () => {
    const parent = document.createElement("div");
    parent.style.position = "relative";
    container.appendChild(parent);

    const node = document.createElement("div");
    parent.appendChild(node);

    const action = smoothCorners(node, {
      corners: { radius: 8 },
      effects: { innerBorder: { width: 2, color: "#000", opacity: 1 } },
    });

    // Detach the node from its parent before destroy. Previously this would
    // strand the SVG overlay and skip the position release, but with the
    // captured anchor it should still clean up correctly.
    parent.removeChild(node);

    expect(() => action.destroy()).not.toThrow();
  });
});
