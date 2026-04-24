// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { SmoothCorners } from "../src/smooth-corners.js";

describe("SmoothCorners - server-side rendering", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("renders a basic instance without throwing or warning", () => {
    const html = renderToString(
      <SmoothCorners corners={{ radius: 16, smoothing: 0.6 }}>hello</SmoothCorners>,
    );
    expect(html.length).toBeGreaterThan(0);
    expect(html).toContain("hello");
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("renders asChild without throwing", () => {
    const html = renderToString(
      <SmoothCorners asChild corners={{ radius: 12 }}>
        <a href="/signup">Sign up</a>
      </SmoothCorners>,
    );
    expect(html).toContain("Sign up");
    expect(html).toContain("href=\"/signup\"");
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("renders with polymorphic `as` without throwing", () => {
    const html = renderToString(
      <SmoothCorners as="section" corners={{ radius: 8 }}>
        section content
      </SmoothCorners>,
    );
    expect(html).toMatch(/<section[^>]*>/);
    expect(html).toContain("section content");
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
