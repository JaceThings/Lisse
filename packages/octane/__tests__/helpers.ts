/** happy-dom measures 0, so an unstubbed element bails at `width <= 0`. Re-callable to resize. */
export function stubLayout(el: HTMLElement, width = 200, height = 100): void {
  Object.defineProperty(el, "offsetWidth", { value: width, configurable: true });
  Object.defineProperty(el, "offsetHeight", { value: height, configurable: true });
}

export function getInner(container: HTMLElement): HTMLElement {
  const el = container.querySelector<HTMLElement>("[data-slot='smooth-corners']");
  if (!el) throw new Error("data-slot element not found");
  return el;
}

export function readClipPathD(container: HTMLElement): string {
  const clipPath = getInner(container).style.clipPath;
  const match = clipPath.match(/^path\("(.*)"\)$/s);
  return match ? match[1] : "";
}
