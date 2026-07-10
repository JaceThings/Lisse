import { observeResize, getLayoutSize } from "@lisse/core";
import {
  computeElementPlan,
  parseCornerRadius,
  isElliptical,
  pseudoEscapesBox,
  MIN_RADIUS,
  type Radii,
  type PlanInput,
  type BorderInput,
  type BackgroundInput,
} from "./plan.js";

export interface EngineSettings {
  enabled: boolean;
  smoothing: number;
}

/** Stop scanning once this many elements are styled — keeps big pages sane. */
const MAX_STYLED = 1500;
/** rAF slice: reads+writes for a frame, then yield if work remains. */
const FRAME_BUDGET_MS = 6;
/** Elements read/written per read-then-write chunk within a slice. */
const CHUNK = 32;

/** Four site-original border colours, reused on re-plan (our writes hide them). */
interface BorderColors {
  top: string;
  right: string;
  bottom: string;
  left: string;
}

interface Applied {
  // Original inline values, restored verbatim on undo/disable.
  clipPath: string;
  filter: string;
  borderColor: string;
  bgImage: string;
  bgOrigin: string;
  bgClip: string;
  bgRepeat: string;
  bgSize: string;
  // Site-original computed values, reused on re-plan: our own inline writes
  // corrupt the readback (transparent border, our data-URI background layer).
  siteFilter: string;
  siteBorderColors: BorderColors;
  siteBg: BackgroundInput;
  // What we last wrote, pre-serialisation — readback normalises values.
  lastClip: string;
  lastFilter: string;
  lastBorderColor: string;
  lastBgImage: string;
  unobserve: () => void;
}

interface PlanResult {
  plan: ReturnType<typeof computeElementPlan>;
  siteFilter: string;
  siteBorderColors: BorderColors;
  siteBg: BackgroundInput;
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

/** Descendants examined per candidate before assuming nothing escapes. */
const ESCAPE_SCAN_CAP = 200;

/**
 * A visible descendant sticking out of the border box gets amputated by
 * clip-path (GitHub avatar stacks: 20px avatars overflowing a 9px capsule
 * container; markdown-toolbar icons 3px above their comment form). Walks
 * descendants because escapes are often deep, capped so huge containers stay
 * cheap.
 * ponytail: beyond the cap we assume no escape — widen if real sites bite.
 */
function childrenEscapeBox(el: HTMLElement, cs: CSSStyleDeclaration): boolean {
  if (cs.overflowX !== "visible" && cs.overflowY !== "visible") return false;
  if (el.childElementCount === 0) return false;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return false;
  const eps = 0.6;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT);
  let node = walker.nextNode() as Element | null;
  let seen = 0;
  while (node && seen++ < ESCAPE_SCAN_CAP) {
    const kr = node.getBoundingClientRect();
    if (kr.width > 0 && kr.height > 0 &&
        (kr.left < r.left - eps || kr.top < r.top - eps ||
         kr.right > r.right + eps || kr.bottom > r.bottom + eps)) {
      const kcs = getComputedStyle(node);
      // visibility inherits, so one check covers hidden subtrees; fixed
      // descendants are viewport-anchored portals, not box content.
      if (kcs.visibility !== "hidden" && kcs.opacity !== "0" && kcs.position !== "fixed") {
        return true;
      }
    }
    node = walker.nextNode() as Element | null;
  }
  return false;
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
  let settings = { ...initial };
  const applied = new Map<HTMLElement, Applied>();
  const seen = new WeakSet<HTMLElement>();
  const queue = new Set<HTMLElement>();
  // MutationObserver on `document` cannot see inside shadow roots, so every
  // discovered root gets observed individually (Reddit-class apps mutate
  // almost exclusively inside shadow DOM).
  const observedRoots = new WeakSet<ShadowRoot>();
  let rafHandle: number | undefined;
  let mo: MutationObserver | undefined;

  const MO_OPTS: MutationObserverInit = {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["style", "class"],
  };

