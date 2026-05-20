import type { CSSProperties, ReactNode } from "react";

// Cross-fade between icon variants. Every layer stays mounted (unmounting
// kills the cross-fade window and breaks colour inheritance from the pill).
// Motion is center-aligned — scale + blur + opacity, no translation —
// so the icon stays vertically centred in its slot.

const ACTIVE_STYLE: CSSProperties = {
  opacity: 1,
  transform: "scale(1)",
  filter: "blur(0px)",
};

const INACTIVE_STYLE: CSSProperties = {
  opacity: 0,
  transform: "scale(0.4)",
  filter: "blur(3px)",
};

// Spring curve matched to @numeric-text/core's default so the icon swap
// shares the label morph's rhythm — the icon settles in step with the
// per-glyph slide instead of riding a different ease.
const SPRING_EASE =
  "linear(0,.1052,.3155,.532,.7112,.8414,.9265,.9765,1.0023,1.013,1.0151,1.0133,1.01,1.0068,1.0041,1.0022,1.001,1)";

const TRANSITION =
  `opacity 300ms ${SPRING_EASE}, ` +
  `transform 300ms ${SPRING_EASE}, ` +
  `filter 300ms ${SPRING_EASE}`;

type IconLayer = {
  key: string;
  active: boolean;
  node: ReactNode;
};

interface IconSwapProps {
  size: number;
  className?: string;
  layers: IconLayer[];
}

const BASE_CLASS = "relative inline-flex flex-none items-center justify-center";

export function IconSwap({ size, className, layers }: IconSwapProps) {
  return (
    <span
      className={className ? `${BASE_CLASS} ${className}` : BASE_CLASS}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {layers.map(({ key, active, node }) => (
        <span
          key={key}
          className="absolute inset-0 inline-flex items-center justify-center"
          style={{
            ...(active ? ACTIVE_STYLE : INACTIVE_STYLE),
            transition: TRANSITION,
            willChange: "opacity, transform, filter",
          }}
        >
          {node}
        </span>
      ))}
    </span>
  );
}
