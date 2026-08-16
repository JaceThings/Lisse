/** @jsx createElement */
// @vitest-environment happy-dom
import { act, createElement, createRoot, hydrateRoot, type Root } from "octane";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Slot, SmoothCorners } from "../src/index.js";
import { installNoopResizeObserver } from "./helpers.js";
import { HYDRATION_PROPS, SERVER_HTML } from "./ssr-hydration-fixture.js";

function Fixture(props: typeof HYDRATION_PROPS): unknown {
  return <SmoothCorners {...props} />;
}

describe("SmoothCorners SSR hydration", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let container: HTMLDivElement;
  let root: Root | undefined;

  beforeEach(() => {
    installNoopResizeObserver();
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    container = document.createElement("div");
    container.innerHTML = SERVER_HTML;
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (root !== undefined) act(() => root?.unmount());
    errorSpy.mockRestore();
    warnSpy.mockRestore();
    container.remove();
    root = undefined;
  });

  it("hydrates the border-radius fallback markup with no mismatch warning", () => {
    const serverElement = container.querySelector("div");

    act(() => {
      root = hydrateRoot(container, Fixture, HYDRATION_PROPS);
    });

    expect(container.querySelector("div")).toBe(serverElement);
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

describe("Slot ref stability", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    installNoopResizeObserver();
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
