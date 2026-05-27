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
//
// On touch devices the fallen word is gravity-coupled to the phone:
// `deviceorientation` steers the engine's gravity vector (tilt the
// phone, the word rolls downhill) and `devicemotion` turns a deliberate
// shake into an inertial impulse. Both sensors are gated behind a
// coarse-pointer check and the iOS 13+ per-origin permission grant,
// which we request from the detaching tap (a user gesture). The
// simulation now advances on a FIXED timestep accumulator rather than
// feeding raw rAF deltas into the solver — matter.js is not robust to
// variable dt, and the jitter on slow/long frames came straight from
// that. Sensor input is low-pass filtered so noise never reaches the
// body.

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

const SNAP_RADIUS_PX = 22;        // centre-to-centre for the re-hang test
const SNAP_SPRING = { type: "spring" as const, stiffness: 420, damping: 22, mass: 0.9 };

// Magnetic snap zone — when the cursor enters this radius around the
// original slot, the drag-constraint's anchor is biased toward the
// origin, so the word "itches" home and the user gets a wider, more
// forgiving drop zone. sqrt (ease-out) falloff: barely felt at the
// edge, decisively grabby once the user crosses ~halfway in.
const MAGNETIC_RADIUS_PX = 70;
const MAGNET_PULL_FACTOR = 0.65;

// Minimum time the word must spend off the wall before the user can
// re-hang it by drag. Without this, releasing near origin during the
// initial pop fires snap-back instantly and the whole detach reads as
// an accidental click. The user still gets Escape and the auto-rehang
// timer, which are explicit, so this only gates the proximity snap.
const MIN_DETACH_MS = 1400;

const AUTO_REHANG_MS = 12_000;

// Fixed-timestep integration. matter.js integrates with a semi-implicit
// scheme that is only stable near its tuned 60 fps step; feeding it the
// raw rAF delta (which spikes on slow frames, scroll, or a backgrounded
// tab) was the source of the visible jitter. We accumulate real time and
// advance the solver in whole 1/60 s steps, capping the catch-up so a
// long stall can't trigger a spiral of death.
const FIXED_DT_MS = 1000 / 60;
const MAX_SUBSTEPS = 5;
const MAX_FRAME_MS = FIXED_DT_MS * MAX_SUBSTEPS; // drop backlog past this

const DEG = Math.PI / 180;

// Tilt → gravity. The smoothed gravity vector chases the live sensor
// reading with this time constant; ~120 ms kills accelerometer noise
// without the slope feeling laggy. We wake a sleeping body once the
// vector shifts past the epsilon so a tilt re-animates a settled word.
const TILT_TIME_CONSTANT_MS = 120;
const TILT_WAKE_EPS = 0.015;

// Shake → impulse. `devicemotion.acceleration` excludes gravity, so a
// still phone reads ~0 ± sensor noise; only a deliberate jerk clears the
// threshold. The impulse is inertial (opposite the device's own accel,
// like a loose object lagging its container) and capped per event.
const SHAKE_THRESHOLD = 6;        // m/s² before a shake registers
const SHAKE_IMPULSE_FACTOR = 0.12;
const SHAKE_IMPULSE_MAX = 8;      // px/step contributed per shake event

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

/** How strongly the magnet pulls at `point` toward the centre of `origin`.
 *  Returns the vector from `point` to origin centre and an ease-out (sqrt)
 *  strength in [0, 1) — zero at the magnetic-zone edge, full close in.
 *  Shared by the anchor bias, the angular pull, and the drop-zone check so
 *  the three sites can't drift apart. */
const magnetStrengthAt = (px: number, py: number, origin: Origin) => {
  const dx = origin.x + origin.w / 2 - px;
  const dy = origin.y + origin.h / 2 - py;
  const dist = Math.hypot(dx, dy);
  const strength =
    dist < MAGNETIC_RADIUS_PX ? Math.sqrt(1 - dist / MAGNETIC_RADIUS_PX) : 0;
  return { dx, dy, strength };
};

/** Clamp the magnitude of a 2D vector to `max`. Used at multiple sites
 *  that all cap velocities expressed in matter's per-step units. */
const capVector = (vx: number, vy: number, max: number) => {
  const sp2 = vx * vx + vy * vy;
  if (sp2 <= max * max) return { x: vx, y: vy };
  const sp = Math.sqrt(sp2);
  return { x: (vx * max) / sp, y: (vy * max) / sp };
};

// ----- device sensors ------------------------------------------------------

/** Tilt/shake coupling is touch-only by design ("only on mobile"). A
 *  coarse pointer is the honest proxy for "phone or tablet in hand"; we
 *  also require the orientation event to exist at all. */
