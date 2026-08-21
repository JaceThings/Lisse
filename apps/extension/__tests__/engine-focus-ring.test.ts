// Own file: the cascade this drives is order-sensitive under happy-dom and
// needs a fresh document per file.
import { describe, it, expect, afterEach } from "vitest";
import { createEngine } from "../src/engine.js";

async function settle(frames = 3): Promise<void> {
  for (let i = 0; i < frames; i++) {
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
  }
}

const engines: ReturnType<typeof createEngine>[] = [];
const sheets: HTMLStyleElement[] = [];

afterEach(() => {
  for (const e of engines.splice(0)) e.setEnabled(false);
  for (const s of sheets.splice(0)) s.remove();
  document.body.innerHTML = "";
});

function sheet(css: string): void {
  const el = document.createElement("style");
  el.textContent = css;
  document.head.appendChild(el);
  sheets.push(el);
}

function candidate(className: string): HTMLElement {
  const el = document.createElement("div");
  el.className = className;
  el.style.width = "120px";
  el.style.height = "60px";
  el.style.backgroundColor = "rgb(0, 0, 0)";
  el.style.borderRadius = "20px";
  el.style.outlineStyle = "none";
  document.body.appendChild(el);
  return el;
}

describe("engine — a focus ring it cannot represent", () => {
  it("hands the element back whole, then takes it again when the ring goes", async () => {
    sheet(
      ".fc { box-shadow: rgba(1, 4, 9, 0.24) 0px 1px 0px 0px inset; }" +
        ".fc.focus { box-shadow: rgb(31, 111, 235) 0px 0px 0px 3px; }",
    );
    const el = candidate("fc");
    const e = createEngine({ enabled: true });
    engines.push(e);
    await settle();

    expect(el.style.clipPath).toMatch(/^path\("/);
    expect(el.style.boxShadow).toBe("none");
    expect(el.style.getPropertyPriority("box-shadow")).toBe("important");

    el.classList.add("focus");
    el.style.height = "90px";
    await settle();
    expect(el.style.clipPath).toBe("");
    expect(el.style.boxShadow).toBe("");

    el.classList.remove("focus");
    el.style.height = "60px";
    await settle();
    expect(el.style.clipPath).toMatch(/^path\("/);
    expect(el.style.getPropertyPriority("box-shadow")).toBe("important");
  });
});
