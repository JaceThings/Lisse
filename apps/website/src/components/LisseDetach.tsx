// "Lisse" pops off the wall after 22 clicks. The heading reserves its
// own space throughout (visibility:hidden — never display:none), so the
// definition row never reflows. The flying word lives in a body-level
// portal to escape future stacking contexts; a chalky ghost overlay
// marks its original slot.
//
// Physics is delegated to matter.js: a single dynamic rectangle body
// for the word, four static walls around the viewport, and a high-
// stiffness Constraint that acts as a "pin" between the cursor and a
// chosen point on the body for the dangle. Self-righting, restitution,
// momentum on release, and contact friction all fall out of the rigid-
// body simulation — the previous hand-rolled gravity + pendulum +
// righting-torque code accumulated too many sign-error edge cases.

import Matter from "matter-js";
import {
  motion,
  useAnimationControls,
  useAnimationFrame,
  useMotionValue,
  useReducedMotion,
  animate,
  type AnimationPlaybackControls,
} from "framer-motion";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { playLissePronunciation } from "../lib/sounds.ts";

const THRESHOLD = 22;
const WOBBLE_START = 8;
const IDLE_GRACE_MS = 1500;
const DECAY_INTERVAL_MS = 800;
const HARD_RESET_MS = 8000;

const WOBBLE_MAX_ROT_DEG = 4;
const WOBBLE_MAX_TRANS_PX = 2;
const WOBBLE_DURATION_S = 0.18;

// Matter.js's default `gravity.scale` is 1e-3 with `gravity.y` of 1,
// tuned for a 60 fps fixed step. Crank it up so a 33×16-px word feels
// weighty rather than floaty on a tall viewport — the eye expects the
// fall to take ~0.6 s, not 1.3 s. Tuned by visual feel: any higher and
// the word arrives before the bounce reads.
const GRAVITY_SCALE = 3.6e-3;
const RESTITUTION = 0.42;
const BODY_FRICTION = 0.35;       // sliding friction at the floor
const BODY_FRICTION_AIR = 0.018;  // linear+angular drag in flight
const BODY_DENSITY = 0.0015;

// Walls are static rectangles 50 px thick, placed flush with the four
// viewport edges. Thick enough that a high-velocity throw can't tunnel.
const WALL_THICKNESS = 50;

const DETACH_INITIAL_VY = -3;     // px / step ≈ −180 px/s at 60 fps
const DETACH_KICK_MAX = 1.5;      // px / step
const DETACH_KICK_MIN = 0.7;

const SNAP_RADIUS_PX = 32;        // centre-to-centre for the re-hang test
const SNAP_SPRING = { type: "spring" as const, stiffness: 420, damping: 22, mass: 0.9 };

const AUTO_REHANG_MS = 12_000;

const MAX_DT_MS = 32;             // tab-switch / long-frame clamp

// matter.js stores velocities in px-per-step / rad-per-step (60 fps).
// Cap them to keep a sudden cursor jump from whipping the small (33×16-
// px) body into a blur. Picked to allow any realistic human flick.
const MAX_OMEGA_PER_STEP = 0.32;   // ≈ 1100 deg/s at 60 fps
const MAX_VEL_PER_STEP = 28;       // ≈ 1700 px/s at 60 fps

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

interface Origin {
  /** Viewport-space pre-detach rect. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Computed styles copied onto the flying clone so it matches pixel-for-pixel.
   *  Individual properties, NOT the `font` shorthand — the shorthand normalises
   *  non-standard weights (the heading is 550) to the nearest keyword and the
   *  clone renders subtly bolder than the original. */
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  fontStyle: string;
  fontStretch: string;
  fontVariantNumeric: string;
  fontFeatureSettings: string;
  letterSpacing: string;
  lineHeight: string;
  color: string;
}

interface DetachState {
  origin: Origin;
  initialVel: { x: number; y: number };
}

