import { useCallback, useState, type ReactNode } from "react";
import NumericText from "@numeric-text/react";
import { Card } from "./Card.tsx";
import { IconSwap } from "./IconSwap.tsx";

// Figma 8:1468 / 8:1471 → pr=12 py=6, gap=4 between icon and label.
// Icon-side padding is 10px (Tailwind `pl-2.5`) rather than Figma's 8 —
// 2px less than the text side optically centres the icon-and-label pair,
// matching the rule of thumb for icon-leading buttons.
const PILL_PADDING_X = 10 + 4 + 12;

// Match the NumericText label morph to the CSS width transition on the
// pill so the label and container settle on the same beat.
const LABEL_TRANSITION = { duration: 300 };

// Hit-area extender. Visible button is ~28.8px tall (under the 40×40
// minimum); `p-1.5 -m-1.5` adds 6px each side (~40.8px hit area)
// without changing the visual. `data-focus-ring` opts the button into
// the page-level <FocusRingOverlay> spring ring.
const PILL_HITAREA = "cursor-pointer p-1.5 -m-1.5 select-none";

// Visual pill. Width pins to (icon + gap + label + padding) with a 300ms
// CSS transition. The outer span and inner span pin to the same width
// in lockstep so the icon (anchored at inner.left via justify-start)
// glides horizontally with the container. The outer needs an explicit
// width (rather than shrink-to-fit) so Lisse's clip-path stays in
// sync with the element's actual size each frame of the transition;
// content-driven outer sizing produces a visible clip lag where the
// bg-surface fill overflows past the stale squircle path.
//
// `min-h-[29px]` integer-aligns the pill's device-pixel height on 2×
// Retina (29 CSS → 58 device px). Without it, py-1.5 + text-[14px]
// leading-[1.2] resolves to 28.8 CSS → 57.6 device px — a fractional
// device-pixel height that biases WebKit's Core Graphics antialiasing
// pass on the SVG-shadow anchor's promoted backing store (heavier
// top edge, harder rings). Install rows escape this because their
// 17px-icon content rounds them to 29 CSS / 58 device px naturally.
const PILL_VISUAL =
  "flex min-h-[29px] items-center justify-center bg-surface overflow-hidden " +
  "transition-[color,width] duration-300 ease-out-quint";

const PILL_INNER =
  "inline-flex items-center justify-start gap-1 pl-2.5 pr-figma-3 py-1.5 text-[14px] leading-[1.2] font-medium tracking-[-0.25px] whitespace-nowrap " +
  "transition-[width] duration-300 ease-out-quint";

/**
 * Ref-callback that wires a ResizeObserver to whichever element React
 * mounts, reporting border-box width changes through `onWidth`. Uses
 * React 19's ref-callback-cleanup so disconnect happens at unmount
 * without an effect dance.
 */
function useWidthObserver(onWidth: (width: number) => void) {
  return useCallback(
    (el: HTMLSpanElement | null) => {
      if (!el) return;
      const observer = new ResizeObserver(([entry]) => {
        onWidth(entry.borderBoxSize[0].inlineSize);
      });
      observer.observe(el);
      return () => observer.disconnect();
    },
    [onWidth],
  );
}

interface TogglePillProps {
  pressed: boolean;
  onToggle: () => void;
  ariaLabel: string;
  toneClass: string;
  iconSize: number;
  pressedIcon: ReactNode;
  unpressedIcon: ReactNode;
  label: string;
}

/**
 * Card-wrapped toggle button with a cross-fading icon and a morphing
 * NumericText label. The pill measures its own label width and pins
 * (button + inner-span) widths to (icon + gap + label + padding) with a
 * CSS transition, so the icon glides horizontally in step with label
 * content changes instead of snapping.
 */
export function TogglePill({
  pressed,
  onToggle,
  ariaLabel,
  toneClass,
  iconSize,
  pressedIcon,
  unpressedIcon,
  label,
}: TogglePillProps) {
  const [labelW, setLabelW] = useState(0);
  const labelRef = useWidthObserver(setLabelW);
  const width = labelW > 0 ? labelW + iconSize + PILL_PADDING_X : undefined;

  return (
    <button
      type="button"
      className={PILL_HITAREA}
      data-focus-ring
      onClick={onToggle}
      aria-pressed={pressed}
      aria-label={ariaLabel}
    >
      <Card>
        <span
          className={`${PILL_VISUAL} ${toneClass}`}
          style={{ width: width ?? "auto" }}
        >
          <span className={PILL_INNER} style={{ width: width ?? "auto" }}>
            <IconSwap
              size={iconSize}
              layers={[
                { key: "pressed", active: pressed, node: pressedIcon },
                { key: "unpressed", active: !pressed, node: unpressedIcon },
              ]}
            />
            <span ref={labelRef} className="inline-flex">
              <NumericText value={label} transition={LABEL_TRANSITION} />
            </span>
          </span>
        </span>
      </Card>
    </button>
  );
}
