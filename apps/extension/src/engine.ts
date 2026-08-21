import { observeResize, getLayoutSize, parseColor } from "@lisse/core";
import {
  computeElementPlan,
  parseCornerRadius,
  isElliptical,
  pseudoEscapesBox,
  isDefaultCorner,
  MIN_RADIUS,
  DEFAULT_SMOOTHING,
  type Radii,
  type PlanInput,
  type BorderInput,
  type BackgroundInput,
  type BorderLayer,
} from "./plan.js";

export interface EngineSettings {
  enabled: boolean;
  smoothing?: number;
}

const MAX_STYLED = 1500;
const LISSE_MARKER = '[data-slot="smooth-corners"]';
const REPLACED_TAGS = new Set(["IMG", "VIDEO", "CANVAS", "IFRAME", "EMBED", "OBJECT"]);
const FRAME_BUDGET_MS = 6;
const CHUNK = 32;

interface BorderColors {
  top: string;
  right: string;
  bottom: string;
  left: string;
}

interface SiteStyles {
  filter: string;
  borderColors: BorderColors;
  bg: BackgroundInput;
}

interface OriginalStyles {
  clipPath: string;
  filter: string;
  borderColor: string;
  bg: BackgroundInput;
  boxShadow: string;
}

interface Applied extends OriginalStyles {
  site: SiteStyles;
  lastClip: string;
  lastFilter: string | null;
  lastBorderColor: string;
  lastBgImage: string;
  lastBoxShadow: string | null;
  unobserve: () => void;
}

interface PlanResult {
  plan: ReturnType<typeof computeElementPlan>;
  site: SiteStyles;
}

function readBorder(cs: CSSStyleDeclaration, colors: BorderColors): BorderInput {
  const side = (name: string, color: string) => ({
    width: parseFloat(cs.getPropertyValue(`border-${name}-width`)),
    style: cs.getPropertyValue(`border-${name}-style`),
    color,
  });
  return {
    top: side("top", colors.top),
    right: side("right", colors.right),
    bottom: side("bottom", colors.bottom),
    left: side("left", colors.left),
  };
}

function visibleOutline(cs: CSSStyleDeclaration): boolean {
  if (cs.outlineStyle === "none" || parseFloat(cs.outlineWidth) <= 0.01) return false;
  const colour = parseColor(cs.outlineColor);
  return !colour || colour.opacity > 0;
}

function pseudoOutside(el: HTMLElement, w: number, h: number): boolean {
  for (const which of ["::before", "::after"]) {
    const ps = getComputedStyle(el, which);
    if (ps.content === "none" || ps.position !== "absolute") continue;
    const o = {
      top: parseFloat(ps.top),
      right: parseFloat(ps.right),
      bottom: parseFloat(ps.bottom),
      left: parseFloat(ps.left),
      width: parseFloat(ps.width),
      height: parseFloat(ps.height),
    };
    if (pseudoEscapesBox(o, { width: w, height: h })) return true;
  }
  return false;
}

const ESCAPE_SCAN_CAP = 200;

function host(n: EventTarget | Node | null | undefined): HTMLElement | null {
  return n instanceof HTMLElement ? n : null;
}

function childrenEscapeBox(el: HTMLElement, cs: CSSStyleDeclaration): boolean {
  if (cs.overflowX !== "visible" && cs.overflowY !== "visible") return false;
  if (el.childElementCount === 0) return false;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return false;
  const eps = 0.6;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT);
  let node = walker.nextNode();
  let seen = 0;
  while (node instanceof Element && seen++ < ESCAPE_SCAN_CAP) {
    const kr = node.getBoundingClientRect();
    if (kr.width > 0 && kr.height > 0 &&
        (kr.left < r.left - eps || kr.top < r.top - eps ||
         kr.right > r.right + eps || kr.bottom > r.bottom + eps)) {
      const kcs = getComputedStyle(node);
      if (kcs.visibility !== "hidden" && kcs.opacity !== "0" && kcs.position !== "fixed") {
        return true;
      }
    }
    node = walker.nextNode();
  }
  return false;
}

function writeOwnedShadow(el: HTMLElement, value: string) {
  el.style.setProperty("box-shadow", value, "important");
}

function releaseOwnedShadow(el: HTMLElement, orig: string) {
  el.style.removeProperty("box-shadow");
  if (orig) el.style.boxShadow = orig;
}

function readBg(s: CSSStyleDeclaration): BackgroundInput {
  return {
    image: s.backgroundImage,
    origin: s.backgroundOrigin,
    clip: s.backgroundClip,
    repeat: s.backgroundRepeat,
    size: s.backgroundSize,
    position: s.backgroundPosition,
  };
}

