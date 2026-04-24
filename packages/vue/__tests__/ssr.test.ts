// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createSSRApp, h } from "vue";
import { renderToString } from "vue/server-renderer";
import { SmoothCorners } from "../src/smooth-corners.js";

describe("SmoothCorners Vue - server-side rendering", () => {
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

  it("renders a basic instance without throwing or warning", async () => {
    const app = createSSRApp({
      render: () =>
        h(SmoothCorners, { corners: { radius: 16, smoothing: 0.6 } }, () => "hello"),
    });
    const html = await renderToString(app);
    expect(html.length).toBeGreaterThan(0);
    expect(html).toContain("hello");
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("renders asChild without throwing", async () => {
    const app = createSSRApp({
      render: () =>
        h(
          SmoothCorners,
          { asChild: true, corners: { radius: 12 } },
          () => h("a", { href: "/signup" }, "Sign up"),
        ),
    });
    const html = await renderToString(app);
    expect(html).toContain("Sign up");
    expect(html).toContain("href=\"/signup\"");
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("renders with polymorphic `as` without throwing", async () => {
    const app = createSSRApp({
      render: () =>
        h(
          SmoothCorners,
          { as: "section", corners: { radius: 8 } },
          () => "section content",
        ),
    });
    const html = await renderToString(app);
    expect(html).toMatch(/<section[^>]*>/);
    expect(html).toContain("section content");
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