function supportsDeviceTilt(): boolean {
  if (typeof window === "undefined") return false;
  const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  return coarse && "DeviceOrientationEvent" in window;
}

/** iOS 13+ gates the motion/orientation sensors behind a per-origin grant
 *  that MUST be requested from within a user-gesture call stack — hence
 *  this fires from the detaching tap, not the floater's mount effect.
 *  Fire-and-forget: once granted, the listeners the floater attaches
 *  start receiving events; denied or unsupported is a silent no-op. */
function requestSensorPermission(): void {
  if (typeof window === "undefined") return;
  for (const Ctor of [
    (window as unknown as { DeviceOrientationEvent?: unknown }).DeviceOrientationEvent,
    (window as unknown as { DeviceMotionEvent?: unknown }).DeviceMotionEvent,
  ]) {
    const req = (Ctor as { requestPermission?: () => Promise<string> } | undefined)
      ?.requestPermission;
    if (typeof req === "function") req.call(Ctor).catch(() => {});
  }
}

/** Rotate a device-natural-frame vector into screen space. When the OS
 *  rotates the page (portrait → landscape) the orientation/motion axes
 *  stay pinned to the device's natural frame, so we counter-rotate by the
 *  screen angle. Identity at angle 0, so the dominant portrait case is
 *  exact and landscape is best-effort. */
function toScreenSpace(dx: number, dy: number): { x: number; y: number } {
  const angle =
    (typeof screen !== "undefined" && screen.orientation?.angle) || 0;
  const a = angle * DEG;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  return { x: dx * ca + dy * sa, y: -dx * sa + dy * ca };
}

// ----- rAF helpers ---------------------------------------------------------
// Module-level so they aren't recreated each frame; pure side effects on
// the matter body so they can be unit-tested in isolation later.

/** Reflect velocity off whichever wall the body has just contacted, using
 *  our own restitution. matter.js's solver absorbs most of the bounce on
 *  hard impacts (apparent restitution ~0.13 against the configured value)
 *  because position correction reshuffles velocity. We detect impact by
 *  axis-aligned bounds + the pre-step velocity going INTO that wall.
 *  Viewport bounds are passed in so the helper stays a pure function of
 *  its arguments. */
