import { SmoothCorners } from "@lisse/react";
import { playPillSelect } from "../../lib/sounds.ts";

interface RadioPillOption<T extends string> {
  value: T;
  label: string;
}

interface RadioPillGroupProps<T extends string> {
  options: ReadonlyArray<RadioPillOption<T>>;
  value: T;
  onChange: (next: T) => void;
  ariaLabel: string;
  /** Tailwind class for min-width per pill — wider rows use `min-w-[110px]`. */
  pillMinWidth?: string;
  /** Tailwind class for basis per pill — use to force wrapping at a specific width, e.g. 2×2 on mobile. */
  pillBasis?: string;
}

// Hit-area extender mirrors TogglePill's PILL_HITAREA: `p-1.5 -m-1.5`
// adds 6px each side without changing layout, so the visible pill stays
// the same size while the pointer target reaches ~40×40.
const PILL_HITAREA = "cursor-pointer p-1.5 -m-1.5 select-none";

// Pill bg crossfade uses the same Apple-ease curve + 350ms duration as
// the preview state-change tween, so a preset click reads as one
// coordinated beat across the readout, preview, and pill highlight.
const PILL_VISUAL =
  "flex flex-1 items-center justify-center px-2.5 py-1.5 text-[14px] leading-[1.2] font-medium tracking-[-0.25px] text-text-input transition-[background-color] duration-[350ms] [transition-timing-function:cubic-bezier(0.32,0.72,0,1)]";

export function RadioPillGroup<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  pillMinWidth,
  pillBasis,
}: RadioPillGroupProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="flex w-full flex-wrap content-center items-center justify-center gap-3 p-3"
      data-focus-section={`playground-${ariaLabel.replace(/\s+/g, "-").toLowerCase()}`}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            data-focus-ring
            onClick={() => {
              if (option.value === value) return;
              playPillSelect();
              onChange(option.value);
            }}
            className={`${PILL_HITAREA} flex flex-1 ${pillMinWidth ?? ""} ${pillBasis ?? ""}`}
          >
            <SmoothCorners
              asChild
              autoEffects={false}
              corners={{ radius: 8, smoothing: 0.6 }}
            >
              <span
                className={`${PILL_VISUAL} ${
                  selected ? "bg-[rgba(126,117,108,0.12)]" : "bg-transparent"
                }`}
              >
                {option.label}
              </span>
            </SmoothCorners>
          </button>
        );
      })}
    </div>
  );
}
