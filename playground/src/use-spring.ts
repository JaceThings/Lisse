import { useState, useRef, useEffect } from "react";

// ─── Spring ─────────────────────────────────────────────
// Physics-based spring for user-driven interactions.
// Survives interruption and preserves velocity across target changes.

export function useSpring(
  target: number,
  stiffness = 300,
  damping = 26,
  mass = 1,
): number {
  const [, rerender] = useState(0);
  const state = useRef({ value: target, velocity: 0 });
  const targetRef = useRef(target);
  const rafRef = useRef(0);

  targetRef.current = target;

  useEffect(() => {
    let active = true;

    const step = () => {
      if (!active) return;
      const s = state.current;
      const t = targetRef.current;
      const dt = 1 / 60;

      const force = stiffness * (t - s.value);
      const damp = damping * s.velocity;
      const accel = (force - damp) / mass;
      s.velocity += accel * dt;
      s.value += s.velocity * dt;

      if (Math.abs(t - s.value) < 0.01 && Math.abs(s.velocity) < 0.01) {
        s.value = t;
        s.velocity = 0;
        rerender((n) => n + 1);
        return;
      }

      rerender((n) => n + 1);
      rafRef.current = requestAnimationFrame(step);
    };

    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(step);

    return () => {
      active = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [target, stiffness, damping, mass]);

  return state.current.value;
}
