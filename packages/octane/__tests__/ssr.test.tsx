/** @jsx createElement */
import { createElement } from "octane";
import { renderToString } from "octane/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SmoothCorners } from "../src/index.js";
import { HYDRATION_PROPS, SERVER_HTML } from "./ssr-hydration-fixture.js";

function Fixture(props: Record<string, unknown>): unknown {
  return <SmoothCorners {...props} />;
}

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
    const html = renderToString(Fixture, {
      corners: { radius: 16, smoothing: 0.6 },
      children: "hello",
    }).html;
    expect(html.length).toBeGreaterThan(0);
    expect(html).toContain("hello");
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("renders asChild without throwing", () => {
    const html = renderToString(Fixture, {
      asChild: true,
      corners: { radius: 12 },
      children: <a href="/signup">Sign up</a>,
    }).html;
    expect(html).toContain("Sign up");
    expect(html).toContain('href="/signup"');
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("renders with polymorphic `as` without throwing", () => {
    const html = renderToString(Fixture, {
      as: "section",
      corners: { radius: 8 },
      children: "section content",
    }).html;
    expect(html).toMatch(/<section[^>]*>/);
    expect(html).toContain("section content");
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("emits an inline border-radius fallback derived from the corner radius", () => {
    const html = renderToString(Fixture, {
      corners: { radius: 16, smoothing: 0.6 },
      children: "hello",
    }).html;
    expect(html).toContain("border-radius:16px");
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("emits a per-corner border-radius fallback for per-corner options", () => {
    const html = renderToString(Fixture, {
      corners: { topLeft: 4, topRight: 8, bottomRight: 12, bottomLeft: 16 },
      children: "hi",
    }).html;
    expect(html).toContain("border-radius:4px 8px 12px 16px");
  });

  it("carries the fallback through asChild onto the child element", () => {
    const html = renderToString(Fixture, {
      asChild: true,
      corners: { radius: 20 },
      children: <a href="/x">link</a>,
    }).html;
    expect(html).toMatch(/<a[^>]*style="[^\"]*border-radius:20px/);
  });

  it("user-supplied style.borderRadius wins over the fallback", () => {
    const html = renderToString(Fixture, {
      corners: { radius: 16 },
      style: { borderRadius: 4 },
      children: "hi",
    }).html;
    expect(html).toContain("border-radius:4px");
    expect(html).not.toContain("border-radius:16px");
  });

  it("emits the markup consumed by the hydration parity test", () => {
    expect(renderToString(Fixture, HYDRATION_PROPS).html).toBe(SERVER_HTML);
  });
});