  function planFor(el: HTMLElement): PlanResult | null {
    const cs = getComputedStyle(el);
    // Border-box floats; clip-path's default reference box is the border box.
    const { width: w, height: h } = getLayoutSize(el);
    if (isNaN(w) || isNaN(h)) return null;
    const read = readRadii(cs, w, h);
    if (!read) return null;
    // Bail before the expensive reads (pseudo styles, descendant rects) —
    // most mutation-enqueued elements have negligible radius.
    const { tl, tr, br, bl } = read.radii;
    if (Math.max(tl, tr, br, bl) < MIN_RADIUS) return null;

    const record = applied.get(el);
    // Filter, border colour, and background readback are all polluted once we
    // write our own values, so on re-plan we reuse the originals from the record.
    const siteFilter = record ? record.siteFilter : cs.filter;
    const siteBorderColors: BorderColors = record ? record.siteBorderColors : {
      top: cs.borderTopColor,
      right: cs.borderRightColor,
      bottom: cs.borderBottomColor,
      left: cs.borderLeftColor,
    };
    const siteBg: BackgroundInput = record ? record.siteBg : {
      image: cs.backgroundImage,
      origin: cs.backgroundOrigin,
      clip: cs.backgroundClip,
      repeat: cs.backgroundRepeat,
      size: cs.backgroundSize,
    };

    const input: PlanInput = {
      width: w,
      height: h,
      radii: read.radii,
      elliptical: read.elliptical,
      border: readBorder(cs, siteBorderColors),
      hasBorderImage: cs.borderImageSource !== "none" && cs.borderImageSource !== "",
      background: siteBg,
      pseudoOutside: pseudoOutside(el, w, h),
      childOutside: childrenEscapeBox(el, cs),
      boxShadow: cs.boxShadow,
      existingFilter: siteFilter,
      smoothing: settings.smoothing,
    };
    return { plan: computeElementPlan(input), siteFilter, siteBorderColors, siteBg };
  }

  /** Write half of a plan (reads already done in the slice's read phase). */
  function writePlan(el: HTMLElement, result: PlanResult | null) {
    if (!result || result.plan.action !== "apply") {
      if (applied.has(el)) undo(el);
      return;
    }
    const { plan } = result;
    const record = applied.get(el);
    const origClip = record ? record.clipPath : el.style.clipPath;
    const origFilter = record ? record.filter : el.style.filter;
    const origBorderColor = record ? record.borderColor : el.style.borderColor;
    const origBgImage = record ? record.bgImage : el.style.backgroundImage;
    const origBgOrigin = record ? record.bgOrigin : el.style.backgroundOrigin;
    const origBgClip = record ? record.bgClip : el.style.backgroundClip;
    const origBgRepeat = record ? record.bgRepeat : el.style.backgroundRepeat;
    const origBgSize = record ? record.bgSize : el.style.backgroundSize;

    const b = plan.border;
    const targetFilter = plan.filter ?? origFilter;
    const targetBorderColor = b ? "transparent" : origBorderColor;
    const targetBgImage = b ? b.backgroundImage : origBgImage;

    // Our writes re-trigger the MutationObserver (it fires async, so a flag
    // can't intercept them) — skipping no-op writes breaks the feedback loop.
    // Compare against what we last wrote, not readback: data URIs and colours
    // re-serialise and won't match.
    if (record &&
        record.lastClip === plan.clipPath &&
        record.lastFilter === targetFilter &&
        record.lastBorderColor === targetBorderColor &&
        record.lastBgImage === targetBgImage) {
      return;
    }

    el.style.clipPath = plan.clipPath;
    el.style.filter = targetFilter;

    // Only touch border/background when a border layer is (or was) in play.
    if (b || (record && record.lastBorderColor === "transparent")) {
      el.style.borderColor = targetBorderColor;
      el.style.backgroundImage = targetBgImage;
      el.style.backgroundOrigin = b ? b.backgroundOrigin : origBgOrigin;
      el.style.backgroundClip = b ? b.backgroundClip : origBgClip;
      el.style.backgroundRepeat = b ? b.backgroundRepeat : origBgRepeat;
      el.style.backgroundSize = b ? b.backgroundSize : origBgSize;
    }

    if (record) {
      record.lastClip = plan.clipPath;
      record.lastFilter = targetFilter;
      record.lastBorderColor = targetBorderColor;
      record.lastBgImage = targetBgImage;
    } else {
      const unobserve = observeResize(el, () => enqueue(el));
      applied.set(el, {
        clipPath: origClip,
        filter: origFilter,
        borderColor: origBorderColor,
        bgImage: origBgImage,
        bgOrigin: origBgOrigin,
        bgClip: origBgClip,
        bgRepeat: origBgRepeat,
        bgSize: origBgSize,
        siteFilter: result.siteFilter,
        siteBorderColors: result.siteBorderColors,
        siteBg: result.siteBg,
        lastClip: plan.clipPath,
        lastFilter: targetFilter,
        lastBorderColor: targetBorderColor,
        lastBgImage: targetBgImage,
        unobserve,
      });
    }
  }

