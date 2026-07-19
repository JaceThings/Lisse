import { useEffect, useRef, useState } from "react";

export interface AnimationControls {
  stop: () => void;
}

type Ease = readonly [number, number, number, number];

export interface TweenOptions {
  type?: "tween";
  duration?: number;
  ease?: Ease | ((t: number) => number);
  onUpdate?: (value: number) => void;
  onComplete?: () => void;
}

export interface SpringOptions {
  type: "spring";
  stiffness?: number;
  damping?: number;
  mass?: number;
  onUpdate?: (value: number) => void;
  onComplete?: () => void;
}

type AnimateOptions = TweenOptions | SpringOptions;

export class MotionValue {
  private value: number;
  private listeners = new Set<(value: number) => void>();

  constructor(initial: number) {
    this.value = initial;
  }

  get(): number {
    return this.value;
  }

  set(next: number): void {
    if (next === this.value) return;
    this.value = next;
    for (const listener of this.listeners) listener(next);
  }

  jump(next: number): void {
    this.set(next);
  }

  onChange(listener: (value: number) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const sample = (t: number) => {
    const u = 1 - t;
    const x =
      3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t;
    const y =
      3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t;
    return { x, y };
  };

  return (t: number) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 12; i++) {
      const mid = (lo + hi) / 2;
      if (sample(mid).x < t) lo = mid;
      else hi = mid;
    }
    return sample((lo + hi) / 2).y;
  };
}

function resolveEase(ease: TweenOptions["ease"]): (t: number) => number {
  if (!ease) return (t) => t;
  if (typeof ease === "function") return ease;
  const [x1, y1, x2, y2] = ease;
  return cubicBezier(x1, y1, x2, y2);
}

function tweenValue(
  from: number,
  to: number,
  options: TweenOptions,
  setValue: (value: number) => void,
): AnimationControls {
  const durationMs = Math.max(0, (options.duration ?? 0.3) * 1000);
  const ease = resolveEase(options.ease);
  const start = performance.now();
  let rafId = 0;
  let stopped = false;

  const tick = (now: number) => {
    if (stopped) return;
    const t = durationMs === 0 ? 1 : Math.min(1, (now - start) / durationMs);
    const value = from + (to - from) * ease(t);
    setValue(value);
    options.onUpdate?.(value);
    if (t < 1) {
      rafId = requestAnimationFrame(tick);
      return;
    }
    options.onComplete?.();
  };

  rafId = requestAnimationFrame(tick);
  return {
    stop: () => {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(rafId);
    },
  };
}

function springValue(
  from: number,
  to: number,
  options: SpringOptions,
  setValue: (value: number) => void,
): AnimationControls {
  const stiffness = options.stiffness ?? 300;
  const damping = options.damping ?? 30;
  const mass = options.mass ?? 1;
  let position = from;
  let velocity = 0;
  let rafId = 0;
  let stopped = false;
  let last = performance.now();

  const tick = (now: number) => {
    if (stopped) return;
    const dt = Math.min(0.064, (now - last) / 1000);
    last = now;
    const springForce = -stiffness * (position - to);
    const dampingForce = -damping * velocity;
    const acceleration = (springForce + dampingForce) / mass;
    velocity += acceleration * dt;
    position += velocity * dt;
    setValue(position);
    options.onUpdate?.(position);

    if (Math.abs(position - to) < 0.001 && Math.abs(velocity) < 0.001) {
      setValue(to);
      options.onUpdate?.(to);
      options.onComplete?.();
      return;
    }

    rafId = requestAnimationFrame(tick);
  };

  rafId = requestAnimationFrame(tick);
  return {
    stop: () => {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(rafId);
    },
  };
}

export function animate(
  target: MotionValue | number,
  to: number,
  options: AnimateOptions = {},
): AnimationControls {
  const isMotionValue = target instanceof MotionValue;
  const from = isMotionValue ? target.get() : target;
  const setValue = (value: number) => {
    if (isMotionValue) target.set(value);
  };

  if (options.type === "spring") {
    return springValue(from, to, options, setValue);
  }

  return tweenValue(from, to, options, (value) => {
    setValue(value);
  });
}

export function useMotionValue(initial: number): MotionValue {
  const ref = useRef<MotionValue | null>(null);
  if (!ref.current) ref.current = new MotionValue(initial);
  return ref.current;
}

export function useMotionValueEvent(
  value: MotionValue,
  _event: "change",
  listener: (latest: number) => void,
): void {
  useEffect(() => value.onChange(listener), [value, listener]);
}

export function useTransform<T>(
  input: MotionValue | readonly MotionValue[],
  transform: ((...values: number[]) => T) | readonly number[],
  output?: readonly T[],
): T {
  const inputs = Array.isArray(input) ? [...input] : [input];
  const map =
    typeof transform === "function"
      ? transform
      : (...values: number[]) => {
          const value = values[0];
          const xs = transform as readonly number[];
          const ys = output as readonly T[];
          if (value <= xs[0]) return ys[0];
          if (value >= xs[xs.length - 1]) return ys[ys.length - 1];
          for (let i = 0; i < xs.length - 1; i++) {
            const x0 = xs[i];
            const x1 = xs[i + 1];
            if (value >= x0 && value <= x1) {
              const t = x1 === x0 ? 0 : (value - x0) / (x1 - x0);
              const y0 = ys[i] as number;
              const y1 = ys[i + 1] as number;
              return (y0 + (y1 - y0) * t) as T;
            }
          }
          return ys[ys.length - 1];
        };

  const read = () => map(...inputs.map((mv) => mv.get()));

  const [value, setValue] = useState<T>(() => read());

  useEffect(() => {
    const update = () => setValue(read());
    const unsubs = inputs.map((mv) => mv.onChange(update));
    update();
    return () => {
      for (const unsub of unsubs) unsub();
    };
  }, [inputs, map]);

  return value;
}

export function useSpring(
  source: MotionValue,
  {
    stiffness = 300,
    damping = 30,
    mass = 1,
  }: { stiffness?: number; damping?: number; mass?: number } = {},
): MotionValue {
  const springRef = useRef<MotionValue | null>(null);
  if (!springRef.current) springRef.current = new MotionValue(source.get());

  useEffect(() => {
    const spring = springRef.current!;
    let controls = animate(spring, source.get(), {
      type: "spring",
      stiffness,
      damping,
      mass,
    });

    const unsub = source.onChange((next) => {
      controls.stop();
      controls = animate(spring, next, {
        type: "spring",
        stiffness,
        damping,
        mass,
      });
    });

    return () => {
      controls.stop();
      unsub();
    };
  }, [source, stiffness, damping, mass]);

  return springRef.current;
}

export function useMotionNumber(initial: number): [number, MotionValue] {
  const mv = useMotionValue(initial);
  const [value, setValue] = useState(initial);
  useMotionValueEvent(mv, "change", setValue);
  return [value, mv];
}

export function cssEase(ease: Ease): string {
  const [x1, y1, x2, y2] = ease;
  return `cubic-bezier(${x1}, ${y1}, ${x2}, ${y2})`;
}