export function useLisseDetach() {
  const reduced = useReducedMotion();
  const [detach, setDetach] = useState<DetachState | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const wobble = useAnimationControls();

  const countRef = useRef(0);
  const decayTimerRef = useRef<number | null>(null);
  const resetTimerRef = useRef<number | null>(null);

  const cancelTimers = () => {
    if (decayTimerRef.current !== null) {
      clearTimeout(decayTimerRef.current);
      decayTimerRef.current = null;
    }
    if (resetTimerRef.current !== null) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
  };

  // Decay schedule: 1.5s of idle, then -1 every 800ms. Hard reset to 0
  // at 8s of inactivity regardless of how many decay ticks fired.
  const scheduleDecay = useCallback(() => {
    cancelTimers();
    const tickDown = () => {
      countRef.current = Math.max(0, countRef.current - 1);
      if (countRef.current > 0) {
        decayTimerRef.current = window.setTimeout(tickDown, DECAY_INTERVAL_MS);
      }
    };
    decayTimerRef.current = window.setTimeout(tickDown, IDLE_GRACE_MS);
    resetTimerRef.current = window.setTimeout(() => {
      countRef.current = 0;
      cancelTimers();
    }, HARD_RESET_MS);
  }, []);

  useEffect(() => cancelTimers, []);

  const measure = (el: HTMLElement): Origin => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return {
      x: r.left,
      y: r.top,
      w: r.width,
      h: r.height,
      fontFamily: s.fontFamily,
      fontSize: s.fontSize,
      fontWeight: s.fontWeight,
      fontStyle: s.fontStyle,
      fontStretch: s.fontStretch,
      fontVariantNumeric: s.fontVariantNumeric,
      fontFeatureSettings: s.fontFeatureSettings,
      letterSpacing: s.letterSpacing,
      lineHeight: s.lineHeight,
      color: s.color,
    };
  };

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLHeadingElement>) => {
      // While detached the heading is an empty hole — clicks there must
      // not fire pronunciation (no sound, no counter, no wobble).
      if (detach) return;
      playLissePronunciation();
      if (reduced) return;

      const next = countRef.current + 1;
      countRef.current = next;
      scheduleDecay();

      if (next >= THRESHOLD) {
        // Snap rotation to zero before measuring so a residual wobble
        // doesn't bake a tilt into the floating clone's start frame.
        wobble.stop();
        wobble.set({ rotate: 0, x: 0 });
        const el = headingRef.current;
        if (!el) return;
        const origin = measure(el);
        const offsetX =
          clamp((e.clientX - (origin.x + origin.w / 2)) / (origin.w / 2), -1, 1);
        // Direction follows offset; magnitude scales but stays above
        // DETACH_KICK_MIN so a perfectly-centred click still drifts.
        const kickMag = lerp(DETACH_KICK_MIN, DETACH_KICK_MAX, Math.abs(offsetX));
        const kickSign = offsetX === 0 ? (Math.random() < 0.5 ? -1 : 1) : Math.sign(offsetX);
        setDetach({
          origin,
          initialVel: { x: kickMag * kickSign, y: DETACH_INITIAL_VY },
        });
        cancelTimers();
        countRef.current = 0;
        return;
      }

      if (next >= WOBBLE_START) {
        const t = Math.pow((next - WOBBLE_START) / (THRESHOLD - WOBBLE_START), 0.6);
        const A = lerp(0.4, WOBBLE_MAX_ROT_DEG, t);
        const T = lerp(0.3, WOBBLE_MAX_TRANS_PX, t);
        wobble.start({
          rotate: [0, A, -A, A * 0.6, 0],
          x: [0, T, -T, 0],
          transition: { duration: WOBBLE_DURATION_S },
        });
      }
    },
    [reduced, detach, scheduleDecay, wobble],
  );

  const onRehang = useCallback(() => setDetach(null), []);

  return { detach, headingRef, wobble, handleClick, onRehang };
}

