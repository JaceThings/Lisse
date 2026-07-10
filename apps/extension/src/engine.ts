import { observeResize, getLayoutSize } from "@lisse/core";
import {
  computeElementPlan,
  parseCornerRadius,
  isElliptical,
  pseudoEscapesBox,
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
/** Toggle morph duration: smoothing 0 ↔ target via native clip-path transition. */
const TOGGLE_MS = 300;
const TOGGLE_EASE = "cubic-bezier(0.2, 0, 0, 1)";

/** clip-path only interpolates when segment structures match; strip numbers. */
function shapeOf(d: string): string {
  return d.replace(/[-0-9.]+/g, "");
}
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
  const roots = new Set<Document | ShadowRoot>();
  let rafHandle: number | undefined;
  let mo: MutationObserver | undefined;

  function planFor(el: HTMLElement, smoothingOverride?: number): PlanResult | null {
    const cs = getComputedStyle(el);
    // Border-box floats; clip-path's default reference box is the border box.
    const { width: w, height: h } = getLayoutSize(el);
    if (isNaN(w) || isNaN(h)) return null;
    const read = readRadii(cs, w, h);
    if (!read) return null;

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
      smoothing: smoothingOverride ?? settings.smoothing,
    };
    return { plan: computeElementPlan(input), siteFilter, siteBorderColors, siteBg };
  }

  /** Write half of a plan (reads already done in the slice's read phase). */
  function writePlan(el: HTMLElement, result: PlanResult | null, force = false) {
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
    if (!force && record &&
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
  // flash square. Reads and writes are batched into separate phases per chunk
  // to avoid interleaved layout thrash.
  function flush() {
    rafHandle = undefined;
    if (!settings.enabled) {
      queue.clear();
      return;
    }
    const deadline = performance.now() + FRAME_BUDGET_MS;
    do {
      // Phase A — reads only.
      const ops: Array<{ el: HTMLElement; result: PlanResult | null }> = [];
      let n = 0;
      for (const el of queue) {
        queue.delete(el);
        ops.push({ el, result: el.isConnected ? planFor(el) : null });
        if (++n >= CHUNK) break;
      }
      // Phase B — writes only.
      for (const { el, result } of ops) writePlan(el, result);
    } while (queue.size > 0 && performance.now() < deadline);
    if (queue.size > 0) scheduleFlush();
  }

  function scanRoot(root: Document | ShadowRoot) {
    if (root instanceof ShadowRoot) roots.add(root);
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

  function scanSubtree(el: HTMLElement) {
    if (skip(el)) return;
    enqueue(el);
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT);
    let node = walker.nextNode() as HTMLElement | null;
    while (node) {
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
    mo.observe(document, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["style", "class"],
    });
    document.addEventListener("transitionend", onTransition, true);
    document.addEventListener("animationend", onTransition, true);
    scanRoot(document);
    // Safety net once the tree is complete; the seen-set keeps it cheap.
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => scanRoot(document), { once: true });
    }
  }

  function undoAll() {
    for (const el of [...applied.keys()]) undo(el);
  }

  function reapplyAll() {
    for (const el of [...applied.keys()]) enqueue(el);
  }

  // --- Toggle morph ---------------------------------------------------------
  // On/off animates smoothing 0 ↔ target through a native clip-path transition
  // (both endpoint paths must share segment structure — capsule blend-zone
  // elements don't, so they swap instantly). Border layers pop at the morph
  // boundary: background-image can't transition.
  // ponytail: reads run unsliced so the whole page morphs in sync — one-off,
  // user-initiated, bounded by MAX_STYLED.

  let toggleGen = 0;
  /** Inline transition we replaced, keyed while a morph is in flight. */
  const pendingTransition = new WeakMap<HTMLElement, string>();

  function augmentTransition(el: HTMLElement, computed: string) {
    if (!pendingTransition.has(el)) pendingTransition.set(el, el.style.transition);
    const ours = `clip-path ${TOGGLE_MS}ms ${TOGGLE_EASE}`;
    el.style.transition = computed && computed !== "none" ? `${computed}, ${ours}` : ours;
  }

  function settleTransition(el: HTMLElement) {
    const orig = pendingTransition.get(el);
    if (orig !== undefined) {
      el.style.transition = orig;
      pendingTransition.delete(el);
    }
  }

  function animateIn() {
    const gen = ++toggleGen;
    const ops: Array<{ el: HTMLElement; target: PlanResult; fromClip: string | null; transition: string }> = [];
    for (const el of [...applied.keys()]) {
      if (!el.isConnected) { undo(el); continue; }
      const target = planFor(el);
      if (!target || target.plan.action !== "apply") { writePlan(el, target); continue; }
      const from = planFor(el, 0);
      const fromClip =
        from && from.plan.action === "apply" && shapeOf(from.plan.clipPath) === shapeOf(target.plan.clipPath)
          ? from.plan.clipPath
          : null;
      ops.push({ el, target, fromClip, transition: getComputedStyle(el).transition });
    }
    const morphs = ops.filter((o) => {
      if (o.fromClip) return true;
      writePlan(o.el, o.target, true);
      return false;
    });
    // Start values for every element, then ONE forced recalc to commit them —
    // without it the browser coalesces start+target into a single style change
    // ('' → target isn't interpolable, so nothing would animate).
    for (const { el, target, fromClip } of morphs) {
      const record = applied.get(el)!;
      const plan = target.plan as Extract<typeof target.plan, { action: "apply" }>;
      // Quiet mid-morph replans (guard matches the post-morph state) so a
      // stray mutation doesn't rewrite the clip and kill the transition.
      record.lastClip = plan.clipPath;
      record.lastFilter = plan.filter ?? record.filter;
      record.lastBorderColor = plan.border ? "transparent" : record.borderColor;
      record.lastBgImage = plan.border ? plan.border.backgroundImage : record.bgImage;
      el.style.clipPath = fromClip!;
    }
    void document.documentElement.offsetWidth;
    for (const { el, target, transition } of morphs) {
      const plan = target.plan as Extract<typeof target.plan, { action: "apply" }>;
      augmentTransition(el, transition);
      el.style.clipPath = plan.clipPath;
      window.setTimeout(() => {
        if (gen !== toggleGen || !settings.enabled) return;
        settleTransition(el);
        writePlan(el, target, true); // border layer + filter land post-morph
      }, TOGGLE_MS + 60);
    }
  }

  // Disable restores styles but keeps records + observers so re-enable can
  // reapply — undo() would forget them, leaving nothing to re-enable.
  // Resetting lastX defeats writePlan()'s no-op guard on re-enable.
  function animateOut() {
    const gen = ++toggleGen;
    const ops: Array<{ el: HTMLElement; toClip: string | null; transition: string }> = [];
    for (const el of [...applied.keys()]) {
      if (!el.isConnected) { undo(el); continue; }
      const from = planFor(el, 0);
      const record = applied.get(el)!;
      const toClip =
        from && from.plan.action === "apply" && shapeOf(from.plan.clipPath) === shapeOf(record.lastClip)
          ? from.plan.clipPath
          : null;
      ops.push({ el, toClip, transition: getComputedStyle(el).transition });
    }
    for (const { el, toClip, transition } of ops) {
      const record = applied.get(el);
      if (!record) continue;
      const finish = () => {
        restore(el, record);
        settleTransition(el);
        record.lastClip = record.clipPath;
        record.lastFilter = record.filter;
        record.lastBorderColor = record.borderColor;
        record.lastBgImage = record.bgImage;
      };
      if (!toClip) { finish(); continue; }
      // Native border/backgrounds pop back first; the clip morphs out after.
      el.style.filter = record.filter;
      el.style.borderColor = record.borderColor;
      el.style.backgroundImage = record.bgImage;
      el.style.backgroundOrigin = record.bgOrigin;
      el.style.backgroundClip = record.bgClip;
      el.style.backgroundRepeat = record.bgRepeat;
      el.style.backgroundSize = record.bgSize;
      augmentTransition(el, transition);
      el.style.clipPath = toClip;
      window.setTimeout(() => {
        if (gen !== toggleGen || settings.enabled) return;
        finish();
      }, TOGGLE_MS + 60);
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
          animateIn();
          scanRoot(document); // catch elements added while disabled (seen-set keeps this cheap)
        }
      } else {
        animateOut();
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
