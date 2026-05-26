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
const RESTITUTION = 0.62;         // applied to our manual bounce override —
                                  // matter's own restitution gets clobbered
                                  // by its position-correction step
const WALL_FRICTION_TANGENT = 0.8; // tangential damping on each bounce
const BODY_FRICTION = 0.35;       // sliding friction at the floor
const BODY_FRICTION_AIR = 0.018;  // linear+angular drag in flight
const BODY_DENSITY = 0.0015;
// matter.js's default sleepThreshold is 60 frames of low motion. Raise
// it so a couple of small bounces play out before the body latches —
// otherwise the first floor contact reads as a hard stop, not a bounce.
const SLEEP_THRESHOLD_FRAMES = 100;

// Walls are static rectangles 50 px thick, placed flush with the four
// viewport edges. Thick enough that a high-velocity throw can't tunnel.
const WALL_THICKNESS = 50;

const DETACH_INITIAL_VY = -3;     // px / step ≈ −180 px/s at 60 fps
const DETACH_KICK_MAX = 1.5;      // px / step
const DETACH_KICK_MIN = 0.7;

const SNAP_RADIUS_PX = 32;        // centre-to-centre for the re-hang test
const SNAP_SPRING = { type: "spring" as const, stiffness: 420, damping: 22, mass: 0.9 };

// Magnetic snap zone — when the cursor enters this radius around the
// original slot, the drag-constraint's anchor is biased toward the
// origin, so the word "itches" home and the user gets a wider, more
// forgiving drop zone. sqrt (ease-out) falloff: barely felt at the
// edge, decisively grabby once the user crosses ~halfway in.
const MAGNETIC_RADIUS_PX = 110;
const MAGNET_PULL_FACTOR = 0.65;