  function restore(el: HTMLElement, record: Applied) {
    el.style.clipPath = record.clipPath;
    el.style.filter = record.filter;
    el.style.borderColor = record.borderColor;
    el.style.backgroundImage = record.bgImage;
    el.style.backgroundOrigin = record.bgOrigin;
    el.style.backgroundClip = record.bgClip;
    el.style.backgroundRepeat = record.bgRepeat;
    el.style.backgroundSize = record.bgSize;
  }

  function undo(el: HTMLElement) {
    const record = applied.get(el);
    if (!record) return;
    restore(el, record);
    record.unobserve();
    applied.delete(el);
  }

  function skip(el: Element): boolean {
    const tag = el.tagName;
    return tag === "SVG" || tag === "svg" || tag === "HTML" || tag === "BODY" ||
      el.namespaceURI === "http://www.w3.org/2000/svg";
  }

  function enqueue(el: HTMLElement) {
    queue.add(el);
    scheduleFlush();
  }

  function scheduleFlush() {
    if (rafHandle !== undefined) return;
    const raf = window.requestAnimationFrame ??
      ((cb: FrameRequestCallback) => window.setTimeout(() => cb(performance.now()), 16));
    rafHandle = raf(flush);
  }

  // rAF runs before paint, so elements styled in the frame they arrive never
  // flash square. ALL reads run before ANY write — write-then-read across
  // chunks would force a layout recomputation per chunk.
  function flush() {
    rafHandle = undefined;
    if (!settings.enabled) {
      queue.clear();
      return;
    }
    const deadline = performance.now() + FRAME_BUDGET_MS;
    // Phase A — reads only, deadline checked every CHUNK elements.
    const ops: Array<{ el: HTMLElement; result: PlanResult | null }> = [];
    let n = 0;
    for (const el of queue) {
      queue.delete(el);
      ops.push({ el, result: el.isConnected ? planFor(el) : null });
      if (++n % CHUNK === 0 && performance.now() >= deadline) break;
    }
    // Phase B — writes only; no layout reads follow.
    for (const { el, result } of ops) writePlan(el, result);
    if (queue.size > 0) scheduleFlush();
  }

  function scanRoot(root: Document | ShadowRoot) {
    if (root instanceof ShadowRoot && mo && !observedRoots.has(root)) {
      observedRoots.add(root);
      mo.observe(root, MO_OPTS);
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let node = walker.nextNode() as Element | null;
    while (node) {
      if (applied.size + queue.size >= MAX_STYLED) break;
      const el = node as HTMLElement;
      node = walker.nextNode() as Element | null;
      if (skip(el)) continue;
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
        const el = rec.target as HTMLElement;
        if (el.nodeType === 1 && !skip(el)) enqueue(el);
      } else {
        // Re-plan the parent too: a new child may now escape its box (or an
        // escaping one may be gone), flipping the child-outside verdict.
        const parent = rec.target as HTMLElement;
        if (parent.nodeType === 1 && !skip(parent)) enqueue(parent);
        for (const added of rec.addedNodes) {
          if (added.nodeType !== 1) continue;
          const el = added as HTMLElement;
          if (el.shadowRoot) scanRoot(el.shadowRoot);
          scanSubtree(el);
        }
        for (const removed of rec.removedNodes) {
          if (removed.nodeType !== 1) continue;
          walkApplied(removed as HTMLElement, undo);
        }
      }
    }
  }

