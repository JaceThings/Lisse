/** @jsx createElement */
// @vitest-environment happy-dom
import { act, createElement, createRoot, hydrateRoot, type Root } from "octane";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { generatePath } from "@lisse/core";
import {
  installHarness,
  uninstallHarness,
  type RuntimeHarness,
} from "../../core/__tests__/harness/runtime-harness.ts";
import { Slot, SmoothCorners } from "../src/index.js";
import { readClipPathD, stubLayout } from "./helpers.js";
import { HYDRATION_PROPS, SERVER_HTML } from "./ssr-hydration-fixture.js";

function Fixture(props: typeof HYDRATION_PROPS): unknown {
  return <SmoothCorners {...props} />;
}

describe("SmoothCorners SSR hydration", () => {
  let container: HTMLDivElement;
  let harness: RuntimeHarness;
  let root: Root | undefined;

  beforeEach(() => {
    harness = installHarness();
    container = document.createElement("div");
    container.innerHTML = SERVER_HTML;
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (root !== undefined) act(() => root?.unmount());
    container.remove();
    root = undefined;
    uninstallHarness();
  });

  it("adopts the server node and leaves its fallback markup byte-identical", () => {
    const serverElement = container.querySelector("div")!;
    const serverStyle = serverElement.getAttribute("style");
    // A fixture that stopped emitting this declaration would make the checks below vacuous.
    expect(serverStyle).toBe("border-radius:16px;");

    act(() => {
      root = hydrateRoot(container, Fixture, HYDRATION_PROPS);
    });

    expect(container.querySelector("div")).toBe(serverElement);
    // Octane repairs a mismatched node in place without logging, so a rewritten
    // `style` is the only tell a console spy could not give us.
    expect(serverElement.getAttribute("style")).toBe(serverStyle);
  });

  it("swaps the fallback for the core clip-path once the element is measured", () => {
    const el = container.querySelector<HTMLElement>("div")!;

    act(() => {
      root = hydrateRoot(container, Fixture, HYDRATION_PROPS);
    });
    expect(el.getAttribute("data-state")).toBe("pending");
    expect(el.style.clipPath).toBe("");

    stubLayout(el, 200, 100);
    act(() => {
      harness.deliverResize(el, 200, 100);
      harness.flushRaf();
    });

    expect(readClipPathD(container)).toBe(generatePath(200, 100, HYDRATION_PROPS.corners));
    expect(el.getAttribute("data-state")).toBe("ready");
    expect(el.style.borderRadius).toBe("");
  });
});

describe("Slot ref stability", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("does not detach/re-attach the child ref across an unchanged re-render", () => {
    root = createRoot(container);
    const attaches: Array<HTMLElement | null> = [];
    const forwardedRef = (node: HTMLElement | null): void => {
      attaches.push(node);
    };

    function App(): unknown {
      return (
        <Slot ref={forwardedRef}>
          <button type="button">click</button>
        </Slot>
      );
    }

    act(() => root.render(<App />));
    expect(attaches.filter(Boolean)).toHaveLength(1);

    act(() => root.render(<App />));

    expect(attaches.filter((node) => node === null)).toHaveLength(0);
    expect(attaches.filter(Boolean)).toHaveLength(1);
  });
});