// Minimum time the word must spend off the wall before the user can
// re-hang it by drag. Without this, releasing near origin during the
// initial pop fires snap-back instantly and the whole detach reads as
// an accidental click. The user still gets Escape and the auto-rehang
// timer, which are explicit, so this only gates the proximity snap.
const MIN_DETACH_MS = 1400;

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

  const fireDetach = useCallback(
    (clientX: number) => {
      // Snap rotation to zero before measuring so a residual wobble
      // doesn't bake a tilt into the floating clone's start frame.
      wobble.stop();
      wobble.set({ rotate: 0, x: 0 });
      const el = headingRef.current;
      if (!el) return;
      const origin = measure(el);
      const offsetX =
        clamp((clientX - (origin.x + origin.w / 2)) / (origin.w / 2), -1, 1);
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
    },
    [wobble],
  );

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLHeadingElement>) => {
      // While detached the heading is an empty hole — clicks there must
      // not fire pronunciation (no sound, no counter, no wobble).
      if (detach) return;
      playLissePronunciation();
      if (reduced) return;

      // Cmd/Ctrl + click bypasses the 22-click threshold and detaches
      // immediately — a debug-and-delight shortcut for people who
      // already know about the easter egg.
      if (e.metaKey || e.ctrlKey) {
        fireDetach(e.clientX);
        return;
      }

      const next = countRef.current + 1;
      countRef.current = next;
      scheduleDecay();

      if (next >= THRESHOLD) {
        fireDetach(e.clientX);
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
    [reduced, detach, scheduleDecay, wobble, fireDetach],
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
  const detachedAtRef = useRef(performance.now());
  // Cursor history during drag, used to compute the throw velocity at
  // release. The constraint's soft spring lags behind the cursor, so the
  // body's intrinsic velocity on release is much smaller than what the
  // user expects from a flick — we override it with the cursor's actual
  // recent velocity.
  const cursorTrailRef = useRef<{ x: number; y: number; t: number }[]>([]);

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
        sleepThreshold: SLEEP_THRESHOLD_FRAMES,
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
    // Capture pre-step velocity so we can detect matter's bounce-eating
    // and override with our own restitution on hard impacts.
    const preVx = body.velocity.x;
    const preVy = body.velocity.y;
    Matter.Engine.update(engine, dt);

    // Manual bounce override. matter.js's solver absorbs most of the
    // bounce on a hard impact (apparent restitution ~0.13 against the
    // configured RESTITUTION) because position correction reshuffles
    // velocity. Detect wall-direction impacts by checking the body's
    // bounds AND that the pre-step velocity was going INTO that wall,
    // then reflect with our own restitution.
    if (!draggingRef.current) {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const b = body.bounds;
      const postVx = body.velocity.x;
      const postVy = body.velocity.y;
      const IMPACT_THRESHOLD = 3; // px/step minimum to trigger a bounce
      let bx = postVx;
      let by = postVy;
      let bounced = false;
      if (b.max.y >= vh - 1 && preVy > IMPACT_THRESHOLD) {
        by = -preVy * RESTITUTION;
        bx = postVx * WALL_FRICTION_TANGENT;
        bounced = true;
      } else if (b.min.y <= 1 && preVy < -IMPACT_THRESHOLD) {
        by = -preVy * RESTITUTION;
        bx = postVx * WALL_FRICTION_TANGENT;
        bounced = true;
      }
      if (b.min.x <= 1 && preVx < -IMPACT_THRESHOLD) {
        bx = -preVx * RESTITUTION;
        if (!bounced) by = postVy * WALL_FRICTION_TANGENT;
        bounced = true;
      } else if (b.max.x >= vw - 1 && preVx > IMPACT_THRESHOLD) {
        bx = -preVx * RESTITUTION;
        if (!bounced) by = postVy * WALL_FRICTION_TANGENT;
        bounced = true;
      }
      if (bounced) {
        Matter.Body.setVelocity(body, { x: bx, y: by });
      }
    }

    // Angular magnetism: while held in the magnetic zone, nudge the
    // body's rotation toward the nearest upright orientation, with
    // strength scaling like the positional pull. Feels like the slot
    // wants its word back — the closer you get, the straighter it sits.
    if (draggingRef.current) {
      const cx = origin.x + origin.w / 2;
      const cy = origin.y + origin.h / 2;
      const dxOrigin = cx - body.position.x;
      const dyOrigin = cy - body.position.y;
      const distOrigin = Math.hypot(dxOrigin, dyOrigin);
      if (distOrigin < MAGNETIC_RADIUS_PX) {
        const t = 1 - distOrigin / MAGNETIC_RADIUS_PX;
        const strength = Math.sqrt(t);
        // Shortest signed delta from body.angle to nearest 2π multiple.
        const twoPi = Math.PI * 2;
        let delta = body.angle % twoPi;
        if (delta > Math.PI) delta -= twoPi;
        else if (delta < -Math.PI) delta += twoPi;
        // Damped angular spring: ω' = −k·δ − c·ω, blended in by
        // `strength` so it kicks in smoothly at the magnetic edge.
        // Tuned by feel: at hold near origin the word reaches upright
        // in roughly half a second without visible overshoot.
        const k = 0.045;
        const c = 0.32;
        const angAcc = (-k * delta - c * body.angularVelocity) * strength;
        Matter.Body.setAngularVelocity(body, body.angularVelocity + angAcc);
      }
    }

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
    // Wrap rotation to the shortest equivalent angle in (−180°, 180°]
    // before springing to 0. Without this, a throw that spun the word
    // 10× makes the snap-back animation unwind every one of those
    // rotations visually. AND pass velocity: 0 to the rotation spring:
    // framer-motion infers initial spring velocity from the motion
    // value's recent change rate. If the body was spinning fast at
    // rehang time, that inferred velocity launches the spring in the
    // wrong direction at thousands of deg/s before it can recover.
    const current = rotate.get();
    let wrapped = current % 360;
    if (wrapped > 180) wrapped -= 360;
    else if (wrapped <= -180) wrapped += 360;
    if (wrapped !== current) rotate.set(wrapped);

    snapAnimX.current = animate(x, 0, { ...SNAP_SPRING, velocity: 0 });
    snapAnimY.current = animate(y, 0, {
      ...SNAP_SPRING,
      velocity: 0,
      onComplete: () => onRehang(),
    });
    snapAnimR.current = animate(rotate, 0, { ...SNAP_SPRING, velocity: 0 });
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
    cursorTrailRef.current = [{ x: e.clientX, y: e.clientY, t: performance.now() }];

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

    // Magnetic bias for the constraint anchor when the cursor is near
    // the original slot. The RAW cursor position still feeds the trail
    // (so release velocity reflects what the user actually did) — only
    // the constraint's pointA gets shifted home-ward.
    const originCx = origin.x + origin.w / 2;
    const originCy = origin.y + origin.h / 2;
    const dx = originCx - e.clientX;
    const dy = originCy - e.clientY;
    const dist = Math.hypot(dx, dy);
    let anchorX = e.clientX;
    let anchorY = e.clientY;
    if (dist < MAGNETIC_RADIUS_PX && dist > 0) {
      const t = 1 - dist / MAGNETIC_RADIUS_PX;
      const pull = MAGNET_PULL_FACTOR * Math.sqrt(t);
      anchorX += dx * pull;
      anchorY += dy * pull;
    }
    constraint.pointA = { x: anchorX, y: anchorY };

    const now = performance.now();
    cursorTrailRef.current.push({ x: e.clientX, y: e.clientY, t: now });
    // Keep ~120 ms of history so a fast flick has enough samples to
    // average over, but old slow motion doesn't dilute the release.
    const cutoff = now - 120;
    while (
      cursorTrailRef.current.length > 2 &&
      cursorTrailRef.current[0].t < cutoff
    ) {
      cursorTrailRef.current.shift();
    }
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

    // Override the body's velocity with the cursor's release velocity
    // so a flick translates 1:1 into a throw. matter stores velocity in
    // px/step, so divide px/s by 60 fps. Capped to MAX_VEL_PER_STEP so
    // a finger-spike doesn't tunnel through walls.
    const trail = cursorTrailRef.current;
    if (trail.length >= 2) {
      const first = trail[0];
      const last = trail[trail.length - 1];
      const sdt = (last.t - first.t) / 1000;
      if (sdt > 1e-3) {
        const vxPerSec = (last.x - first.x) / sdt;
        const vyPerSec = (last.y - first.y) / sdt;
        const vxStep = vxPerSec / 60;
        const vyStep = vyPerSec / 60;
        const sp = Math.hypot(vxStep, vyStep);
        if (sp > MAX_VEL_PER_STEP) {
          Matter.Body.setVelocity(body, {
            x: (vxStep * MAX_VEL_PER_STEP) / sp,
            y: (vyStep * MAX_VEL_PER_STEP) / sp,
          });
        } else {
          Matter.Body.setVelocity(body, { x: vxStep, y: vyStep });
        }
      }
    }
    // Capture the cursor's final position before clearing the trail —
    // used below to decide whether the user released inside the
    // magnetic zone (counts as a drop-in-place re-hang).
    const lastCursor = trail[trail.length - 1];
    cursorTrailRef.current = [];

    // Snap if the body is currently close to the original slot OR the
    // user released while the cursor was inside the magnetic zone.
    // The magnetic check makes the drop zone match what the user feels
    // — once the magnet has them, letting go re-hangs in place. Both
    // gated on the minimum detach time so the initial pop can't
    // accidentally snap back before the word has had time to fall.
    const sinceDetach = performance.now() - detachedAtRef.current;
    const bodyClose = Math.hypot(x.get(), y.get()) < SNAP_RADIUS_PX;
    const cursorInMagnet = lastCursor
      ? Math.hypot(
          origin.x + origin.w / 2 - lastCursor.x,
          origin.y + origin.h / 2 - lastCursor.y,
        ) < MAGNETIC_RADIUS_PX
      : false;
    if (sinceDetach >= MIN_DETACH_MS && (bodyClose || cursorInMagnet)) {
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

/** Faded "hole" left in the heading slot after the word has popped
 *  off. Sits over the visibility:hidden original so the heading row
 *  reserves its width. Colour + font live in global.css (.lisse-ghost)
 *  so the display-p3 fallback chain can resolve through the cascade. */
export function LisseGhost() {
  return (
    <span
      aria-hidden
      className="lisse-ghost"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
      }}
    >
      lisse
    </span>
  );
}