function applyManualBounce(
  body: Matter.Body,
  preVx: number,
  preVy: number,
  vw: number,
  vh: number,
) {
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

/** Damped angular spring toward the nearest upright multiple of 2π,
 *  blended by magnetic strength so it only kicks in near the slot. */
function applyAngularMagnet(body: Matter.Body, origin: Origin) {
  const { strength } = magnetStrengthAt(body.position.x, body.position.y, origin);
  if (strength <= 0) return;
  // Shortest signed delta from body.angle to nearest 2π multiple.
  const twoPi = Math.PI * 2;
  let delta = body.angle % twoPi;
  if (delta > Math.PI) delta -= twoPi;
  else if (delta < -Math.PI) delta += twoPi;
  // Damped angular spring: ω' = −k·δ − c·ω, blended in by `strength` so
  // it kicks in smoothly at the magnetic edge. Tuned by feel: held near
  // origin the word reaches upright in ~0.5 s without visible overshoot.
  const k = 0.045;
  const c = 0.32;
  const angAcc = (-k * delta - c * body.angularVelocity) * strength;
  Matter.Body.setAngularVelocity(body, body.angularVelocity + angAcc);
}

/** Cap both angular and linear velocity to matter's per-step limits so a
 *  cursor flick or numerical spike can't whip the body into a blur. */
function capVelocities(body: Matter.Body) {
  const av = body.angularVelocity;
  if (Math.abs(av) > MAX_OMEGA_PER_STEP) {
    Matter.Body.setAngularVelocity(body, Math.sign(av) * MAX_OMEGA_PER_STEP);
  }
  const capped = capVector(body.velocity.x, body.velocity.y, MAX_VEL_PER_STEP);
  if (capped.x !== body.velocity.x || capped.y !== body.velocity.y) {
    Matter.Body.setVelocity(body, capped);
  }
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
      // This call stack is a real tap, so it's the one chance to clear
      // iOS's sensor-permission gate before the floater wants the data.
      if (supportsDeviceTilt()) requestSensorPermission();
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

  // matter.js refs — engine, body, walls, drag constraint.
  const engineRef = useRef<Matter.Engine | null>(null);
  const bodyRef = useRef<Matter.Body | null>(null);
  const wallsRef = useRef<Matter.Body[]>([]);
  const dragConstraintRef = useRef<Matter.Constraint | null>(null);

  // Drag state outside matter — for snap-back proximity, cursor capture.
  // `pointerIdRef.current !== null` is the canonical "is dragging" check;
  // a separate boolean would have to be kept in sync by hand.
  const pointerIdRef = useRef<number | null>(null);
  const isDragging = () => pointerIdRef.current !== null;
  const lastRestStartRef = useRef<number | null>(null);
  const detachedAtRef = useRef(performance.now());
  // Cursor history during drag, used to compute the throw velocity at
  // release. The constraint's soft spring lags behind the cursor, so the
  // body's intrinsic velocity on release is much smaller than what the
  // user expects from a flick — we override it with the cursor's actual
  // recent velocity.
  const cursorTrailRef = useRef<{ x: number; y: number; t: number }[]>([]);

  // ----- device-tilt state -------------------------------------------------
  // `tiltTarget` is the live (screen-space, unit-capped) gravity direction
  // straight from the sensor; `tiltGravity` is the low-pass-filtered value
  // actually fed to the engine. `tiltActive` flips on the first reading so
  // the desktop path leaves matter's default downward gravity untouched.
  // `pendingImpulse` accumulates shake kicks between frames; the rAF loop
  // drains it into the body's velocity.
  const tiltTargetRef = useRef({ x: 0, y: 1 });
  const tiltGravityRef = useRef({ x: 0, y: 1 });
  const tiltActiveRef = useRef(false);
  const pendingImpulseRef = useRef({ x: 0, y: 0 });

  // Fixed-timestep accumulator (see FIXED_DT_MS). Persisted across frames.
  const accumulatorRef = useRef(0);
  // Previous + current physics state, kept so the rendered transform can be
  // interpolated by the accumulator's leftover fraction. Without this the
  // fixed 60 Hz step visibly judders on 120 Hz displays (rAF fires twice
  // per step, so every other frame repeats a position). Seeded to the body's
  // start pose so the first frame doesn't lerp from the origin.
  const seedState = {
    x: origin.x + origin.w / 2,
    y: origin.y + origin.h / 2,
    angle: 0,
  };
  const prevStateRef = useRef({ ...seedState });
  const curStateRef = useRef({ ...seedState });

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

  // ----- Couple the engine to the phone's sensors (touch only) -------------
  useEffect(() => {
    if (!supportsDeviceTilt()) return;

    // Orientation → gravity direction. beta/gamma are clamped to ±90° and
    // mapped through sin so the vector is naturally bounded; held upright
    // (beta≈90) gravity points straight down, laid flat it goes slack.
    const onOrient = (e: DeviceOrientationEvent) => {
      if (e.beta == null || e.gamma == null) return;
      const gx = Math.sin(clamp(e.gamma, -90, 90) * DEG);
      const gy = Math.sin(clamp(e.beta, -90, 90) * DEG);
      const s = toScreenSpace(gx, gy);
      // Cap to 1 g so a diagonal hold (both sins large) can't make gravity
      // stronger than upright — independent sins overstate the corner.
      tiltTargetRef.current = capVector(s.x, s.y, 1);
      if (!tiltActiveRef.current) {
        // Seed the filter so the first reading doesn't drift in from the
        // default straight-down over the whole time constant.
        tiltGravityRef.current = { ...tiltTargetRef.current };
        tiltActiveRef.current = true;
      }
    };

    // Motion → inertial shake impulse. acceleration excludes gravity, so a
    // resting phone sits below threshold and never nudges the word.
    const onMotion = (e: DeviceMotionEvent) => {
      const a = e.acceleration;
      if (!a || a.x == null || a.y == null) return;
      if (Math.hypot(a.x, a.y) < SHAKE_THRESHOLD) return;
      // Inertia: the word lurches opposite the device's own acceleration.
      // device +y is screen-up, so screen-down flips the y sign.
      const s = toScreenSpace(-a.x, a.y);
      pendingImpulseRef.current.x += clamp(
        s.x * SHAKE_IMPULSE_FACTOR, -SHAKE_IMPULSE_MAX, SHAKE_IMPULSE_MAX,
      );
      pendingImpulseRef.current.y += clamp(
        s.y * SHAKE_IMPULSE_FACTOR, -SHAKE_IMPULSE_MAX, SHAKE_IMPULSE_MAX,
      );
    };

    window.addEventListener("deviceorientation", onOrient);
    window.addEventListener("devicemotion", onMotion);
    return () => {
      window.removeEventListener("deviceorientation", onOrient);
      window.removeEventListener("devicemotion", onMotion);
    };
  }, []);

  // ----- Step the simulation each animation frame --------------------------
  useAnimationFrame((_, deltaMs) => {
    const engine = engineRef.current;
    const body = bodyRef.current;
    if (!engine || !body) return;
    if (phaseRef.current === "snapping") return;

    const dragging = isDragging();

    // Steer gravity toward the smoothed tilt vector before stepping. Wake a
    // settled body once the direction shifts enough to be worth animating.
    if (tiltActiveRef.current) {
      const target = tiltTargetRef.current;
      const g = tiltGravityRef.current;
      const alpha = clamp(deltaMs / TILT_TIME_CONSTANT_MS, 0, 1);
      const ng = {
        x: g.x + (target.x - g.x) * alpha,
        y: g.y + (target.y - g.y) * alpha,
      };
      if (body.isSleeping && Math.hypot(ng.x - g.x, ng.y - g.y) > TILT_WAKE_EPS) {
        Matter.Sleeping.set(body, false);
      }
      tiltGravityRef.current = ng;
      engine.gravity.x = ng.x;
      engine.gravity.y = ng.y;
    }

    // Drain any accumulated shake impulse into the body's velocity.
    const imp = pendingImpulseRef.current;
    if (!dragging && (imp.x !== 0 || imp.y !== 0)) {
      Matter.Sleeping.set(body, false);
      const capped = capVector(
        body.velocity.x + imp.x, body.velocity.y + imp.y, MAX_VEL_PER_STEP,
      );
      Matter.Body.setVelocity(body, capped);
    }
    pendingImpulseRef.current = { x: 0, y: 0 };

    // Advance the solver in whole 1/60 s steps. Clamping the frame and the
    // substep count keeps a long stall from snowballing into a blow-up.
    // Each step rolls current → previous so the render can interpolate.
    accumulatorRef.current += Math.min(deltaMs, MAX_FRAME_MS);
    let steps = 0;
    while (accumulatorRef.current >= FIXED_DT_MS && steps < MAX_SUBSTEPS) {
      prevStateRef.current = curStateRef.current;
      const preVx = body.velocity.x;
      const preVy = body.velocity.y;
      Matter.Engine.update(engine, FIXED_DT_MS);
      if (!dragging) {
        applyManualBounce(body, preVx, preVy, window.innerWidth, window.innerHeight);
      } else {
        applyAngularMagnet(body, origin);
      }
      capVelocities(body);
      curStateRef.current = {
        x: body.position.x,
        y: body.position.y,
        angle: body.angle,
      };
      accumulatorRef.current -= FIXED_DT_MS;
      steps++;
    }
    if (steps === MAX_SUBSTEPS) accumulatorRef.current = 0;

    // Render the pose interpolated between the last two physics states by
    // the accumulator's leftover fraction — this is what makes the motion
    // read as butter-smooth regardless of the display's refresh rate.
    // (x, y) is offset from the heading's original centre. Per-step angle
    // deltas are tiny, so a plain lerp needs no shortest-path wrap.
    const a = clamp(accumulatorRef.current / FIXED_DT_MS, 0, 1);
    const p = prevStateRef.current;
    const c = curStateRef.current;
    const cx0 = origin.x + origin.w / 2;
    const cy0 = origin.y + origin.h / 2;
    x.set(lerp(p.x, c.x, a) - cx0);
    y.set(lerp(p.y, c.y, a) - cy0);
    rotate.set((lerp(p.angle, c.angle, a) * 180) / Math.PI);

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
    if (!body || !engine || phaseRef.current === "snapping") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointerIdRef.current = e.pointerId;
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
    const m = magnetStrengthAt(e.clientX, e.clientY, origin);
    const pull = MAGNET_PULL_FACTOR * m.strength;
    constraint.pointA = {
      x: e.clientX + m.dx * pull,
      y: e.clientY + m.dy * pull,
    };

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
    if (phaseRef.current === "snapping") return;
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
        const vxStep = (last.x - first.x) / sdt / 60;
        const vyStep = (last.y - first.y) / sdt / 60;
        Matter.Body.setVelocity(body, capVector(vxStep, vyStep, MAX_VEL_PER_STEP));
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
      ? magnetStrengthAt(lastCursor.x, lastCursor.y, origin).strength > 0
      : false;
    if (sinceDetach >= MIN_DETACH_MS && (bodyClose || cursorInMagnet)) {
      triggerRehang();
    }
  };

  // pointerup and pointercancel resolve identically — release the
  // capture if we still own it and finalise the drag.
  const finishPointer = (e: React.PointerEvent<HTMLSpanElement>) => {
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
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishPointer}
      onPointerCancel={finishPointer}
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