function bgFromLayer(layer: BorderLayer): BackgroundInput {
  return {
    image: layer.backgroundImage,
    origin: layer.backgroundOrigin,
    clip: layer.backgroundClip,
    repeat: layer.backgroundRepeat,
    size: layer.backgroundSize,
    position: layer.backgroundPosition,
  };
}

function writeBg(el: HTMLElement, bg: BackgroundInput) {
  el.style.backgroundImage = bg.image;
  el.style.backgroundOrigin = bg.origin;
  el.style.backgroundClip = bg.clip;
  el.style.backgroundRepeat = bg.repeat;
  el.style.backgroundSize = bg.size;
  el.style.backgroundPosition = bg.position;
}

function readRadii(cs: CSSStyleDeclaration, w: number, h: number): { radii: Radii; elliptical: boolean } | null {
  const tl = parseCornerRadius(cs.borderTopLeftRadius, w, h);
  const tr = parseCornerRadius(cs.borderTopRightRadius, w, h);
  const br = parseCornerRadius(cs.borderBottomRightRadius, w, h);
  const bl = parseCornerRadius(cs.borderBottomLeftRadius, w, h);
  if (!tl || !tr || !br || !bl) return null;
  const elliptical = isElliptical(tl) || isElliptical(tr) || isElliptical(br) || isElliptical(bl);
  return { radii: { tl: tl.h, tr: tr.h, br: br.h, bl: bl.h }, elliptical };
}