// ---------------------------------------------------------------------------

interface LisseFloaterProps {
  origin: Origin;
  initialVel: { x: number; y: number };
  onRehang: () => void;
}

export function LisseFloater({ origin, initialVel, onRehang }: LisseFloaterProps) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useMotionValue(0);
  const elementRef = useRef<HTMLSpanElement | null>(null);

  // matter.js refs — engine, body, walls, drag constraint.
  const engineRef = useRef<Matter.Engine | null>(null);
  const bodyRef = useRef<Matter.Body | null>(null);
  const wallsRef = useRef<Matter.Body[]>([]);
  const dragConstraintRef = useRef<Matter.Constraint | null>(null);

  // Drag state outside matter — for snap-back proximity, cursor capture.
  const pointerIdRef = useRef<number | null>(null);
  const draggingRef = useRef(false);
  const lastRestStartRef = useRef<number | null>(null);

  // Snap-back animation refs (rehang spring on translation + rotation).
  const phaseRef = useRef<"sim" | "snapping">("sim");
  const snapAnimX = useRef<AnimationPlaybackControls | null>(null);
  const snapAnimY = useRef<AnimationPlaybackControls | null>(null);
  const snapAnimR = useRef<AnimationPlaybackControls | null>(null);

  // ----- Build the matter world once on mount ------------------------------
  // We compute viewport-space walls and seed the body at the heading's
  // measured position so the first frame already has the word on the wall.
  useEffect(() => {
    const engine = Matter.Engine.create({
      gravity: { x: 0, y: 1, scale: GRAVITY_SCALE },
      enableSleeping: true,
    });
    engineRef.current = engine;

    const body = Matter.Bodies.rectangle(
      origin.x + origin.w / 2,
      origin.y + origin.h / 2,
      origin.w,
      origin.h,
      {
        restitution: RESTITUTION,
        friction: BODY_FRICTION,
        frictionAir: BODY_FRICTION_AIR,
        density: BODY_DENSITY,
        // sleepThreshold drops to ~30 frames so the word latches into
        // a clean rest after a couple of bounces — without this, the
        // restitution alone leaves it micro-oscillating on the floor.
        sleepThreshold: 30,
      },
    );
    // Initial impulse: tiny upward kick + horizontal drift from click offset.
    Matter.Body.setVelocity(body, { x: initialVel.x, y: initialVel.y });
    bodyRef.current = body;

    const buildWalls = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const t = WALL_THICKNESS;
      const opts: Matter.IChamferableBodyDefinition = {
        isStatic: true,
        restitution: RESTITUTION,
        friction: BODY_FRICTION,
      };
      return [
        Matter.Bodies.rectangle(vw / 2, -t / 2, vw + 2 * t, t, opts),       // top
        Matter.Bodies.rectangle(vw / 2, vh + t / 2, vw + 2 * t, t, opts),    // bottom
        Matter.Bodies.rectangle(-t / 2, vh / 2, t, vh + 2 * t, opts),        // left
        Matter.Bodies.rectangle(vw + t / 2, vh / 2, t, vh + 2 * t, opts),    // right
      ];
    };
    wallsRef.current = buildWalls();
    Matter.World.add(engine.world, [body, ...wallsRef.current]);

    const onResize = () => {
      Matter.World.remove(engine.world, wallsRef.current);
      wallsRef.current = buildWalls();
      Matter.World.add(engine.world, wallsRef.current);
      // Wake the body so a now-out-of-bounds rest position gets shoved
      // back inside by the contact solver on the next step.
      Matter.Sleeping.set(body, false);
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      if (dragConstraintRef.current) {
        Matter.World.remove(engine.world, dragConstraintRef.current);
      }
      Matter.World.clear(engine.world, false);
      Matter.Engine.clear(engine);
      engineRef.current = null;
      bodyRef.current = null;
      wallsRef.current = [];
      dragConstraintRef.current = null;
    };
    // origin/initialVel are captured at mount; later changes don't
    // remount the floater (the parent unmounts/remounts via `detach`).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----- Step the simulation each animation frame --------------------------
  useAnimationFrame((_, deltaMs) => {
    const engine = engineRef.current;
    const body = bodyRef.current;
    if (!engine || !body) return;
    if (phaseRef.current === "snapping") return;

    const dt = Math.min(deltaMs, MAX_DT_MS);
    Matter.Engine.update(engine, dt);

    // Velocity caps — fixed in matter's per-step units, applied after
    // every integration step (not just before drag). Without this a
    // fast cursor flick whips the body into hundreds of rotations/sec.
    const av = body.angularVelocity;
    if (Math.abs(av) > MAX_OMEGA_PER_STEP) {
      Matter.Body.setAngularVelocity(
        body,
        Math.sign(av) * MAX_OMEGA_PER_STEP,
      );
    }
    const vx = body.velocity.x;
    const vy = body.velocity.y;
    const sp2 = vx * vx + vy * vy;
    if (sp2 > MAX_VEL_PER_STEP * MAX_VEL_PER_STEP) {
      const sp = Math.sqrt(sp2);
      Matter.Body.setVelocity(body, {
        x: (vx * MAX_VEL_PER_STEP) / sp,
        y: (vy * MAX_VEL_PER_STEP) / sp,
      });
    }

    // Translate body world position into the motion values used by the
    // rendered span. (x, y) is offset from the heading's original centre.
    const cx0 = origin.x + origin.w / 2;
    const cy0 = origin.y + origin.h / 2;
    x.set(body.position.x - cx0);
    y.set(body.position.y - cy0);
    rotate.set((body.angle * 180) / Math.PI);

    // Track sleeping-onset for auto-rehang.
    if (body.isSleeping) {
      if (lastRestStartRef.current === null) {
        lastRestStartRef.current = performance.now();
      }
    } else {
      lastRestStartRef.current = null;
    }
  });

  // ----- Rehang: spring translation + rotation back to zero ----------------
  const triggerRehang = useCallback(() => {
    if (phaseRef.current === "snapping") return;
    phaseRef.current = "snapping";
    const body = bodyRef.current;
    if (body) {
      // Freeze the body so the engine doesn't fight the spring.
      Matter.Body.setStatic(body, true);
    }
    snapAnimX.current?.stop();
    snapAnimY.current?.stop();
    snapAnimR.current?.stop();
    snapAnimX.current = animate(x, 0, SNAP_SPRING);
    snapAnimY.current = animate(y, 0, {
      ...SNAP_SPRING,
      onComplete: () => onRehang(),
    });
    snapAnimR.current = animate(rotate, 0, SNAP_SPRING);
  }, [x, y, rotate, onRehang]);

  // Auto-rehang after AUTO_REHANG_MS of continuous sleep.
  useEffect(() => {
    const id = window.setInterval(() => {
      const since = lastRestStartRef.current;
      if (since !== null && performance.now() - since >= AUTO_REHANG_MS) {
        triggerRehang();
      }
    }, 500);
    return () => clearInterval(id);
  }, [triggerRehang]);

  // Escape always re-hangs.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") triggerRehang();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [triggerRehang]);

  // ----- Pointer handlers --------------------------------------------------
  // Drag = high-stiffness Constraint between the cursor (world) and the
  // grabbed point on the body (local). Releases give matter the body's
  // accumulated linear + angular velocity for free — no manual sampling.
  const onPointerDown = (e: React.PointerEvent<HTMLSpanElement>) => {
    const body = bodyRef.current;
    const engine = engineRef.current;
    if (!body || !engine) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointerIdRef.current = e.pointerId;
    draggingRef.current = true;

    // Wake the body so the engine integrates the drag impulses immediately.
    Matter.Sleeping.set(body, false);

    // Cursor in world → grab-point in body-local. matter applies
    // constraint pointB in BODY-LOCAL coords (NOT axis-aligned local —
    // pre-rotated by the body's current angle). For pointB we want the
    // offset from body centre at the un-rotated frame, so we counter-
    // rotate the (cursor − centre) world vector by −body.angle.
    const dx = e.clientX - body.position.x;
    const dy = e.clientY - body.position.y;
    const a = -body.angle;
    const cs = Math.cos(a);
    const sn = Math.sin(a);
    const lx = dx * cs - dy * sn;
    const ly = dx * sn + dy * cs;

    // Soft-ish spring: stiff enough that the grab point tracks the
    // cursor visibly, soft enough that a sudden cursor jump doesn't
    // whip the body. The lag IS the dangle.
    const constraint = Matter.Constraint.create({
      pointA: { x: e.clientX, y: e.clientY },
      bodyB: body,
      pointB: { x: lx, y: ly },
      length: 0,
      stiffness: 0.45,
      damping: 0.25,
    });
    dragConstraintRef.current = constraint;
    Matter.World.add(engine.world, constraint);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLSpanElement>) => {
    if (pointerIdRef.current !== e.pointerId) return;
    const constraint = dragConstraintRef.current;
    if (!constraint) return;
    constraint.pointA = { x: e.clientX, y: e.clientY };
  };

  const endDrag = () => {
    pointerIdRef.current = null;
    draggingRef.current = false;
    const engine = engineRef.current;
    const body = bodyRef.current;
    if (engine && dragConstraintRef.current) {
      Matter.World.remove(engine.world, dragConstraintRef.current);
      dragConstraintRef.current = null;
    }
    if (!body) return;

    // Snap if the body is currently close to the original slot.
    if (Math.hypot(x.get(), y.get()) < SNAP_RADIUS_PX) {
      triggerRehang();
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLSpanElement>) => {
    if (pointerIdRef.current !== e.pointerId) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    endDrag();
  };

  const onPointerCancel = (e: React.PointerEvent<HTMLSpanElement>) => {
    if (pointerIdRef.current !== e.pointerId) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    endDrag();
  };

  const styleBase: CSSProperties = {
    position: "fixed",
    top: origin.y,
    left: origin.x,
    width: origin.w,
    height: origin.h,
    fontFamily: origin.fontFamily,
    fontSize: origin.fontSize,
    fontWeight: origin.fontWeight,
    fontStyle: origin.fontStyle,
    fontStretch: origin.fontStretch,
    fontVariantNumeric: origin.fontVariantNumeric,
    fontFeatureSettings: origin.fontFeatureSettings,
    letterSpacing: origin.letterSpacing,
    lineHeight: origin.lineHeight,
    color: origin.color,
    margin: 0,
    padding: 0,
    touchAction: "none",
    userSelect: "none",
    WebkitUserSelect: "none",
    cursor: "grab",
    zIndex: 50,
    willChange: "transform",
    transformOrigin: "50% 50%",
  };

  return createPortal(
    <motion.span
      ref={elementRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      whileTap={{ cursor: "grabbing" }}
      style={{ ...styleBase, x, y, rotate }}
      aria-hidden
    >
      lisse
    </motion.span>,
    document.body,
  );
}

// ---------------------------------------------------------------------------

/** Chalky outline of where "lisse" used to hang. Sits over the
 *  visibility:hidden original so the heading row reserves its width. */
export function LisseGhost() {
  return (
    <span
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        color: "transparent",
        WebkitTextStroke: "0.5px rgba(0, 0, 0, 0.18)",
        textShadow:
          "0 1px 0 rgba(255, 255, 255, 0.6), 0 0 2px rgba(0, 0, 0, 0.06)",
        mixBlendMode: "multiply",
        filter: "blur(0.15px)",
        pointerEvents: "none",
      }}
    >
      lisse
    </span>
  );
}
