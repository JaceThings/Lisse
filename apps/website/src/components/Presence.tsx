import {
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { cssEase } from "../lib/motion.ts";

interface FadeProps {
  show: boolean;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  durationMs?: number;
  ease?: readonly [number, number, number, number];
  initial?: boolean;
  y?: number;
}

export function Fade({
  show,
  children,
  className,
  style,
  durationMs = 240,
  ease = [0.4, 0, 0.2, 1],
  initial = true,
  y = 0,
}: FadeProps) {
  const [mounted, setMounted] = useState(show || initial);
  const [visible, setVisible] = useState(show && initial);

  useEffect(() => {
    if (show) {
      setMounted(true);
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    }
    setVisible(false);
    const timeout = window.setTimeout(() => setMounted(false), durationMs);
    return () => window.clearTimeout(timeout);
  }, [show, durationMs]);

  if (!mounted) return null;

  return (
    <div
      className={className}
      style={{
        ...style,
        opacity: visible ? 1 : 0,
        transform: y ? `translateY(${visible ? 0 : y}px)` : style?.transform,
        transition: `opacity ${durationMs}ms ${cssEase(ease)}${
          y ? `, transform ${durationMs}ms ${cssEase(ease)}` : ""
        }`,
      }}
    >
      {children}
    </div>
  );
}
