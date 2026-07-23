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

  it("emits an inline border-radius fallback derived from the corner radius", () => {
    const html = renderToString(
      <SmoothCorners corners={{ radius: 16, smoothing: 0.6 }}>hello</SmoothCorners>,
    );
    expect(html).toContain("border-radius:16px");
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("emits a per-corner border-radius fallback for per-corner options", () => {
    const html = renderToString(
      <SmoothCorners corners={{ topLeft: 4, topRight: 8, bottomRight: 12, bottomLeft: 16 }}>
        hi
      </SmoothCorners>,
    );
    expect(html).toContain("border-radius:4px 8px 12px 16px");
  });

  it("carries the fallback through asChild onto the child element", () => {
    const html = renderToString(
      <SmoothCorners asChild corners={{ radius: 20 }}>
        <a href="/x">link</a>
      </SmoothCorners>,
    );
    expect(html).toMatch(/<a[^>]*style="[^"]*border-radius:20px/);
  });

  it("user-supplied style.borderRadius wins over the fallback", () => {
    const html = renderToString(
      <SmoothCorners corners={{ radius: 16 }} style={{ borderRadius: 4 }}>
        hi
      </SmoothCorners>,
    );
    expect(html).toContain("border-radius:4px");
    expect(html).not.toContain("border-radius:16px");
  });
});