  // Animated hover/state changes (radius, size, colours) surface here; the
  // composedPath target crosses shadow boundaries. Instant (non-animated)
  // pseudo-class changes fire no DOM signal — that's the tracking ceiling.
  // ponytail: no coverage for instant :hover restyles; accept it.
  function onTransition(e: Event) {
    if (!settings.enabled) return;
    const t = e.composedPath()[0] as Node | undefined;
    if (t && t.nodeType === 1 && !skip(t as Element)) enqueue(t as HTMLElement);
  }

  // Same MAX_STYLED cap as scanRoot — a SPA route change can add thousands of
  // elements in one mutation batch, which would otherwise all hit planFor.
  function scanSubtree(el: HTMLElement) {
    if (skip(el)) return;
    if (applied.size + queue.size >= MAX_STYLED) return;
    enqueue(el);
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT);
    let node = walker.nextNode() as HTMLElement | null;
    while (node) {
      if (applied.size + queue.size >= MAX_STYLED) break;
      if (!skip(node)) {
        if (node.shadowRoot) scanRoot(node.shadowRoot);
        enqueue(node);
      }
      node = walker.nextNode() as HTMLElement | null;
    }
  }

  function walkApplied(el: HTMLElement, fn: (el: HTMLElement) => void) {
    if (applied.has(el)) fn(el);
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT);
    let node = walker.nextNode() as HTMLElement | null;
    while (node) {
      if (applied.has(node)) fn(node);
      node = walker.nextNode() as HTMLElement | null;
    }
  }

  function start() {
    // At document_start documentElement may be absent, so observe the document
    // node — the parser then streams elements in as childList mutations.
    mo = new MutationObserver(onMutations);
    mo.observe(document, MO_OPTS);
    document.addEventListener("transitionend", onTransition, true);
    document.addEventListener("animationend", onTransition, true);
    scanRoot(document);
    // Safety nets once the tree is complete; the seen-set and the plan memo
    // keep these cheap. The delayed settle pass re-plans everything applied:
    // SPA hydration can invalidate a verdict (size, escaping children) with
    // no signal any observer delivers.
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => scanRoot(document), { once: true });
    }
    const settle = () => {
      scanRoot(document);
      for (const el of applied.keys()) enqueue(el);
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

  function undoAll() {
    for (const el of [...applied.keys()]) undo(el);
  }

  function reapplyAll() {
    for (const el of [...applied.keys()]) enqueue(el);
  }

  // Disable restores styles but keeps records + observers so re-enable can
  // reapply — undo() would forget them, leaving nothing to re-enable.
  // Resetting lastX defeats writePlan()'s no-op guard on re-enable.
  function disableAll() {
    for (const [el, record] of applied) {
      restore(el, record);
      record.lastClip = record.clipPath;
      record.lastFilter = record.filter;
      record.lastBorderColor = record.borderColor;
      record.lastBgImage = record.bgImage;
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
          scanRoot(document); // catch elements added while disabled (seen-set keeps this cheap)
        }
      } else {
        disableAll();
      }
    },
    setSmoothing(smoothing: number) {
      settings.smoothing = smoothing;
      reapplyAll();
    },
    destroy() {
      mo?.disconnect();
      mo = undefined;
      document.removeEventListener("transitionend", onTransition, true);
      document.removeEventListener("animationend", onTransition, true);
      if (rafHandle !== undefined) {
        (window.cancelAnimationFrame ?? window.clearTimeout)(rafHandle);
        rafHandle = undefined;
      }
      undoAll();
    },
  };
}
