// @vitest-environment happy-dom
//
// The server-rendered border-radius fallback must hydrate on the client
// without a mismatch, and the Slot's composed ref must keep a stable identity
// across re-renders so the child ref isn't detached/re-attached on unrelated
// parent updates.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act } from "react";
import { renderToString } from "react-dom/server";
import { hydrateRoot, createRoot, type Root } from "react-dom/client";
import { SmoothCorners } from "../src/smooth-corners.js";
import { Slot } from "../src/slot.js";
import { installHarness, uninstallHarness } from "../../core/__tests__/harness/runtime-harness.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("SmoothCorners SSR hydration", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let container: HTMLDivElement;

  beforeEach(() => {
    installHarness();
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    errorSpy.mockRestore();
    warnSpy.mockRestore();
    container.remove();
    uninstallHarness();
  });

  it("hydrates the border-radius fallback markup with no mismatch warning", () => {
    const element = (
      <SmoothCorners autoEffects={false} corners={{ radius: 16, smoothing: 0.6 }}>
        hello
      </SmoothCorners>
    );

    const html = renderToString(element);
    expect(html).toContain("border-radius:16px");

    container.innerHTML = html;

    let root: Root;
    act(() => {
      root = hydrateRoot(container, element);
    });

    // A hydration mismatch surfaces as a console.error; the fallback must be
    // byte-identical between server and the client's initial render.
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();

    act(() => root.unmount());
  });
});

describe("Slot composed ref stability", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    installHarness();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    uninstallHarness();
  });

  it("does not detach/re-attach the child ref across a re-render with unchanged inputs", () => {
    const attaches: Array<HTMLElement | null> = [];
    // Stable identity across renders — defined outside the component.
    const forwardedRef = (node: HTMLElement | null): void => {
      attaches.push(node);
    };

    function App(): React.ReactElement {
      return (
        <Slot ref={forwardedRef}>
          <button>click</button>
        </Slot>
      );
    }

    act(() => {
      root.render(<App />);
    });
    expect(attaches.filter(Boolean).length).toBe(1);

    // Re-render with identical props. With a memoized composed ref, React
    // keeps the same callback and performs no detach (null) / re-attach.
    act(() => {
      root.render(<App />);
    });

    expect(attaches.filter((n) => n === null).length).toBe(0);
    expect(attaches.filter(Boolean).length).toBe(1);
  });
});