export function createEngine(initial: EngineSettings) {
  const settings = { enabled: initial.enabled, smoothing: initial.smoothing ?? DEFAULT_SMOOTHING };
  const applied = new Map<HTMLElement, Applied>();
  const seen = new WeakSet<HTMLElement>();
  const queue = new Set<HTMLElement>();
  const observedRoots = new WeakSet<ShadowRoot>();
  let rafHandle: number | undefined;
  let mo: MutationObserver | undefined;
  let stoodDown = false;

  const MO_OPTS: MutationObserverInit = {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["style", "class"],
  };

  function planFor(el: HTMLElement): PlanResult | null {
    const cs = getComputedStyle(el);
    if (cs.display === "inline" && !REPLACED_TAGS.has(el.tagName)) return null;
    if (el.tagName === "FIELDSET" && el.querySelector(":scope > legend")) return null;
    const corners = cs.getPropertyValue("corner-shape");
    if (corners && !isDefaultCorner(corners)) return null;
    const { width: w, height: h } = getLayoutSize(el);
    if (isNaN(w) || isNaN(h)) return null;
    const rect = el.getBoundingClientRect();
    const read = readRadii(cs, w, h);
    if (!read) return null;
    const { tl, tr, br, bl } = read.radii;
    if (Math.max(tl, tr, br, bl) < MIN_RADIUS) return null;

    const site: SiteStyles = applied.get(el)?.site ?? {
      filter: cs.filter,
      borderColors: {
        top: cs.borderTopColor,
        right: cs.borderRightColor,
        bottom: cs.borderBottomColor,
        left: cs.borderLeftColor,
      },
      bg: readBg(cs),
    };

    const bgColor = parseColor(cs.backgroundColor);
    const paintsNothing =
      (!bgColor || bgColor.opacity === 0) &&
      (site.bg.image === "none" || site.bg.image === "") &&
      cs.boxShadow === "none" &&
      cs.overflowX === "visible" && cs.overflowY === "visible";

    const input: PlanInput = {
      width: w,
      height: h,
      radii: read.radii,
      elliptical: read.elliptical,
      border: readBorder(cs, site.borderColors),
      hasBorderImage: cs.borderImageSource !== "none" && cs.borderImageSource !== "",
      background: site.bg,
      paintsNothing,
      hasOutline: visibleOutline(cs),
      pseudoOutside: pseudoOutside(el, w, h),
      childOutside: childrenEscapeBox(el, cs),
      boxShadow: cs.boxShadow,
      existingFilter: site.filter,
      smoothing: settings.smoothing,
      pageLeft: rect.left + window.scrollX,
      pageTop: rect.top + window.scrollY,
      dpr: window.devicePixelRatio || 1,
    };
    return { plan: computeElementPlan(input), site };
  }

  function writePlan(el: HTMLElement, result: PlanResult | null) {
    if (!result || result.plan.action !== "apply") {
      if (applied.has(el)) undo(el);
      return;
    }
    const { plan } = result;
    const record = applied.get(el);
    const orig: OriginalStyles = record ?? {
      clipPath: el.style.clipPath,
      filter: el.style.filter,
      borderColor: el.style.borderColor,
      bg: readBg(el.style),
      boxShadow: el.style.boxShadow,
    };

    const clipPath = "clipPath" in plan ? plan.clipPath : "";
    const border = "border" in plan ? plan.border : undefined;
    const filter = "filter" in plan ? plan.filter ?? null : null;
    const boxShadow = "boxShadow" in plan ? plan.boxShadow ?? null : null;
    const borderColor = border && !border.keepBorderColor ? "transparent" : orig.borderColor;
    const bg = border ? bgFromLayer(border) : orig.bg;
    const bgImage = bg.image;

    if (record &&
        record.lastClip === clipPath &&
        record.lastFilter === filter &&
        record.lastBorderColor === borderColor &&
        record.lastBgImage === bgImage &&
        record.lastBoxShadow === boxShadow) {
      // flush() released the site shadow so we could read :focus; put ours back.
      if (record.lastBoxShadow !== null) writeOwnedShadow(el, record.lastBoxShadow);
      return;
    }

    el.style.clipPath = clipPath || orig.clipPath;

    if (filter !== null) el.style.filter = filter;
    else if (record && record.lastFilter !== null) el.style.filter = orig.filter;

    if (boxShadow !== null) writeOwnedShadow(el, boxShadow);
    else if (record && record.lastBoxShadow !== null) releaseOwnedShadow(el, orig.boxShadow);

    if (border || record?.lastBorderColor === "transparent") {
      el.style.borderColor = borderColor;
      writeBg(el, bg);
    }

    const last = {
      lastClip: clipPath,
      lastFilter: filter,
      lastBorderColor: borderColor,
      lastBgImage: bgImage,
      lastBoxShadow: boxShadow,
    };
    if (record) Object.assign(record, last);
    else {
      applied.set(el, {
        ...orig,
        ...last,
        site: result.site,
        unobserve: observeResize(el, () => enqueue(el)),
      });
    }
  }

  function restore(el: HTMLElement, record: Applied) {
    el.style.clipPath = record.clipPath;
    if (record.lastFilter !== null) el.style.filter = record.filter;
    el.style.borderColor = record.borderColor;
    writeBg(el, record.bg);
    if (record.lastBoxShadow !== null) releaseOwnedShadow(el, record.boxShadow);
  }

  function undo(el: HTMLElement) {
    const record = applied.get(el);
    if (!record) return;
    restore(el, record);
    record.unobserve();
    applied.delete(el);
  }

  function skip(el: Element): boolean {
    return el.tagName === "HTML" || el.tagName === "BODY" ||
      el.namespaceURI === "http://www.w3.org/2000/svg";
  }

  function enqueue(el: HTMLElement) {
    queue.add(el);
    scheduleFlush();
  }

  function scheduleFlush() {
    if (rafHandle !== undefined) return;
    rafHandle = requestAnimationFrame(flush);
  }

  function siteShipsLisse(): boolean {
    if (stoodDown) return true;
    if (!document.querySelector(LISSE_MARKER)) return false;
    stoodDown = true;
    for (const el of [...applied.keys()]) undo(el);
    mo?.disconnect();
    document.removeEventListener("transitionend", onTransition, true);
    document.removeEventListener("animationend", onTransition, true);
    document.removeEventListener("focusin", onFocusChange, true);
    document.removeEventListener("focusout", onFocusChange, true);
    return true;
  }

  function flush() {
    rafHandle = undefined;
    if (!settings.enabled || siteShipsLisse()) {
      queue.clear();
      return;
    }
    const deadline = performance.now() + FRAME_BUDGET_MS;
    for (const el of queue) {
      const rec = applied.get(el);
      if (rec && rec.lastBoxShadow !== null) releaseOwnedShadow(el, rec.boxShadow);
    }
    const ops: Array<{ el: HTMLElement; result: PlanResult | null }> = [];
    let n = 0;
    for (const el of queue) {
      queue.delete(el);
      ops.push({ el, result: el.isConnected ? planFor(el) : null });
      if (++n % CHUNK === 0 && performance.now() >= deadline) break;
    }
    for (const { el, result } of ops) writePlan(el, result);
    if (queue.size > 0) scheduleFlush();
  }

  function scanRoot(root: Document | ShadowRoot) {
    if (root instanceof ShadowRoot && mo && !observedRoots.has(root)) {
      observedRoots.add(root);
      mo.observe(root, MO_OPTS);
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let node = walker.nextNode();
    while (node) {
      if (applied.size + queue.size >= MAX_STYLED) break;
      const el = host(node);
      node = walker.nextNode();
      if (!el || skip(el)) continue;
      if (el.shadowRoot) scanRoot(el.shadowRoot);
      if (seen.has(el)) continue;
      seen.add(el);
      const cs = getComputedStyle(el);
      if (cs.borderTopLeftRadius === "0px" && cs.borderTopRightRadius === "0px" &&
          cs.borderBottomRightRadius === "0px" && cs.borderBottomLeftRadius === "0px") {
        continue;
      }
      enqueue(el);
    }
  }

  function onMutations(records: MutationRecord[]) {
    if (!settings.enabled) return;
    for (const rec of records) {
      if (rec.type === "attributes") {
        const el = host(rec.target);
        if (el && !skip(el)) {
          enqueue(el);
          enqueueAppliedAncestors(el);
        }
      } else {
        const parent = host(rec.target);
        if (parent && !skip(parent)) enqueue(parent);
        for (const added of rec.addedNodes) {
          const el = host(added);
          if (!el) continue;
          if (el.shadowRoot) scanRoot(el.shadowRoot);
          scanSubtree(el);
        }
        for (const removed of rec.removedNodes) {
          const root = host(removed);
          if (!root) continue;
          if (applied.has(root)) undo(root);
          const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
          let node = walker.nextNode();
          while (node) {
            const child = host(node);
            if (child && applied.has(child)) undo(child);
            node = walker.nextNode();
          }
        }
      }
    }
  }

  function enqueueAppliedAncestors(el: Element) {
    const up = (x: Element): Element | null => {
      if (x.parentElement) return x.parentElement;
      const root = x.getRootNode();
      return root instanceof ShadowRoot ? host(root.host) : null;
    };
    for (let n = up(el), d = 0; n && d < 12; n = up(n), d++) {
      const h = host(n);
      if (h && applied.has(h)) enqueue(h);
    }
  }

  function onTransition(e: Event) {
    if (!settings.enabled) return;
    const t = host(e.composedPath()[0]);
    if (t && !skip(t)) {
      enqueue(t);
      enqueueAppliedAncestors(t);
    }
  }

  function onFocusChange(e: Event) {
    if (!settings.enabled) return;
    for (const n of e.composedPath().slice(0, 10)) {
      const el = host(n);
      if (el && !skip(el)) enqueue(el);
    }
  }

  function scanSubtree(el: HTMLElement) {
    if (skip(el)) return;
    if (applied.size + queue.size >= MAX_STYLED) return;
    enqueue(el);
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT);
    let node = walker.nextNode();
    while (node) {
      if (applied.size + queue.size >= MAX_STYLED) break;
      const child = host(node);
      if (child && !skip(child)) {
        if (child.shadowRoot) scanRoot(child.shadowRoot);
        enqueue(child);
      }
      node = walker.nextNode();
    }
  }

  function start() {
    mo = new MutationObserver(onMutations);
    mo.observe(document, MO_OPTS);
    document.addEventListener("transitionend", onTransition, true);
    document.addEventListener("animationend", onTransition, true);
    document.addEventListener("focusin", onFocusChange, true);
    document.addEventListener("focusout", onFocusChange, true);
    scanRoot(document);
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => scanRoot(document), { once: true });
    }
    const settle = () => {
      scanRoot(document);
      reapplyAll();
    };
    if (document.readyState === "complete") {
      window.setTimeout(settle, 2500);
    } else {
      window.addEventListener("load", () => {
        settle();
        window.setTimeout(settle, 2500);
      }, { once: true });
    }
  }

  function reapplyAll() {
    for (const el of applied.keys()) enqueue(el);
  }

  function disableAll() {
    for (const [el, record] of applied) {
      restore(el, record);
      record.lastClip = record.clipPath;
      if (record.lastFilter !== null) record.lastFilter = record.filter;
      record.lastBorderColor = record.borderColor;
      record.lastBgImage = record.bg.image;
      if (record.lastBoxShadow !== null) record.lastBoxShadow = record.boxShadow;
    }
  }

  if (settings.enabled) start();

  return {
    setEnabled(enabled: boolean) {
      if (enabled === settings.enabled) return;
      settings.enabled = enabled;
      if (enabled) {
        if (!mo) start();
        else {
          reapplyAll();
          scanRoot(document);
        }
      } else {
        disableAll();
      }
    },
  };
}
