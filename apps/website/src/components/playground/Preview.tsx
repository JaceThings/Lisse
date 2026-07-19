import { SmoothCorners } from "@lisse/react";
import type { BorderConfig, ShadowConfig, SmoothCornerOptions } from "@lisse/core";
import { useIsSafari } from "./is-safari.ts";
import { cssEase } from "../../lib/motion.ts";

interface PreviewProps {
  corners: SmoothCornerOptions;
  shadow?: ShadowConfig | ShadowConfig[];
  innerShadow?: ShadowConfig | ShadowConfig[];
  outerBorder?: BorderConfig;
  innerBorder?: BorderConfig;
  middleBorder?: BorderConfig;
  fill?: string;
  size?: number;
  width?: number;
  height?: number;
}

const CANVAS_HEIGHT = 255;
const DEFAULT_SIZE = 100;
const DEFAULT_FILL = "#7e766d";

const CAP_CROSSFADE_MS = 220;
const CAP_CROSSFADE_EASE = [0.32, 0.72, 0, 1] as const;

interface BorderLayerProps {
  corners: SmoothCornerOptions;
  border: BorderConfig | undefined;
  slot: "outer" | "inner" | "middle";
  size: number;
}

function BorderLayer({ corners, border, slot, size }: BorderLayerProps) {
  const capKey = border?.lineCap ?? "butt";
  if (!border) return null;

  return (
    <div
      key={capKey}
      className="pointer-events-none absolute inset-0"
      style={{
        opacity: 1,
        transition: `opacity ${CAP_CROSSFADE_MS}ms ${cssEase(CAP_CROSSFADE_EASE)}`,
      }}
    >
      <SmoothCorners
        corners={corners}
        outerBorder={slot === "outer" ? border : undefined}
        innerBorder={slot === "inner" ? border : undefined}
        middleBorder={slot === "middle" ? border : undefined}
        style={{
          width: size,
          height: size,
          backgroundColor: "transparent",
        }}
      />
    </div>
  );
}

export function Preview({
  corners,
  shadow,
  innerShadow,
  outerBorder,
  innerBorder,
  middleBorder,
  fill = DEFAULT_FILL,
  size = DEFAULT_SIZE,
  width = size,
  height = size,
}: PreviewProps) {
  const isSafari = useIsSafari();
  return (
    <div
      className="flex w-full items-center justify-center overflow-hidden p-3"
      style={{ height: CANVAS_HEIGHT }}
    >
      <div className="relative" style={{ width, height }}>
        <SmoothCorners
          corners={corners}
          shadow={shadow}
          innerShadow={innerShadow}
          shadowStrategy={isSafari ? "box-shadow" : "svg"}
          style={{
            width,
            height,
            backgroundColor: fill,
          }}
        />
        <BorderLayer corners={corners} border={outerBorder} slot="outer" size={size} />
        <BorderLayer corners={corners} border={innerBorder} slot="inner" size={size} />
        <BorderLayer corners={corners} border={middleBorder} slot="middle" size={size} />
      </div>
    </div>
  );
}
